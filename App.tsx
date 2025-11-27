
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToFloat32Array, float32ArrayToBase64, INPUT_SAMPLE_RATE, PCM_SAMPLE_RATE } from './utils/audioUtils';
import { 
  ai, 
  searchPlacesWithGrounding, 
  getUserSystemInstruction, 
  getReceptionistSystemInstruction,
  userTools,
  receptionistTools
} from './services/geminiService';
import VoiceControls from './components/VoiceControls';
import DynamicPanel from './components/DynamicPanel';
import { ViewMode, Place, Appointment, Message, SessionMode, BookingDetails } from './types';

const App: React.FC = () => {
  // State
  const [sessionMode, setSessionMode] = useState<SessionMode>(SessionMode.USER);
  const [isActive, setIsActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MAP);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Booking State
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [appointment, setAppointment] = useState<Appointment | undefined>(undefined);
  const [lastCallStatus, setLastCallStatus] = useState<string | undefined>(undefined);

  // Refs for State Access inside Callbacks
  const bookingDetailsRef = useRef<BookingDetails | null>(null);
  const dialingTriggeredRef = useRef<boolean>(false);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Playback Refs
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // Session Ref
  const sessionRef = useRef<Promise<any> | null>(null);
  const connectedRef = useRef(false);

  // Keep Ref in sync with State
  useEffect(() => {
    bookingDetailsRef.current = bookingDetails;
  }, [bookingDetails]);

  // If an external "information" object (bookingDetails) appears with negotiating status,
  // automatically transition to the receptionist call. Pass the details object explicitly
  // through the transition path to avoid any timing/ref staleness issues.
  useEffect(() => {
    if (bookingDetails && bookingDetails.status === 'negotiating' && sessionMode === SessionMode.USER && !dialingTriggeredRef.current) {
      dialingTriggeredRef.current = true;
      // Slight delay to allow UI to update before connecting
      setTimeout(() => {
        transitionToReceptionist(bookingDetails);
      }, 300);
    }
  }, [bookingDetails, sessionMode]);

  // Initialize Audio Output Context
  useEffect(() => {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    outputAudioContextRef.current = new Ctx({ sampleRate: PCM_SAMPLE_RATE });
  }, []);

  // --- CONNECTION MANAGER ---

  // NOTE: This function is recreated on render, but we need to be careful about stale state in closures.
  // We use refs (bookingDetailsRef) to ensure we always get the latest data.
  const connectToLiveAPI = async (mode: SessionMode, detailsParam?: BookingDetails) => {
    try {
      // Cleanup previous session if any
      await disconnectLiveAPI(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new Ctx({ sampleRate: INPUT_SAMPLE_RATE });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      // Config Selection
      let systemInstruction = "";
      let tools: any[] = [];
      
      if (mode === SessionMode.USER) {
        systemInstruction = getUserSystemInstruction(lastCallStatus);
        tools = userTools;
        console.log("Connecting as USER");
      } else {
        // Receptionist Mode - Prefer the details passed explicitly, otherwise fall back to ref
        const currentDetails = detailsParam ?? bookingDetailsRef.current;
        console.log('connectToLiveAPI: receptionist mode - detailsParam =', detailsParam, 'bookingDetailsRef.current =', bookingDetailsRef.current);
        if (!currentDetails) {
            console.error("No booking details found for receptionist call.");
            addSystemMessage('No booking details available to call receptionist.');
            throw new Error("No booking details for call");
        }
        systemInstruction = getReceptionistSystemInstruction(currentDetails);
        tools = receptionistTools;
        console.log("Connecting as RECEPTIONIST to:", currentDetails.placeName);
      }

      // Connect Live API
      sessionRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log(`Connected to Live API [${mode}]`);
            connectedRef.current = true;
            setIsActive(true);
            setSessionMode(mode);
          },
          onmessage: async (message: LiveServerMessage) => {
            // We need to pass the *current* mode from the closure when this listener was created
            handleLiveMessage(message, mode);
          },
          onclose: () => {
            console.log(`Live API disconnected [${mode}]`);
            connectedRef.current = false;
            setIsActive(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            connectedRef.current = false;
            setIsActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          tools: tools,
        }
      });

      // Start processing audio input
      processorRef.current.onaudioprocess = (e) => {
        if (!connectedRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Volume Visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        setVolumeLevel(Math.sqrt(sum / inputData.length));

        // Send to API
        const base64Data = float32ArrayToBase64(inputData);
        sessionRef.current?.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
              data: base64Data
            }
          });
        });
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error("Failed to connect:", err);
      addSystemMessage('Failed to connect live API: ' + String(err));
      try { alert("Could not access microphone or connect to Gemini: " + String(err)); } catch(e) { console.error('alert failed', e); }
    }
  };

  const disconnectLiveAPI = async (resetUI = true) => {
    console.log('disconnectLiveAPI: starting');
    connectedRef.current = false;
    
    if (sessionRef.current) {
        const session = await sessionRef.current;
        // Try close if available
        if (session && typeof session.close === 'function') {
           session.close();
        }
        sessionRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (resetUI) {
      setIsActive(false);
      setVolumeLevel(0);
    }
    console.log('disconnectLiveAPI: completed');
  };

  // --- MESSAGE HANDLER ---

  const handleLiveMessage = async (message: LiveServerMessage, currentMode: SessionMode) => {
    // 1. Play Audio
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      playAudioResponse(audioData);
    }

    // 2. Handle Tools
    const toolCall = message.toolCall;
    if (toolCall) {
      for (const fc of toolCall.functionCalls) {
        console.log(`Function Called [${currentMode}]:`, fc.name, fc.args);
        let result: any = { status: 'ok' };

        // --- USER MODE TOOLS ---
        if (currentMode === SessionMode.USER) {
            if (fc.name === 'findPlaces') {
                const query = (fc.args as any).query;
                addSystemMessage(`Searching for "${query}"...`);
                setViewMode(ViewMode.MAP);
                const foundPlaces = await searchPlacesWithGrounding(query);
                setPlaces(foundPlaces);
                result = { found_count: foundPlaces.length };
            } 
            else if (fc.name === 'selectProvider') {
                const pid = (fc.args as any).providerId;
                setSelectedPlaceId(pid);
                const place = places.find(p => p.id === pid);
                addSystemMessage(`Selected ${place?.name}. Ask for date/time to proceed.`);
                result = { selected: place?.name, phoneNumber: place?.phoneNumber };
            }
            else if (fc.name === 'initiateCall') {
                const { placeId, service, date, time } = fc.args as any;
                const place = places.find(p => p.id === placeId);
                
                if (place) {
                  const details: BookingDetails = {
                    placeId,
                    placeName: place.name,
                    service,
                    date,
                    time,
                    status: 'negotiating'
                  };
                  setBookingDetails(details);
                  // Update ref immediately for the transition
                  bookingDetailsRef.current = details; 
                  console.log('initiateCall: bookingDetails set on state and ref:', details);
                  
                  addSystemMessage("Dialing receptionist...");
                  console.log('initiateCall: added system message and will transition to receptionist');
                  
                  // TRANSITION: Disconnect User, Start Receptionist
                  // Return success to User model so it wraps up politely
                  result = { status: 'switching_session' };
                  
                  // Artificial delay to simulate "Dialing"
                  // Using a standalone function reference to avoid stale closures in setTimeout
                  transitionToReceptionist(details);
                } else {
                  result = { error: 'Place not found' };
                }
            }
        } 
        
        // --- RECEPTIONIST MODE TOOLS ---
        else if (currentMode === SessionMode.RECEPTIONIST) {
            if (fc.name === 'reportBookingOutcome') {
                const { success, finalDate, finalTime, notes } = fc.args as any;
                
                // Get fresh details from ref
                const details = bookingDetailsRef.current;
                
                if (success && details) {
                    const newAppt: Appointment = {
                        id: Date.now().toString(),
                        providerId: details.placeId,
                        providerName: details.placeName,
                        date: new Date(`${finalDate || details.date}T${finalTime || details.time}`),
                        serviceType: details.service
                    };
                    setAppointment(newAppt);
                    setLastCallStatus("Success: Booking confirmed.");
                    setViewMode(ViewMode.CALENDAR);
                    
                    // IMPORTANT: Update status to stop Dialing UI when we switch back
                    const updatedDetails = { ...details, status: 'confirmed' as const };
                    setBookingDetails(updatedDetails);
                    bookingDetailsRef.current = updatedDetails;

                } else {
                    setLastCallStatus(`Failed: ${notes || "Receptionist unavailable"}`);
                    if (details) {
                        const updatedDetails = { ...details, status: 'failed' as const };
                        setBookingDetails(updatedDetails);
                        bookingDetailsRef.current = updatedDetails;
                    }
                }
                
                result = { status: 'call_ended' };
                
                // TRANSITION: Disconnect Receptionist, Back to User
                transitionToUser();
            }
        }

        // Send Tool Response
        sessionRef.current?.then(session => {
            session.sendToolResponse({
                functionResponses: {
                    id: fc.id,
                    name: fc.name,
                    response: { result }
                }
            });
        });
      }
    }
  };

  // Helper to handle transitions with delays, ensuring we call the main connect function
  // We use references to class-level methods or stable functions
    const transitionToReceptionist = (details?: BookingDetails) => {
       console.log('transitionToReceptionist: scheduled in 3s with details =', details);
       // mark that dialing was triggered (prevents duplicate triggers)
       dialingTriggeredRef.current = true;
       setTimeout(() => {
          try {
            console.log('transitionToReceptionist: invoking handleSessionTransition(RECEPTIONIST)');
            handleSessionTransition(SessionMode.RECEPTIONIST, details);
          } catch (e) {
            console.error('transitionToReceptionist: error calling handleSessionTransition', e);
            addSystemMessage('Error transitioning to receptionist: ' + String(e));
          }
       }, 3000); // 3 seconds dialing time
    };

  const transitionToUser = () => {
      setTimeout(() => {
        // allow future dialing flows to trigger again
        dialingTriggeredRef.current = false;
        handleSessionTransition(SessionMode.USER);
      }, 1500);
  };

  const handleSessionTransition = async (nextMode: SessionMode, detailsParam?: BookingDetails) => {
    console.log('handleSessionTransition: nextMode=', nextMode, 'detailsParam=', detailsParam);
    // 1. Disconnect current
    console.log('handleSessionTransition: calling disconnectLiveAPI');
    await disconnectLiveAPI(false);
    console.log('handleSessionTransition: disconnectLiveAPI completed');
    
    // 2. Short delay for clean audio break
    await new Promise(r => setTimeout(r, 500));
    
    // 3. Connect next (pass details through)
    console.log('handleSessionTransition: connecting to nextMode', nextMode);
    await connectToLiveAPI(nextMode, detailsParam);
  };

  const playAudioResponse = async (base64Data: string) => {
    if (!outputAudioContextRef.current) return;
    try {
        const float32Data = base64ToFloat32Array(base64Data);
        const buffer = outputAudioContextRef.current.createBuffer(1, float32Data.length, PCM_SAMPLE_RATE);
        buffer.getChannelData(0).set(float32Data);
        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(outputAudioContextRef.current.destination);
        const now = outputAudioContextRef.current.currentTime;
        const startTime = Math.max(now, nextStartTimeRef.current);
        source.start(startTime);
        nextStartTimeRef.current = startTime + buffer.duration;
    } catch (e) {
        console.error("Error playing audio", e);
    }
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text, timestamp: new Date() }]);
  };

  const handleToggle = () => {
    if (isActive) {
      disconnectLiveAPI(true);
      setSessionMode(SessionMode.USER); // Reset to User mode on full stop
    } else {
      // Always start as User
      connectToLiveAPI(SessionMode.USER);
    }
  };

  // DEBUG: helper to simulate an external booking information object and trigger receptionist
  const simulateBookingAndDial = () => {
    const sample: BookingDetails = {
      placeId: 'debug-1',
      placeName: 'Debug Salon',
      service: 'Haircut',
      date: new Date().toISOString().slice(0,10),
      time: '15:30',
      status: 'negotiating'
    };
    setBookingDetails(sample);
    bookingDetailsRef.current = sample;
    addSystemMessage('Debug: injected booking details');
    transitionToReceptionist(sample);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Left Panel: Sola Interface */}
      <div className={`w-1/3 border-r border-gray-200 flex flex-col shadow-xl z-20 transition-colors duration-500 ${sessionMode === SessionMode.RECEPTIONIST ? 'bg-gray-900 text-white' : 'bg-white'}`}>
        <div className={`p-6 border-b ${sessionMode === SessionMode.RECEPTIONIST ? 'border-gray-700' : 'border-gray-100'}`}>
          <h1 className="text-2xl font-bold flex items-center">
            <span className={`w-3 h-3 rounded-full mr-3 animate-pulse ${sessionMode === SessionMode.RECEPTIONIST ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {sessionMode === SessionMode.USER ? "Sola Assistant" : "Live Call Active"}
          </h1>
          <div className="mt-3">
            <button onClick={simulateBookingAndDial} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Debug: Dial</button>
          </div>
          <p className={`text-sm mt-1 ${sessionMode === SessionMode.RECEPTIONIST ? 'text-gray-400' : 'text-gray-500'}`}>
            {sessionMode === SessionMode.USER ? "Chennai Regional Voice Booking" : `Calling: ${bookingDetails?.placeName}`}
          </p>
        </div>
        
        {/* Chat / Transcript Area */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${sessionMode === SessionMode.RECEPTIONIST ? 'bg-gray-800' : 'bg-gray-50'}`}>
           {messages.length === 0 && sessionMode === SessionMode.USER && (
             <div className="text-center text-gray-400 mt-10">
               <p>Say "Find a saloon nearby" to start.</p>
             </div>
           )}
           {sessionMode === SessionMode.RECEPTIONIST && (
             <div className="p-4 bg-gray-700 rounded-lg text-center animate-pulse">
                <p className="text-green-400 font-bold mb-2">📞 Connected</p>
                <p className="text-sm text-gray-300">Sola is speaking to you (The Receptionist).</p>
             </div>
           )}
           {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                 msg.role === 'system' ? 'bg-yellow-100 text-yellow-800 italic w-full text-center' :
                 msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-800'
               }`}>
                 {msg.text}
               </div>
             </div>
           ))}
        </div>

        {/* Voice Controls */}
        <div className={`p-6 border-t ${sessionMode === SessionMode.RECEPTIONIST ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
           <VoiceControls 
             isActive={isActive} 
             onToggle={handleToggle} 
             volumeLevel={volumeLevel}
           />
        </div>
      </div>

      {/* Right Panel: Dynamic Content */}
      <div className="flex-1 bg-gray-100 relative">
        <DynamicPanel 
          mode={viewMode}
          places={places}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={(id) => {
             setSelectedPlaceId(id);
          }}
          appointment={appointment}
          isCallingReceptionist={sessionMode === SessionMode.RECEPTIONIST}
          bookingDetails={bookingDetails || undefined}
          volumeLevel={volumeLevel}
        />
      </div>
    </div>
  );
};

export default App;
