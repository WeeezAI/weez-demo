import { useEffect, useRef, useState, useCallback } from 'react';

interface ScratchCardProps {
  imageSrc: string;
  alt: string;
  className?: string;
  brushSize?: number;
  revealThreshold?: number;
}

export const ScratchCard = ({
  imageSrc,
  alt,
  className = '',
  brushSize = 50,
  revealThreshold = 50,
}: ScratchCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchPercentage, setScratchPercentage] = useState(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, '#7c3aed');
    gradient.addColorStop(0.5, '#8b5cf6');
    gradient.addColorStop(1, '#1f2937');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Add scratch hint text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 18px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ Scratch to reveal', rect.width / 2, rect.height / 2 - 15);
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Drag your mouse here', rect.width / 2, rect.height / 2 + 15);
  }, []);

  useEffect(() => {
    initCanvas();
    
    const handleResize = () => {
      if (!isRevealed) {
        initCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas, isRevealed]);

  const calculateScratchPercentage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;

    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) {
        transparentPixels++;
      }
    }

    return (transparentPixels / (pixels.length / 4)) * 100;
  }, []);

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(x, y);
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    lastPoint.current = { x, y };

    const percentage = calculateScratchPercentage();
    setScratchPercentage(percentage);

    if (percentage >= revealThreshold && !isRevealed) {
      setIsRevealed(true);
    }
  }, [brushSize, calculateScratchPercentage, isRevealed, revealThreshold]);

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isRevealed) return;
    e.preventDefault();
    setIsScratching(true);
    const coords = getCoordinates(e);
    lastPoint.current = coords;
    scratch(coords.x, coords.y);
  }, [getCoordinates, isRevealed, scratch]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isScratching || isRevealed) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    scratch(coords.x, coords.y);
  }, [getCoordinates, isRevealed, isScratching, scratch]);

  const handleEnd = useCallback(() => {
    setIsScratching(false);
    lastPoint.current = null;
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl ${className}`}
    >
      {/* The actual image */}
      <img 
        src={imageSrc} 
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-500 ${
          isRevealed ? 'scale-100' : 'scale-100'
        }`}
      />
      
      {/* Scratch canvas overlay */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 cursor-pointer touch-none transition-opacity duration-700 ${
          isRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Progress indicator */}
      {!isRevealed && scratchPercentage > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
          <span className="text-sm font-medium text-purple-700">
            {Math.min(Math.round(scratchPercentage / revealThreshold * 100), 100)}% revealed
          </span>
        </div>
      )}

      {/* Revealed celebration */}
      {isRevealed && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-violet-600 text-white px-4 py-2 rounded-full shadow-lg animate-bounce-subtle">
            <span className="text-sm font-semibold">✨ Revealed!</span>
          </div>
        </div>
      )}
    </div>
  );
};
