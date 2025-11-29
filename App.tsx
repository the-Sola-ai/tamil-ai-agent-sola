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
import { addToGoogleCalendar } from './services/calendarClient';
import { ViewMode, Place, Appointment, Message, SessionMode, BookingDetails } from './types';

const App: React.FC = () => {
  // Default places (used as the single source of truth for the demo)
  const DEFAULT_PLACES: Place[] = [
    { id: '1', name: 'Chennai Classic Saloon', address: '12, Anna Salai, Chennai', phoneNumber: '+91 98765 43210', rating: 4.5, userRatingCount: 120, location: { lat: 13.0827, lng: 80.2707 } },
    { id: '2', name: 'Velachery Spa & Saloon', address: '45, Bypass Rd, Velachery', phoneNumber: '044 2244 6688', rating: 4.2, userRatingCount: 85, location: { lat: 12.9815, lng: 80.2180 } },
    { id: '3', name: 'Style Cuts', address: '8, T Nagar, Chennai', phoneNumber: '+91 91234 56789', rating: 4.8, userRatingCount: 340, location: { lat: 13.0418, lng: 80.2341 } },
    { id: '4', name: 'Green Trends', address: 'Mylapore, Chennai', phoneNumber: '044 2468 1357', rating: 4.3, userRatingCount: 210, location: { lat: 13.0368, lng: 80.2676 } },
    { id: '5', name: 'Naturals', address: 'Adyar, Chennai', phoneNumber: '+91 99887 76655', rating: 4.6, userRatingCount: 190, location: { lat: 13.0012, lng: 80.2565 } },
  ];
  // State
  const [sessionMode, setSessionMode] = useState<SessionMode>(SessionMode.USER);
  const [isActive, setIsActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MAP);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [places, setPlaces] = useState<Place[]>(DEFAULT_PLACES);
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
      // allow future dialing attempts
      dialingTriggeredRef.current = false;
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
              console.log('selectProvider: providerId=', pid, 'places.length=', places.length);
              console.log('selectProvider: found place =', place);
              addSystemMessage(`Selected ${place?.name}. Ask for date/time to proceed.`);
              result = { selected: place?.name, phoneNumber: place?.phoneNumber };
            }
            else if (fc.name === 'initiateCall') {
              console.log('initiateCall: current places length=', places.length, 'places=', places.map(p => p.id));
                const { placeId, service, date, time } = fc.args as any;
                // Prioritize selectedPlaceId (user's chosen salon) over provided placeId
                const targetPlaceId = selectedPlaceId || placeId;
                console.log('initiateCall: selectedPlaceId=', selectedPlaceId, 'providedPlaceId=', placeId, 'using targetPlaceId=', targetPlaceId);
                
                let place = places.find(p => p.id === targetPlaceId);

                if (!place) {
                  if (places.length > 0) {
                    // If the provided id doesn't match any default place (e.g., a Google Maps id),
                    // ignore it and fall back to the first default place.
                    console.warn('initiateCall: target placeId not found in default places, falling back to first default place. targetPlaceId=', targetPlaceId);
                    place = places[0];
                  } else {
                    // No default places available — return an explicit error so flow can handle it.
                    console.warn('initiateCall: no default places available to fallback to');
                  }
                }

                if (place) {
                  const details: BookingDetails = {
                    placeId: place.id,
                    placeName: place.name,
                    service,
                    date,
                    time,
                    status: 'negotiating'
                  };
                  setBookingDetails(details);
                  bookingDetailsRef.current = details;
                  console.log('initiateCall: bookingDetails set on state and ref:', details);

                  addSystemMessage('Dialing receptionist...');
                  console.log('initiateCall: added system message and will transition to receptionist');

                  result = { status: 'switching_session' };
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
                    
                    // Add to Google Calendar (async)
                    addToGoogleCalendar(newAppt).then((res:any) => {
                      console.log('[CALENDAR] addToGoogleCalendar result:', res);
                      addSystemMessage('✓ Booking added to your Google Calendar');
                    }).catch((err:any) => {
                      console.error('[CALENDAR] addToGoogleCalendar error:', err);
                      addSystemMessage('❌ Calendar: ' + (err?.message || JSON.stringify(err)));
                    });
                    
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
        try {
          sessionRef.current?.then(session => {
            console.log('sending tool response for', fc.name, 'id=', fc.id, 'result=', result, 'session=', session);
            session.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result }
              }
            });
          }).catch((err:any) => {
            console.error('Error resolving sessionRef when sending tool response:', err);
            addSystemMessage('Error sending tool response: ' + String(err));
          });
        } catch (err) {
          console.error('Exception sending tool response:', err);
          addSystemMessage('Exception sending tool response: ' + String(err));
        }
      }
    }
  };

  // Helper to handle transitions with delays, ensuring we call the main connect function
  // We use references to class-level methods or stable functions
    const transitionToReceptionist = (details?: BookingDetails) => {
       console.log('transitionToReceptionist: scheduled in 3s with details =', details);
       // If caller passed details, ensure state/ref are set immediately so connect path has them.
       if (details) {
         setBookingDetails(details);
         bookingDetailsRef.current = details;
         addSystemMessage('Preparing to call: ' + details.placeName);
       }
       // mark that dialing was triggered (prevents duplicate triggers)
       dialingTriggeredRef.current = true;
       setTimeout(() => {
          try {
            console.log('transitionToReceptionist: invoking handleSessionTransition(RECEPTIONIST)');
            handleSessionTransition(SessionMode.RECEPTIONIST, details);
          } catch (e) {
            console.error('transitionToReceptionist: error calling handleSessionTransition', e);
            addSystemMessage('Error transitioning to receptionist: ' + String(e));
            // allow retry
            dialingTriggeredRef.current = false;
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
    setMessages(prev => [...prev, { id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9), role: 'system', text, timestamp: new Date() }]);
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

  // --- New: End-call handler exposed to DynamicPanel ---
  const handleEndCall = async () => {
    console.log('handleEndCall: user requested to end call');
    // disconnect the live session and reset UI
    await disconnectLiveAPI(true);
    setSessionMode(SessionMode.USER);

    // If we had an in-progress booking (negotiating) and no confirmed appointment, cancel it
    const current = bookingDetailsRef.current;
    if (current && current.status === 'negotiating') {
      const updated = { ...current, status: 'failed' as const };
      setBookingDetails(updated);
      bookingDetailsRef.current = updated;
      setAppointment(undefined);
      setLastCallStatus('Cancelled: call ended before confirmation.');
      addSystemMessage('Booking cancelled because call was ended before confirmation.');
    }

    dialingTriggeredRef.current = false;
  };

  // Allow UI to explicitly cancel booking without touching call (hook for a "Cancel" control if needed)
  const handleCancelBooking = () => {
    const current = bookingDetailsRef.current;
    if (current && current.status === 'negotiating') {
      const updated = { ...current, status: 'failed' as const };
      setBookingDetails(updated);
      bookingDetailsRef.current = updated;
      setAppointment(undefined);
      setLastCallStatus('Cancelled by user.');
      addSystemMessage('Booking cancelled by user.');
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

  // Calendar integration is handled in services/calendarClient.ts
  // Only enable calendar action when appointment exists AND bookingDetails status is confirmed
  const calendarAction = (appointment && bookingDetails?.status === 'confirmed') ? (() => addToGoogleCalendar(appointment)) : undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-b from-[#0b1220] to-[#071021] text-gray-100">
      {/* Left Panel: Sola Interface */}
      <div className={`w-1/3 flex flex-col shadow-2xl z-20 transition-colors duration-500 bg-[rgba(255,255,255,0.02)] border-r border-transparent backdrop-blur-sm`}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${sessionMode === SessionMode.RECEPTIONIST ? 'bg-green-400' : 'bg-red-400'} shadow-sm`} />
                {sessionMode === SessionMode.USER ? "Sola Assistant" : "Live Call"}
              </h1>
              <p className="text-sm text-gray-400 mt-1">{sessionMode === SessionMode.USER ? "Chennai regional voice booking" : `Calling: ${bookingDetails?.placeName}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={simulateBookingAndDial} className="text-xs px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow">Debug: Dial</button>
            </div>
          </div>
        </div>
        
        {/* Chat / Transcript Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {messages.length === 0 && sessionMode === SessionMode.USER && (
             <div className="text-center text-gray-500 mt-10">
               <p>Say "Find a saloon nearby" to start.</p>
             </div>
           )}
           {sessionMode === SessionMode.RECEPTIONIST && (
             <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-gray-800 text-center">
                <p className="text-green-300 font-bold mb-1">📞 Connected</p>
                <p className="text-sm text-gray-400">Sola is speaking to the receptionist.</p>
             </div>
           )}
           {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                 msg.role === 'system' ? 'bg-amber-900/40 text-amber-300 italic w-full text-center' :
                 msg.role === 'user' ? 'bg-gradient-to-r from-violet-700 to-violet-600 text-white' : 'bg-[rgba(255,255,255,0.03)] border border-gray-800 text-gray-100'
               }`}>
                 {msg.text}
               </div>
             </div>
           ))}
        </div>

        {/* Voice Controls */}
        <div className="p-6 border-t border-gray-800 bg-gradient-to-t from-transparent to-[rgba(255,255,255,0.02)]">
           <VoiceControls 
             isActive={isActive} 
             onToggle={handleToggle} 
             volumeLevel={volumeLevel}
           />
        </div>
      </div>

      {/* Right Panel: Dynamic Content */}
      <div className="flex-1 relative">
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
          // Pass calendar action only when booked & confirmed
          onAddToCalendar={calendarAction}
          // New handlers (DynamicPanel can call these when user presses end/cancel)
          onEndCall={handleEndCall}
          onCancelBooking={handleCancelBooking}
        />
      </div>
    </div>
  );
};

export default App;
