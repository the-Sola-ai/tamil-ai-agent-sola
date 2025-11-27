
export enum ViewMode {
  MAP = 'MAP',
  PHONE = 'PHONE',
  CALENDAR = 'CALENDAR'
}

export enum SessionMode {
  USER = 'USER',
  RECEPTIONIST = 'RECEPTIONIST'
}

export interface Place {
  id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  location?: {
    lat: number;
    lng: number;
  };
  phoneNumber?: string;
}

export interface BookingDetails {
  placeId: string;
  placeName: string;
  service: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'failed' | 'negotiating';
}

export interface Appointment {
  id: string;
  providerId: string;
  providerName: string;
  date: Date;
  serviceType: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}
