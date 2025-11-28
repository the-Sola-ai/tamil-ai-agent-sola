
import { GoogleGenAI } from "@google/genai";
import { Place, BookingDetails } from "../types";

const apiKey = process.env.API_KEY || ''; 
export const ai = new GoogleGenAI({ apiKey });

// --- USER SESSION CONFIGURATION ---

export const getUserSystemInstruction = (lastBookingStatus?: string) => `
You are Sola, a personal assistant for the USER. 
You speak in a friendly mix of English and Tamil (Chennai style).

YOUR GOAL:
1. Help the user find a service (Saloon, Doctor, etc.).
2. Show them options using 'findPlaces'.
3. Select a specific place using 'selectProvider'.
4. CRITICAL: Before booking, you MUST collect: Service Type, Date, and Time.
5. Once you have ALL details, call the 'initiateCall' tool to start the booking call.

CONTEXT:
${lastBookingStatus ? `The previous booking call status was: ${lastBookingStatus}. Inform the user about this result.` : ''}

RULES:
- You have access to the phone numbers of these places.
- If the user says "Call them" or "Book it", check if you have Date and Time. If yes, use 'initiateCall'.
- Do NOT pretend to make the call yourself in *this* session. You must use the 'initiateCall' tool to switch to the phone mode.
`;

export const userTools = [
  {
    functionDeclarations: [
      {
        name: "findPlaces",
        description: "Search for nearby places like saloons, doctors, etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The search query (e.g., 'saloon nearby')" }
          },
          required: ["query"]
        }
      },
      {
        name: "selectProvider",
        description: "Select a specific provider from the map list.",
        parameters: {
          type: "OBJECT",
          properties: {
            providerId: { type: "STRING", description: "The ID of the selected provider" }
          },
          required: ["providerId"]
        }
      },
      {
        name: "initiateCall",
        description: "Switch to the calling session to contact the receptionist.",
        parameters: {
          type: "OBJECT",
          properties: {
            placeId: { type: "STRING" },
            service: { type: "STRING" },
            date: { type: "STRING", description: "YYYY-MM-DD" },
            time: { type: "STRING", description: "HH:MM format" }
          },
          required: ["placeId", "service", "date", "time"]
        }
      }
    ]
  }
];

// --- RECEPTIONIST SESSION CONFIGURATION ---

export const getReceptionistSystemInstruction = (details: BookingDetails) => `
You are Sola. You have just dialed the number for "${details.placeName}".
The connection is established. The person on the other end is the RECEPTIONIST (User roleplay).

YOUR TASK:
1. Start speaking IMMEDIATELY. Do NOT wait for them to say hello.
2. Say something like: "Vanakkam, is this ${details.placeName}?"
3. Ask to book an appointment for "${details.service}" on ${details.date} at ${details.time}.
4. Be polite but persistent. If they say no, ask for an alternative time.
5. Once a time is agreed or rejected, use the 'reportBookingOutcome' tool.

CRITICAL:
- You are making the phone call. YOU SPEAK FIRST.
- Speak in a natural, slightly formal Tanglish/tamil mix like a normal tamil person appropriate for a phone call.
- Do not greet the user as "User". Treat them as the "Sir/Madam" at the reception desk.
`;

export const receptionistTools = [
  {
    functionDeclarations: [
      {
        name: "reportBookingOutcome",
        description: "Report the final result of the phone call.",
        parameters: {
          type: "OBJECT",
          properties: {
            success: { type: "BOOLEAN" },
            finalDate: { type: "STRING" },
            finalTime: { type: "STRING" },
            notes: { type: "STRING", description: "Any notes from the receptionist" }
          },
          required: ["success"]
        }
      }
    ]
  }
];


// --- UTILITIES ---

export const searchPlacesWithGrounding = async (query: string, userLocation?: {lat: number, lng: number}): Promise<Place[]> => {
  try {
    const model = 'gemini-2.5-flash';
    const config: any = {
      tools: [{ googleMaps: {} }],
    };
    
    if (userLocation) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userLocation.lat,
            longitude: userLocation.lng
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents: `Find ${query} nearby. List 5 options.`,
      config
    });

    // In a real implementation, parse groundingChunks.maps
    // For this demo, we mock if grounding fails or returns strictly text
    
    return [
      { id: '1', name: 'Chennai Classic Saloon', address: '12, Anna Salai, Chennai', phoneNumber: '+91 98765 43210', rating: 4.5, userRatingCount: 120, location: { lat: 13.0827, lng: 80.2707 } },
      { id: '2', name: 'Velachery Spa & Saloon', address: '45, Bypass Rd, Velachery', phoneNumber: '044 2244 6688', rating: 4.2, userRatingCount: 85, location: { lat: 12.9815, lng: 80.2180 } },
      { id: '3', name: 'Style Cuts', address: '8, T Nagar, Chennai', phoneNumber: '+91 91234 56789', rating: 4.8, userRatingCount: 340, location: { lat: 13.0418, lng: 80.2341 } },
      { id: '4', name: 'Green Trends', address: 'Mylapore, Chennai', phoneNumber: '044 2468 1357', rating: 4.3, userRatingCount: 210, location: { lat: 13.0368, lng: 80.2676 } },
      { id: '5', name: 'Naturals', address: 'Adyar, Chennai', phoneNumber: '+91 99887 76655', rating: 4.6, userRatingCount: 190, location: { lat: 13.0012, lng: 80.2565 } },
    ];

  } catch (error) {
    console.error("Error searching places:", error);
    return [];
  }
};
