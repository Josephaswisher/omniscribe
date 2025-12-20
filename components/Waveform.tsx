import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { WaveformProps } from '../types';

// Polyfill for roundRect
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, [radius]);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
}

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Setup canvas dimensions on mount and resize
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      // Ensure we have valid dimensions
      const containerWidth = rect.width > 0 ? rect.width : 300;
      canvas.width = containerWidth * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${height}px`;
    };

    // Initial resize
    resizeCanvas();
    
    // Use ResizeObserver for more reliable updates
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      resizeObserver.disconnect();
    };
  }, [height]);

  // Draw waveform whenever data or state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;
    
    // Skip drawing if dimensions aren't set yet
    if (width <= 0 || canvasHeight <= 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, canvasHeight);

    // Limit bars to prevent performance issues on wide screens
    const maxBars = 100;
    const calculatedBars = Math.floor(width / (barWidth + barGap));
    const totalBars = Math.min(calculatedBars, maxBars);
    
    const displayData = data.length > 0 
      ? data.slice(-totalBars) 
      : new Array(totalBars).fill(0.15);

    // Pad with empty bars on the left if needed
    while (displayData.length < totalBars) {
      displayData.unshift(0.15);
    }

    const centerY = canvasHeight / 2;
    const radius = Math.min(barWidth / 2, 2);
    
    // Center the waveform if we're limiting bars
    const waveformWidth = totalBars * (barWidth + barGap);
    const offsetX = Math.max(0, (width - waveformWidth) / 2);

    displayData.forEach((value, index) => {
      const x = offsetX + index * (barWidth + barGap);
      const barHeight = Math.max(4, value * (canvasHeight - 8));
      const y = centerY - barHeight / 2;

      if (isRecording) {
        ctx.fillStyle = isPaused ? secondaryColor : primaryColor;
      } else {
        const progressRatio = progress > 0 ? progress : 0.5;
        const isPlayed = index / displayData.length <= progressRatio;
        ctx.fillStyle = isPlayed ? primaryColor : secondaryColor;
      }

      drawRoundedRect(ctx, x, y, barWidth, barHeight, radius);
    });
  }, [data, isRecording, isPaused, progress, barWidth, barGap, primaryColor, secondaryColor]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default Waveform;
