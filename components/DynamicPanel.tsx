
import React from 'react';
import { ViewMode, Place, Appointment, BookingDetails } from '../types';
import MapComponent from './MapComponent';
import CalendarView from './CalendarView';

interface DynamicPanelProps {
  mode: ViewMode;
  places: Place[];
  selectedPlaceId?: string;
  onSelectPlace: (id: string) => void;
  appointment?: Appointment;
  isCallingReceptionist: boolean;
  bookingDetails?: BookingDetails;
  volumeLevel: number; // For visualizer
  onAddToCalendar?: () => void; // Callback to manually trigger calendar sync
}

const DynamicPanel: React.FC<DynamicPanelProps> = ({ 
  mode, 
  places, 
  selectedPlaceId, 
  onSelectPlace,
  appointment,
  isCallingReceptionist,
  bookingDetails,
  volumeLevel,
  onAddToCalendar
}) => {
  
  // Logic to determine if we are in the "Dialing" transition state
  // We are dialing if the status is negotiating but the session hasn't switched to Receptionist yet
  const isDialing = bookingDetails?.status === 'negotiating' && !isCallingReceptionist;

  // 1. DIALING SCREEN
  if (isDialing) {
    const selectedPlace = places.find(p => p.id === bookingDetails?.placeId);
    return (
      <div className="h-full w-full bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 bg-gray-900 z-0">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-900 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        </div>

        <div className="z-10 flex flex-col items-center">
            {/* Avatar Pulse */}
            <div className="relative mb-8">
                <span className="absolute inline-flex h-32 w-32 rounded-full bg-green-500 opacity-20 animate-ping"></span>
                <span className="absolute inline-flex h-32 w-32 rounded-full bg-green-500 opacity-20 animate-ping delay-150"></span>
                <div className="relative w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 shadow-2xl">
                     <span className="text-5xl font-bold text-gray-300">
                        {selectedPlace?.name.charAt(0) || "C"}
                     </span>
                </div>
            </div>

            <h2 className="text-3xl font-bold mb-2">{selectedPlace?.name || bookingDetails?.placeName}</h2>
            <p className="text-gray-400 text-lg mb-8 tracking-widest">DIALING...</p>

            <div className="flex space-x-8">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-2">
                         <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.66 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    </div>
                    <span className="text-xs text-gray-500">Audio</span>
                </div>
                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mb-2 shadow-lg shadow-red-900/50">
                         <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.36 7.46 6 12 6s8.66 2.36 11.71 5.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                    </div>
                    <span className="text-xs text-gray-500">End</span>
                </div>
                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-2">
                         <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    </div>
                    <span className="text-xs text-gray-500">Speaker</span>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE CALL SCREEN (Receptionist Connected)
  if (isCallingReceptionist) {
    const selectedPlace = places.find(p => p.id === bookingDetails?.placeId);
    const phoneNumber = selectedPlace?.phoneNumber || "Connected";

    return (
      <div className="h-full w-full bg-black text-white flex flex-col items-center justify-between relative overflow-hidden py-12">
        {/* Background Blur */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-black opacity-90 z-0"></div>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] z-0"></div>

        {/* Top Info */}
        <div className="z-10 flex flex-col items-center mt-8 w-full px-8 animate-fade-in-down">
           <div className="w-24 h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center mb-6 shadow-2xl border-2 border-gray-600">
             <span className="text-4xl font-bold text-gray-300">
                {bookingDetails?.placeName?.charAt(0) || "C"}
             </span>
           </div>
           
           <h2 className="text-3xl font-bold mb-2 text-center">{bookingDetails?.placeName}</h2>
           <p className="text-gray-400 text-lg mb-2">{phoneNumber}</p>
           <p className="text-green-400 text-sm font-mono animate-pulse bg-green-900/30 px-3 py-1 rounded-full border border-green-800/50">
             00:14 • HD Voice Active
           </p>
        </div>

        {/* Dynamic Visualizer (The Wave) */}
        <div className="z-10 flex items-center justify-center h-32 w-full px-12">
             <div className="flex space-x-1.5 items-center h-full">
                {Array.from({ length: 24 }).map((_, i) => {
                    // Create a wave effect based on volume and index
                    const baseHeight = 6;
                    const wave = Math.sin(i * 0.4 + Date.now() / 150);
                    const dynamicHeight = Math.max(baseHeight, volumeLevel * 300 * Math.abs(wave));
                    
                    return (
                        <div 
                           key={i} 
                           className="w-1.5 bg-gradient-to-t from-green-400 to-green-600 rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                           style={{ height: `${dynamicHeight}px` }}
                        />
                    )
                })}
             </div>
        </div>

        {/* Helper Card for User Roleplay */}
        <div className="z-10 bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl border border-gray-700/50 max-w-sm w-full mx-4 text-center shadow-xl">
             <p className="text-xs text-yellow-500 font-bold uppercase tracking-wider mb-3">Incoming Call Simulation</p>
             <p className="text-sm text-gray-300 leading-relaxed">
               You are the receptionist at <span className="font-bold text-white">{bookingDetails?.placeName}</span>.
               <br/>
               Sola is asking to book: <span className="text-green-300 font-medium block mt-1">{bookingDetails?.service} • {bookingDetails?.date} • {bookingDetails?.time}</span>
             </p>
        </div>

        {/* Phone Controls (Visual Only) */}
        <div className="z-10 grid grid-cols-3 gap-8 mb-8 w-full max-w-xs px-4">
             {['Mute', 'Keypad', 'Speaker', 'Add Call', 'Video', 'Contacts'].map((label, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center opacity-50 hover:opacity-80 transition-opacity cursor-pointer">
                    <div className="w-14 h-14 rounded-full border border-gray-600 bg-gray-800/50 flex items-center justify-center mb-1">
                        <div className="w-6 h-6 bg-gray-500 rounded-sm"></div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                </div>
             ))}
        </div>
        
        {/* End Call Button (Visual Only - AI ends it) */}
        <div className="z-10 mb-8">
             <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg shadow-red-900/40 transition-transform hover:scale-105 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21l-1.498-4.493a1 1 0 00-.949-.684H5z" />
                </svg>
             </div>
        </div>

      </div>
    );
  }

  // 3. CALENDAR VIEW (Booking Success)
  if (mode === ViewMode.CALENDAR && appointment) {
    return <CalendarView appointment={appointment} onAddToCalendar={onAddToCalendar} />;
  }

  // 4. MAP VIEW (Default)
  return (
    <div className="h-full w-full relative">
       {/* Map Overlay or Component */}
       <MapComponent 
         places={places} 
         selectedPlaceId={selectedPlaceId}
         onSelectPlace={onSelectPlace}
       />
       
       {/* List overlay for accessibility/easier selection */}
       {places.length > 0 && mode === ViewMode.MAP && (
         <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-xl p-4 max-h-48 overflow-y-auto z-10">
            <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Nearby Results</h3>
            <div className="space-y-2">
              {places.map(place => (
                <div 
                  key={place.id}
                  onClick={() => onSelectPlace(place.id)}
                  className={`p-3 rounded-lg cursor-pointer border flex justify-between items-center transition-colors ${selectedPlaceId === place.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                >
                  <div>
                    <div className="font-bold text-gray-800">{place.name}</div>
                    <div className="text-xs text-gray-500">{place.address}</div>
                    <div className="text-xs text-blue-500 mt-1">{place.phoneNumber}</div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-amber-500">★ {place.rating}</span>
                    <span className="text-[10px] text-gray-400">({place.userRatingCount})</span>
                  </div>
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
};

export default DynamicPanel;
