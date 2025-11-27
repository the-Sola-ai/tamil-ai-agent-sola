import React, { useEffect, useRef } from 'react';
import { Place } from '../types';

declare var google: any;

interface MapComponentProps {
  places: Place[];
  selectedPlaceId?: string;
  onSelectPlace: (id: string) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ places, selectedPlaceId, onSelectPlace }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Check if Google Maps script is loaded
    if (typeof google === 'undefined' || !google.maps) {
      // If no key or script failure, show a placeholder
      mapRef.current.innerHTML = '<div class="flex items-center justify-center h-full bg-gray-200 text-gray-500">Map Unavailable (Check API Key)</div>';
      return;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: 13.0827, lng: 80.2707 }, // Default to Chennai
        zoom: 12,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: [
          {
            "featureType": "poi",
            "elementType": "labels",
            "stylers": [{ "visibility": "off" }]
          }
        ]
      });
    }
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Clear old markers
    markersRef.current.forEach((m: any) => m.setMap(null));
    markersRef.current = [];

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    places.forEach((place) => {
      if (!place.location) return;
      
      const isSelected = place.id === selectedPlaceId;

      const marker = new google.maps.Marker({
        position: place.location,
        map: mapInstanceRef.current,
        title: place.name,
        animation: isSelected ? google.maps.Animation.BOUNCE : null,
        icon: isSelected ? {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        } : undefined
      });

      marker.addListener("click", () => {
        onSelectPlace(place.id);
      });

      markersRef.current.push(marker);
      bounds.extend(place.location);
    });

    if (places.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      // Don't zoom in too close
      const listener = google.maps.event.addListener(mapInstanceRef.current, "idle", () => { 
        if (mapInstanceRef.current && mapInstanceRef.current.getZoom() > 16) mapInstanceRef.current.setZoom(16); 
        google.maps.event.removeListener(listener); 
      });
    }

  }, [places, selectedPlaceId, onSelectPlace]);

  return <div ref={mapRef} className="w-full h-full bg-gray-200" />;
};

export default MapComponent;