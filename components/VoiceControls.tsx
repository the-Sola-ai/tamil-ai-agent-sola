import React, { useEffect, useRef } from 'react';

interface VoiceControlsProps {
  isActive: boolean;
  onToggle: () => void;
  volumeLevel: number;
}

type Bubble = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  life: number;
  maxLife: number;
};

const VoiceControls: React.FC<VoiceControlsProps> = ({ isActive, onToggle, volumeLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const lastSpawnRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // scale for high-DPI
    const DPR = window.devicePixelRatio || 1;
    const logicalW = 140;
    const logicalH = 140;
    canvas.width = logicalW * DPR;
    canvas.height = logicalH * DPR;
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    ctx.scale(DPR, DPR);

    let animationId = 0;
    lastSpawnRef.current = Date.now();

    const spawnBubble = () => {
      // spawn position around center with slight random offset
      const cx = logicalW / 2;
      const cy = logicalH / 2;
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 18;
      const x = cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 6;
      const y = cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 6;
      const r = 4 + Math.random() * 8 + (volumeLevel * 10);
      const vy = -0.2 - Math.random() * 0.6 - volumeLevel * 1.5;
      const vx = (Math.random() - 0.5) * 0.6;
      const maxLife = 120 + Math.floor(Math.random() * 80);
      const bubble: Bubble = {
        x, y, r, vy, vx, alpha: 0.7 + Math.random() * 0.25, life: 0, maxLife
      };
      bubblesRef.current.push(bubble);
      // cap
      if (bubblesRef.current.length > 30) bubblesRef.current.shift();
    };

    const draw = () => {
      ctx.clearRect(0, 0, logicalW, logicalH);

      // background subtle glow when active
      if (isActive) {
        const grad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 6, logicalW / 2, logicalH / 2, 80);
        grad.addColorStop(0, 'rgba(124,58,237,0.12)');
        grad.addColorStop(1, 'rgba(124,58,237,0.00)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, logicalW, logicalH);
      }

      // spawn bubbles at a rate influenced by volumeLevel
      const now = Date.now();
      const spawnInterval = Math.max(60, 220 - volumeLevel * 180); // louder = more bubbles
      if (isActive && now - lastSpawnRef.current > spawnInterval) {
        const spawnCount = 1 + Math.floor(volumeLevel * 2);
        for (let i = 0; i < spawnCount; i++) spawnBubble();
        lastSpawnRef.current = now;
      }

      // update & draw bubbles
      for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
        const b = bubblesRef.current[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life++;
        // fade out towards end of life
        const t = b.life / b.maxLife;
        const fade = Math.max(0, 1 - t);
        ctx.beginPath();
        ctx.arc(b.x, b.y - t * 40, b.r * (0.9 + t * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124,58,237,${(b.alpha * fade * 0.9).toFixed(3)})`; // purple-ish
        ctx.fill();
        // remove if dead or out of bounds
        if (b.life >= b.maxLife || b.y + b.r < -20 || b.x < -20 || b.x > logicalW + 20) {
          bubblesRef.current.splice(i, 1);
        }
      }

      // central pulsing rings (react to volume)
      const centerX = logicalW / 2;
      const centerY = logicalH / 2;
      const baseRadius = 14;
      const pulse = 1 + volumeLevel * 1.2;
      // outer ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * (0.9 + 0.25 * Math.sin(now / 200)), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(124,58,237,${(0.22 + volumeLevel * 0.18).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      // inner core glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, 11 * (0.9 + 0.15 * Math.cos(now / 180) * pulse), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(124,58,237,${(0.95 - volumeLevel * 0.2).toFixed(3)})`;
      ctx.fill();

      // mic icon (white) - keep it crisp
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1, 1);
      ctx.beginPath();
      // simple mic shape
      ctx.fillStyle = '#ffffff';
      ctx.moveTo(-6, -4);
      ctx.arc(0, -4, 6, Math.PI, 0);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.beginPath();
      ctx.moveTo(-7, 6);
      ctx.quadraticCurveTo(0, 12, 7, 6);
      ctx.fill();
      ctx.restore();

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      bubblesRef.current = [];
    };
  }, [isActive, volumeLevel]);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div
        className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95"
        onClick={onToggle}
        aria-label="Toggle voice"
      >
        <canvas
          ref={canvasRef}
          width={140}
          height={140}
          className="rounded-full shadow-2xl"
        />
        {/* accessible icon overlay for clarity */}
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
      <p className="mt-4 text-gray-300 font-medium">{isActive ? "Sola is listening..." : "Tap to speak to Sola"}</p>
    </div>
  );
};

export default VoiceControls;
