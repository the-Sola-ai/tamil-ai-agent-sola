import React, { useEffect, useRef, useState } from 'react';
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
  volumeLevel: number;
  onAddToCalendar?: () => void;
  // NEW: callbacks to control call lifecycle / cancel booking from UI
  onEndCall?: () => void;
  onCancelBooking?: () => void;
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
  onAddToCalendar,
  onEndCall,
  onCancelBooking
}) => {
  const isDialing = bookingDetails?.status === 'negotiating' && !isCallingReceptionist;

  // Track whether parent has provided results *after mount*.
  const initialPlacesRef = useRef<Place[] | null>(null);
  const [showPlaces, setShowPlaces] = useState(false);

  useEffect(() => {
    if (initialPlacesRef.current === null) {
      initialPlacesRef.current = places;
      return;
    }
    if (initialPlacesRef.current !== places) {
      setShowPlaces(true);
    }
  }, [places]);

  // Call timer for live call UI
  const [callSeconds, setCallSeconds] = useState(0);
  useEffect(() => {
    let t: number | undefined;
    if (isCallingReceptionist) {
      t = window.setInterval(() => setCallSeconds(s => s + 1), 1000);
    } else {
      setCallSeconds(0);
    }
    return () => { if (t) clearInterval(t); };
  }, [isCallingReceptionist]);

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Whether to show the phone overlay (either dialing or in-call)
  const phoneVisible = isDialing || isCallingReceptionist;

  // Small reusable button for controls
  const ActionButton: React.FC<{
    label: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    variant?: 'circle' | 'square';
    children?: React.ReactNode;
  }> = ({ label, onClick, active, disabled, ariaLabel, variant = 'square', children }) => {
    const base =
      "flex flex-col items-center gap-2 text-xs select-none";
    const btnCommon =
      "inline-flex items-center justify-center transition-transform transform-gpu focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500";
    const squareClasses =
      "w-14 h-14 rounded-xl bg-[#07121a] border border-gray-800 flex items-center justify-center shadow-sm hover:scale-105";
    const circleClasses =
      "w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg";

    return (
      <div className={base} aria-hidden={disabled}>
        <button
          onClick={onClick}
          aria-label={ariaLabel || label}
          disabled={disabled}
          className={`${btnCommon} ${variant === 'square' ? squareClasses : circleClasses} ${disabled ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
          title={label}
          type="button"
        >
          {children}
        </button>
        <div className="text-[11px] text-gray-300">{label}</div>
      </div>
    );
  };

  // ---------- PHONE UI (shared container) ----------
  const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <>
        {/* Dimmed backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          style={{ pointerEvents: 'auto' }}
        />
        {/* Centered phone shell */}
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="
              relative
              w-full max-w-[420px]
              h-[90vh] md:h-[720px]
              bg-[#071520]
              rounded-3xl
              shadow-2xl
              border border-gray-800
              overflow-hidden
              flex flex-col
            "
            role="dialog"
            aria-modal="true"
          >
            {/* content area is scrollable to avoid clipping on short screens */}
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </div>
        </div>
      </>
    );
  };

  // ---------------- Phone-like Dialing Screen ----------------
  if (isDialing) {
    const selectedPlace = places.find(p => p.id === bookingDetails?.placeId);
    const displayName = selectedPlace?.name || bookingDetails?.placeName || 'Unknown';
    const displayNumber = selectedPlace?.phoneNumber || '•••• ••• ••••';

    return (
      <>
        {/* keep the map visible under the overlay but dim and not interactive */}
        <div className="h-full w-full relative pointer-events-none select-none">
          <MapComponent places={places} selectedPlaceId={selectedPlaceId} onSelectPlace={onSelectPlace} />
        </div>

        <PhoneShell>
          <div className="px-6 pt-6 pb-4">
            {/* top notch / status */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-medium">Calling</span>
              </div>
              <div className="text-xs text-gray-400">—</div>
            </div>

            {/* caller avatar and details */}
            <div className="flex flex-col items-center text-center mt-6">
              <div className="w-36 h-36 rounded-full bg-gradient-to-br from-[#0f1724] to-[#071021] border-4 border-[#071821] flex items-center justify-center shadow-xl">
                <span className="text-5xl font-bold text-gray-300">{displayName.charAt(0)}</span>
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-white">{displayName}</h2>
              <p className="text-sm text-gray-400 mt-1">{displayNumber}</p>

              <div className="mt-4">
                <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-[rgba(255,255,255,0.02)] px-3 py-1 rounded-full border border-gray-800">
                  <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 106.32 17.76L21 22l-2.24-2.24A10 10 0 0012 2z"/></svg>
                  Ringing...
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-400">
                Service: <span className="text-gray-200 font-medium">{bookingDetails?.service}</span>
              </div>

              {/* NOTE: removed the large decorative initiating circle per request */}
            </div>
          </div>

          {/* footer / controls */}
          <div className="px-6 pb-6 md:absolute md:bottom-6 md:left-6 md:right-6 md:flex md:items-center md:justify-between md:gap-4">
            <div className="flex gap-6 justify-center md:justify-start w-full">
              {/* Mute */}
              <ActionButton
                ariaLabel="Mute"
                label="Mute"
                onClick={() => { /* keep behaviour same, add handler later */ }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 9v6a3 3 0 0 0 6 0v-1" />
                  <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </ActionButton>

              {/* Keypad */}
              <ActionButton
                ariaLabel="Keypad"
                label="Keypad"
                onClick={() => { /* keep behaviour same, add handler later */ }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M8 8h.01M16 8h.01M8 12h.01M16 12h.01M8 16h.01M16 16h.01" />
                </svg>
              </ActionButton>

              {/* Speaker */}
              <ActionButton
                ariaLabel="Speaker"
                label="Speaker"
                onClick={() => { /* keep behaviour same, add handler later */ }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5l6 4v6l-6 4v-14z" />
                  <path d="M5 9v6" />
                </svg>
              </ActionButton>
            </div>

            <div className="flex flex-col items-center mt-4 md:mt-0">
              {/* End call button -> calls onEndCall when provided */}
              <ActionButton
                ariaLabel="End call"
                label="End"
                onClick={() => onEndCall?.()}
                variant="circle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-18 0" />
                  <path d="M16 8l-8 8" />
                </svg>
              </ActionButton>
            </div>
          </div>

          {/* small status row (keeps inside scroll area on small screens) */}
          <div className="px-6 pb-6">
            <div className="w-full rounded-md bg-[rgba(255,255,255,0.02)] border border-gray-800 px-4 py-3 flex items-center justify-between text-sm text-gray-300">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <div>Connecting to receptionist</div>
              </div>
              <div className="font-mono text-xs">{bookingDetails?.date} • {bookingDetails?.time}</div>
            </div>
          </div>
        </PhoneShell>
      </>
    );
  }

  // ---------------- Phone-like In-Call Screen ----------------
  if (isCallingReceptionist) {
    const selectedPlace = places.find(p => p.id === bookingDetails?.placeId);
    const displayName = selectedPlace?.name || bookingDetails?.placeName || 'Unknown';
    const phoneNumber = selectedPlace?.phoneNumber || '—';

    // only enable Save (calendar) when booking confirmed
    const saveEnabled = bookingDetails?.status === 'confirmed' && !!onAddToCalendar;

    return (
      <>
        {/* dimmed background map not interactive */}
        <div className="h-full w-full relative pointer-events-none select-none">
          <MapComponent places={places} selectedPlaceId={selectedPlaceId} onSelectPlace={onSelectPlace} />
        </div>

        <PhoneShell>
          <div className="px-6 pt-6 pb-4">
            {/* top status */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 106.32 17.76L21 22l-2.24-2.24A10 10 0 0012 2z"/></svg>
                <span className="font-medium">On Call</span>
              </div>
              <div className="text-xs">{formatTime(callSeconds)}</div>
            </div>

            {/* caller block */}
            <div className="flex flex-col items-center text-center mt-6">
              <div className="w-36 h-36 rounded-full bg-gradient-to-br from-[#0f1724] to-[#071021] border-4 border-[#071821] flex items-center justify-center shadow-xl">
                <span className="text-5xl font-bold text-gray-300">{displayName.charAt(0)}</span>
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-white">{displayName}</h2>
              <p className="text-sm text-gray-400 mt-1">{phoneNumber}</p>

              <div className="mt-3 flex items-center gap-3">
                <div className="text-xs text-gray-400 px-2 py-1 rounded bg-[rgba(255,255,255,0.02)] border border-gray-800">{bookingDetails?.service}</div>
                <div className="text-xs text-gray-400 px-2 py-1 rounded bg-[rgba(255,255,255,0.02)] border border-gray-800">HD Voice</div>
              </div>
            </div>
          </div>

          {/* waveform / visual */}
          <div className="px-6">
            <div className="w-full h-20 rounded-lg bg-[rgba(0,0,0,0.45)] border border-gray-800 flex items-end px-2 overflow-hidden">
              {Array.from({ length: 48 }).map((_, i) => {
                const base = 6;
                const wave = Math.abs(Math.sin(i * 0.2 + (Date.now() / 400)));
                const h = Math.max(base, Math.min(70, base + wave * (12 + volumeLevel * 90)));
                return <div key={i} className="w-1.5 mx-0.5 bg-gradient-to-t from-green-400 to-green-300 rounded-t" style={{ height: `${h}px` }} />;
              })}
            </div>
          </div>

          {/* call detail card */}
          <div className="px-6 mt-6">
            <div className="w-full bg-[rgba(255,255,255,0.02)] border border-gray-800 rounded-lg p-4 text-sm text-gray-300">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-400 uppercase">Booking Request</div>
                  <div className="text-sm font-medium text-white mt-1">{bookingDetails?.service} • {bookingDetails?.date} {bookingDetails?.time}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Status</div>
                  <div className="text-sm font-semibold text-green-300 mt-1">{bookingDetails?.status === 'confirmed' ? 'Confirmed' : 'Negotiating'}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">Notes: Receptionist checking availability and timeslots.</div>
            </div>
          </div>

          {/* actions */}
          <div className="px-6 pb-6 md:absolute md:bottom-6 md:left-6 md:right-6 flex gap-3 items-center justify-between">
            <div className="flex gap-6">
              <ActionButton
                ariaLabel="Mute"
                label="Mute"
                onClick={() => { /* mute toggle placeholder */ }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 9v6a3 3 0 0 0 6 0v-1" />
                  <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </ActionButton>

              <ActionButton
                ariaLabel="Keypad"
                label="Keypad"
                onClick={() => { /* keypad placeholder */ }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M8 8h.01M16 8h.01M8 12h.01M16 12h.01M8 16h.01M16 16h.01" />
                </svg>
              </ActionButton>

              <ActionButton
                ariaLabel="Speaker"
                label="Speaker"
                onClick={() => { /* speaker placeholder */ }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5l6 4v6l-6 4v-14z" />
                  <path d="M5 9v6" />
                </svg>
              </ActionButton>
            </div>

            <div className="flex items-center gap-3">
              {/* Save only enabled after confirmation */}
              <button
                onClick={() => { if (saveEnabled) onAddToCalendar?.(); }}
                disabled={!saveEnabled}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${saveEnabled ? 'bg-[#0ea5a6] text-black' : 'bg-[rgba(255,255,255,0.02)] text-gray-500 cursor-not-allowed'}`}
              >
                {saveEnabled ? 'Save' : 'Save'}
              </button>

              {/* End call -> calls onEndCall */}
              <ActionButton
                ariaLabel="End call"
                label=""
                onClick={() => {
                  // if call ended before confirmation, cancel the booking draft
                  if (bookingDetails && bookingDetails.status !== 'confirmed') {
                    onCancelBooking?.();
                  }
                  onEndCall?.();
                }}
                variant="circle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </ActionButton>
            </div>
          </div>
        </PhoneShell>
      </>
    );
  }

  // Calendar view — pass bookingDetails down so calendar can validate confirmation status
  if (mode === ViewMode.CALENDAR && appointment) {
    return <CalendarView appointment={appointment} bookingDetails={bookingDetails} onAddToCalendar={onAddToCalendar} />;
  }

  // Default map + optional results
  return (
    <div className="h-full w-full relative">
      {/* normal interactive map when phone overlay not visible */}
      <div className={`${phoneVisible ? 'pointer-events-none opacity-60' : 'pointer-events-auto'} h-full w-full`}>
        <MapComponent
          places={places}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={onSelectPlace}
        />
      </div>

      {/* Only show the results list when `places` was updated after mount (i.e. user asked / search returned results) */}
      {showPlaces && places.length > 0 && mode === ViewMode.MAP && !phoneVisible && (
        <div className="absolute bottom-4 left-4 right-4 bg-[rgba(0,0,0,0.6)] rounded-xl shadow-xl p-4 max-h-48 overflow-y-auto z-10 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">Nearby Results</h3>
          <div className="space-y-2">
            {places.map(place => (
              <div
                key={place.id}
                onClick={() => onSelectPlace(place.id)}
                className={`p-3 rounded-lg cursor-pointer border flex justify-between items-center transition-colors ${selectedPlaceId === place.id ? 'bg-gradient-to-r from-violet-700 to-violet-600 border-transparent text-white' : 'bg-[rgba(255,255,255,0.02)] border border-gray-800 hover:bg-[rgba(255,255,255,0.03)]'}`}
              >
                <div>
                  <div className="font-bold text-white">{place.name}</div>
                  <div className="text-xs text-gray-400">{place.address}</div>
                  <div className="text-xs text-violet-300 mt-1">{place.phoneNumber}</div>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-amber-400">★ {place.rating}</span>
                  <span className="text-[10px] text-gray-400">({place.userRatingCount})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hint when user hasn't asked yet */}
      {!showPlaces && mode === ViewMode.MAP && !phoneVisible && (
        <div className="absolute bottom-6 left-6 z-10">
          <div className="px-3 py-2 rounded-md bg-[rgba(0,0,0,0.5)] border border-gray-800 text-sm text-gray-300">
            Say “Find a salon nearby” to show results.
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicPanel;
