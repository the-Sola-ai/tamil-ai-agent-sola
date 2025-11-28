import React, { useState } from 'react';
import { Appointment } from '../types';

interface CalendarViewProps {
  appointment: Appointment;
  onAddToCalendar?: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ appointment, onAddToCalendar }) => {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCalendar = async () => {
    if (onAddToCalendar) {
      setIsAdding(true);
      onAddToCalendar();
      // Reset after 2 seconds
      setTimeout(() => setIsAdding(false), 2000);
    }
  };

  return (
    <div className="h-full w-full bg-white flex flex-col p-8 items-center justify-center">
      <div className="bg-green-50 p-8 rounded-2xl border-2 border-green-100 shadow-sm max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
        <p className="text-gray-500 mb-6">Your appointment has been added to your calendar.</p>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left mb-6">
           <div className="flex items-start mb-4">
             <div className="bg-blue-100 p-2 rounded-lg mr-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
               </svg>
             </div>
             <div>
               <p className="text-xs text-gray-400 font-semibold uppercase">Location</p>
               <p className="font-medium text-gray-800">{appointment.providerName}</p>
             </div>
           </div>

           <div className="flex items-start mb-4">
             <div className="bg-purple-100 p-2 rounded-lg mr-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
             </div>
             <div>
               <p className="text-xs text-gray-400 font-semibold uppercase">Date & Time</p>
               <p className="font-medium text-gray-800">
                 {appointment.date.toLocaleDateString()} at {appointment.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </p>
             </div>
           </div>

           <div className="flex items-start">
             <div className="bg-orange-100 p-2 rounded-lg mr-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
               </svg>
             </div>
             <div>
               <p className="text-xs text-gray-400 font-semibold uppercase">Service</p>
               <p className="font-medium text-gray-800">{appointment.serviceType}</p>
             </div>
           </div>
        </div>

        {/* Manual "Add to Calendar" button for testing */}
        <button
          onClick={handleAddToCalendar}
          disabled={isAdding}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
            isAdding
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }`}
        >
          {isAdding ? '🔄 Adding to Google Calendar...' : '📅 Add to Google Calendar'}
        </button>
      </div>
    </div>
  );
};

export default CalendarView;
