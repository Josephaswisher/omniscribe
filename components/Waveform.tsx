import React, { useEffect, useRef } from 'react';
import { WaveformProps } from '../types';

const Waveform: React.FC<WaveformProps> = ({
  data,
  isRecording,
  isPaused,
  progress = 0,
  height = 60,
  barWidth = 3,
  barGap = 2,
  primaryColor = '#818cf8',
  secondaryColor = '#334155',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      const totalBars = Math.floor(rect.width / (barWidth + barGap));
      const displayData = data.length > 0 
        ? data.slice(-totalBars) 
        : new Array(totalBars).fill(0.1);

      const centerY = rect.height / 2;

      displayData.forEach((value, index) => {
        const x = index * (barWidth + barGap);
        const barHeight = Math.max(4, value * (rect.height - 8));
        const y = centerY - barHeight / 2;

        const progressRatio = progress > 0 ? index / displayData.length : (isRecording ? 1 : 0.5);
        
        if (isRecording && !isPaused) {
          const pulseOffset = Math.sin(Date.now() / 200 + index * 0.3) * 0.15;
          const adjustedHeight = barHeight * (1 + pulseOffset);
          const adjustedY = centerY - adjustedHeight / 2;
          
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.roundRect(x, adjustedY, barWidth, adjustedHeight, [barWidth / 2]);
          ctx.fill();
        } else {
          const isPlayed = index / displayData.length <= progressRatio;
          ctx.fillStyle = isPlayed ? primaryColor : secondaryColor;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2]);
          ctx.fill();
        }
      });

      if (isRecording && !isPaused) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, isRecording, isPaused, progress, height, barWidth, barGap, primaryColor, secondaryColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height }}
    />
  );
};

export default Waveform;
