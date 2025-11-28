import { Appointment } from '../types';

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

export async function addToGoogleCalendar(appointment: Appointment): Promise<{ id: string; link?: string }> {
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

          const start = new Date(appointment.date as any);
          if (isNaN(start.getTime())) return reject(new Error('Invalid appointment date: ' + appointment.date));
          const duration = (appointment as any).durationMinutes ?? 60;
          const end = new Date(start.getTime() + duration * 60000);

          const event = {
            summary: `${(appointment as any).serviceType ?? 'Appointment'}${(appointment as any).providerName ? ' — ' + (appointment as any).providerName : ''}`,
            description: `Booked via app${(appointment as any).location ? ' — ' + (appointment as any).location : ''}`,
            start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
            end:   { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
          };

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
