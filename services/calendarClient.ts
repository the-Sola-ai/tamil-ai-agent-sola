// services/calendarClient.ts (replace previous addToGoogleCalendar function with this)
const GOOGLE_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY as string;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID as string;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load script: ' + src));
    document.head.appendChild(s);
  });
}

async function ensureGapiAndGisLoaded() {
  await loadScript('https://accounts.google.com/gsi/client'); // GIS
  await loadScript('https://apis.google.com/js/api.js');     // gapi
  if (!(window as any).gapi) throw new Error('gapi did not load');
  if (!(window as any).google) throw new Error('google (GIS) did not load');
}

// Helper: parse time strings like "11:30 AM", "11:30", "23:15" -> "HH:MM"
function parseTimeToHHMM(t?: string): string | null {
  if (!t) return null;
  const s = String(t).trim().toLowerCase();

  // "hh:mm"
  const hhmmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const h = Number(hhmmMatch[1]);
    const m = hhmmMatch[2].padStart(2, '0');
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m}`;
  }

  // "hh:mm am/pm" or "h:mmam"
  const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/) || s.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (ampmMatch) {
    let h = Number(ampmMatch[1]);
    const m = ampmMatch[2].padStart(2, '0');
    const ampm = ampmMatch[3];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m}`;
  }

  return null;
}

// Helper: Given appointment-like object, coerce into a JS Date (local timezone)
function coerceAppointmentToDate(appointment: any, fallbackTimeMinutes = 60): Date | null {
  // If it's already a Date
  if (appointment?.date instanceof Date && !isNaN(appointment.date.getTime())) {
    return appointment.date;
  }

  // If date is a string that is parseable by Date
  if (typeof appointment?.date === 'string') {
    // try direct ISO parse
    const tryIso = new Date(appointment.date);
    if (!isNaN(tryIso.getTime())) return tryIso;

    // try date-only "YYYY-MM-DD" + time from appointment.time (maybe "11:30 AM")
    const dateOnly = appointment.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, yr, mo, day] = dateOnly;
      // time may be provided separately as appointment.time
      let timeHHMM = parseTimeToHHMM(appointment.time) || parseTimeToHHMM((appointment as any).startTime) || null;
      if (!timeHHMM) {
        // maybe appointment.date itself contained time-like token (e.g., "2025-11-29 11:30")
        const inline = appointment.date.match(/\d{1,2}:\d{2}/);
        if (inline) timeHHMM = inline[0];
      }
      if (!timeHHMM) {
        // fallback to 09:00
        timeHHMM = '09:00';
      }
      const [hh, mm] = timeHHMM.split(':').map(Number);
      // JS Date uses month 0-indexed
      const d = new Date(Number(yr), Number(mo) - 1, Number(day), hh, mm, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // if appointment has separate numeric components (yr, mo, day, hour, minute)
  if (appointment?.year && appointment?.month && appointment?.day) {
    const h = appointment.hour ?? 9;
    const m = appointment.minute ?? 0;
    const d = new Date(appointment.year, appointment.month - 1, appointment.day, h, m, 0);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export async function addToGoogleCalendar(appointment: any): Promise<{ id: string; link?: string }> {
  if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID) {
    throw new Error('Calendar credentials missing (GOOGLE_CALENDAR_API_KEY or GOOGLE_CALENDAR_CLIENT_ID).');
  }

  await ensureGapiAndGisLoaded();

  // Init gapi.client
  await new Promise<void>((resolve, reject) => {
    try {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [DISCOVERY_DOC]
          });
          console.log('[CALENDAR] gapi.client.init OK');
          resolve();
        } catch (err) {
          console.error('[CALENDAR] gapi.client.init failed:', err);
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  return new Promise<{ id: string; link?: string }>(async (resolve, reject) => {
    const gis = (window as any).google?.accounts?.oauth2;
    if (!gis || !gis.initTokenClient) {
      return reject(new Error('GIS token client not available (google.accounts.oauth2.initTokenClient missing)'));
    }

    const tokenClient = gis.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      prompt: '',
      callback: async (tokenResponse: any) => {
        try {
          if (!tokenResponse || !tokenResponse.access_token) {
            console.error('[CALENDAR] tokenResponse:', tokenResponse);
            return reject(new Error('No access token received'));
          }

          (window as any).gapi.client.setToken({ access_token: tokenResponse.access_token });

          // Robustly coerce appointment to Date
          const startDate = coerceAppointmentToDate(appointment);
          if (!startDate || isNaN(startDate.getTime())) {
            console.error('[CALENDAR] Invalid startDate after coercion. appointment=', appointment);
            return reject(new Error('Invalid appointment date: ' + String(appointment.date)));
          }

          const duration = (appointment as any).durationMinutes ?? 60;
          const end = new Date(startDate.getTime() + duration * 60000);

          const event = {
            summary: `${(appointment as any).serviceType ?? 'Appointment'}${(appointment as any).providerName ? ' — ' + (appointment as any).providerName : ''}`,
            description: `Booked via app${(appointment as any).location ? ' — ' + (appointment as any).location : ''}`,
            start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
            end:   { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
          };

          console.log('[CALENDAR] Inserting event:', event);

          const resp = await (window as any).gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event,
          });

          console.log('[CALENDAR] insert response full:', resp);
          if (resp?.result?.id) {
            resolve({ id: resp.result.id, link: resp.result.htmlLink });
          } else {
            reject(new Error('Event insertion succeeded but no id returned: ' + JSON.stringify(resp)));
          }
        } catch (err) {
          console.error('[CALENDAR] insertion failed full:', err);
          try { console.error('stringified:', JSON.stringify(err, null, 2)); } catch (_) {}
          reject(err);
        }
      }
    });

    try {
      tokenClient.requestAccessToken();
    } catch (err) {
      console.error('[CALENDAR] token request error:', err);
      reject(err);
    }
  });
}
