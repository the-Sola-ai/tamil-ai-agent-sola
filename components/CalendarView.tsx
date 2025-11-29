import React, { useState, useEffect } from 'react';
import { Appointment, BookingDetails } from '../types';

interface CalendarViewProps {
  appointment: Appointment;
  bookingDetails?: BookingDetails;
  onAddToCalendar?: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ appointment, bookingDetails, onAddToCalendar }) => {
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    // reset spinner if appointment changed
    setIsAdding(false);
  }, [appointment, bookingDetails]);

  const handleAddToCalendar = async () => {
    if (onAddToCalendar && bookingDetails?.status === 'confirmed') {
      setIsAdding(true);
      try {
        await onAddToCalendar();
      } finally {
        // small UX delay
        setTimeout(() => setIsAdding(false), 800);
      }
    }
  };

  // Only show confirmed UI when bookingDetails explicitly reports 'confirmed'
  if (!bookingDetails || bookingDetails.status === 'negotiating') {
    return (
      <div className="h-full w-full bg-gradient-to-b from-[#071021] to-[#04111b] flex flex-col p-8 items-center justify-center text-gray-100">
        <div className="bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-8 rounded-2xl border border-gray-800 shadow-2xl max-w-md w-full text-center backdrop-blur-sm">
          <div className="w-16 h-16 bg-[rgba(255,255,255,0.02)] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {bookingDetails ? 'Booking Pending' : 'No Booking'}
          </h2>

          <p className="text-gray-400 mb-6">
            {bookingDetails
              ? 'Your booking is still being confirmed by the provider. It will appear here once the call succeeds.'
              : 'You do not have a confirmed booking yet.'}
          </p>

          <div className="bg-[rgba(0,0,0,0.35)] rounded-xl p-4 shadow-sm border border-gray-800 text-left mb-6">
             <div className="flex items-start mb-4">
               <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-lg mr-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
               </div>
               <div>
                 <p className="text-xs text-gray-400 font-semibold uppercase">Location</p>
                 <p className="font-medium text-white">{appointment.providerName}</p>
               </div>
             </div>

             <div className="flex items-start mb-4">
               <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-lg mr-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                 </svg>
               </div>
               <div>
                 <p className="text-xs text-gray-400 font-semibold uppercase">Date & Time</p>
                 <p className="font-medium text-white">
                   {appointment.date.toLocaleDateString()} at {appointment.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                 </p>
               </div>
             </div>

             <div className="flex items-start">
               <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-lg mr-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                 </svg>
               </div>
               <div>
                 <p className="text-xs text-gray-400 font-semibold uppercase">Service</p>
                 <p className="font-medium text-white">{appointment.serviceType}</p>
               </div>
             </div>
          </div>

          <button
            disabled
            className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-600 text-white cursor-not-allowed"
          >
            Add to Google Calendar
          </button>
        </div>
      </div>
    );
  }

  // If bookingDetails explicitly reports 'failed' show cancelled state
  if (bookingDetails?.status === 'failed') {
    return (
      <div className="h-full w-full bg-gradient-to-b from-[#071021] to-[#04111b] flex flex-col p-8 items-center justify-center text-gray-100">
        <div className="bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-8 rounded-2xl border border-gray-800 shadow-2xl max-w-md w-full text-center backdrop-blur-sm">
          <div className="w-16 h-16 bg-red-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Booking Cancelled</h2>
          <p className="text-gray-400 mb-6">The call ended before the provider confirmed the appointment. No booking was made.</p>

          <button
            disabled
            className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-700 text-white cursor-not-allowed"
          >
            Add to Google Calendar
          </button>
        </div>
      </div>
    );
  }

  // Normal confirmed UI — requires bookingDetails.status === 'confirmed'
  const isConfirmed = bookingDetails?.status === 'confirmed';

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#071021] to-[#04111b] flex flex-col p-8 items-center justify-center text-gray-100">
      <div className="bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-8 rounded-2xl border border-gray-800 shadow-2xl max-w-md w-full text-center backdrop-blur-sm">
        <div className="w-16 h-16 bg-gradient-to-br from-green-700 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h2>
        <p className="text-gray-400 mb-6">Your appointment has been added to your calendar.</p>

        <div className="bg-[rgba(0,0,0,0.35)] rounded-xl p-4 shadow-sm border border-gray-800 text-left mb-6">
           <div className="flex items-start mb-4">
             <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-lg mr-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
               </svg>
             </div>
             <div>
               <p className="text-xs text-gray-400 font-semibold uppercase">Location</p>
               <p className="font-medium text-white">{appointment.providerName}</p>
             </div>
           </div>

           <div className="flex items-start mb-4">
             <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-lg mr-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
             </div>
             <div>
               <p className="text-xs text-gray-400 font-semibold uppercase">Date & Time</p>
               <p className="font-medium text-white">
                 {appointment.date.toLocaleDateString()} at {appointment.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </p>
             </div>
           </div>

           <div className="flex items-start">
             <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-lg mr-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
               </svg>
             </div>
             <div>
               <p className="text-xs text-gray-400 font-semibold uppercase">Service</p>
               <p className="font-medium text-white">{appointment.serviceType}</p>
             </div>
           </div>
        </div>

        <button
          onClick={handleAddToCalendar}
          disabled={!isConfirmed || isAdding}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${isAdding ? 'bg-gray-600 text-white cursor-not-allowed' : (isConfirmed ? 'bg-violet-600 text-white hover:bg-violet-700 active:scale-95' : 'bg-gray-700 text-gray-300 cursor-not-allowed')}`}
        >
          {isAdding ? '🔄 Adding to Google Calendar...' : '📅 Add to Google Calendar'}
        </button>
      </div>
    </div>
  );
};

export default CalendarView;
