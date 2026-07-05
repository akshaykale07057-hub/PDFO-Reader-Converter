import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomPanContainerProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  resetDependency?: any;
}

export const ZoomPanContainer: React.FC<ZoomPanContainerProps> = ({
  children,
  className = "w-full h-full relative overflow-hidden flex-1",
  contentClassName = "w-full h-full",
  resetDependency
}) => {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Gestures ref tracking
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  
  // Reset when dependency changes (e.g. file changes or chapters/sheets switch)
  useEffect(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, [resetDependency]);

  // Keep pan within boundaries on zoom change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const maxPanX = Math.max(0, (W * (zoom - 1)) / 2);
    const maxPanY = Math.max(0, (H * (zoom - 1)) / 2);
    setPan(prev => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, prev.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, prev.y))
    }));
  }, [zoom]);

  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (zoom > 1.0 || e.touches.length === 2) {
      e.stopPropagation();
    }

    // Double tap detection
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTouchTimeRef.current < 300) {
        // Double tap: toggle zoom
        if (zoom > 1.0) {
          setZoom(1.0);
          setPan({ x: 0, y: 0 });
        } else {
          setZoom(2.0);
        }
        lastTouchTimeRef.current = 0;
        return;
      }
      lastTouchTimeRef.current = now;
    }

    if (e.touches.length === 2) {
      const dist = getTouchDistance(e);
      if (dist !== null) {
        lastTouchDistanceRef.current = dist;
      }
      isDraggingRef.current = false;
    } else if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const dist = getTouchDistance(e);
      if (dist !== null) {
        const delta = dist / lastTouchDistanceRef.current;
        lastTouchDistanceRef.current = dist;
        
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        
        setZoom(prev => {
          const next = prev * delta;
          return Math.max(1.0, Math.min(next, 5.0));
        });
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && zoom > 1.0) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      
      const container = containerRef.current;
      if (container) {
        const W = container.clientWidth;
        const H = container.clientHeight;
        const maxPanX = Math.max(0, (W * (zoom - 1)) / 2);
        const maxPanY = Math.max(0, (H * (zoom - 1)) / 2);
        
        setPan({
          x: Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.x + dx)),
          y: Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.y + dy))
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1.0) {
      e.stopPropagation();
    }
    if (e.touches.length < 2) {
      lastTouchDistanceRef.current = null;
    }
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
    } else if (e.touches.length === 1 && !isDraggingRef.current) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    }
  };

  // Mouse pan for desktop users
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left button click only
    if (zoom > 1.0) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...pan };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    const container = containerRef.current;
    if (container) {
      const W = container.clientWidth;
      const H = container.clientHeight;
      const maxPanX = Math.max(0, (W * (zoom - 1)) / 2);
      const maxPanY = Math.max(0, (H * (zoom - 1)) / 2);
      
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.x + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.y + dy))
      });
    }
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Zoom via Scroll Wheel + Ctrl Key
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(prev => Math.max(1.0, Math.min(prev * delta, 5.0)));
    }
  };

  return (
    <div 
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onWheel={handleWheel}
    >
      <div 
        className={contentClassName}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDraggingRef.current ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          width: '100%',
          height: '100%'
        }}
      >
        {children}
      </div>

      {/* Floating glassmorphic HUD */}
      <AnimatePresence>
        {zoom > 1.0 && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-4 right-4 bg-neutral-900/80 backdrop-blur-md text-white border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl z-[9999] select-none pointer-events-auto"
          >
            <button
              onClick={() => setZoom(prev => Math.max(1.0, prev - 0.25))}
              className="w-6.5 h-6.5 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-xs font-bold cursor-pointer text-neutral-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[10px] font-bold font-mono min-w-[34px] text-center text-neutral-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(5.0, prev + 0.25))}
              className="w-6.5 h-6.5 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-xs font-bold cursor-pointer text-neutral-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <div className="w-[1px] h-4 bg-white/10" />
            <button
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 hover:bg-amber-500/35 rounded-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
