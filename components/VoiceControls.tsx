import React, { useEffect, useRef } from 'react';

interface VoiceControlsProps {
  isActive: boolean;
  onToggle: () => void;
  volumeLevel: number;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({ isActive, onToggle, volumeLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (isActive) {
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 5;
        // Visualizer based on volume
        const radius = 20 + Math.min(volumeLevel * 100, maxRadius); 
        
        ctx.beginPath();
        ctx.arc(width / 2, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; // Red-500 with opacity
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width / 2, centerY, 15, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444'; // Red-500
        ctx.fill();
        
        // Ripple effect
        ctx.beginPath();
        ctx.arc(width / 2, centerY, radius + 10, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.stroke();
      } else {
         // Mic icon state
         const centerX = width / 2;
         const centerY = height / 2;
         
         ctx.beginPath();
         ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
         ctx.fillStyle = '#3b82f6'; // Blue-500
         ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [isActive, volumeLevel]);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div 
        className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95"
        onClick={onToggle}
      >
        <canvas 
          ref={canvasRef} 
          width={120} 
          height={120} 
          className="rounded-full"
        />
        {!isActive && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>
           </div>
        )}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
             </svg>
          </div>
        )}
      </div>
      <p className="mt-4 text-gray-600 font-medium">
        {isActive ? "Sola is listening..." : "Tap to speak to Sola"}
      </p>
    </div>
  );
};

export default VoiceControls;
