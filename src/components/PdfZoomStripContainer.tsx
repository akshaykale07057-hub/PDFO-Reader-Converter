import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PdfZoomStripContainerProps {
  children: React.ReactNode;
  className?: string;
  resetDependency?: any;
  minZoom?: number;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export const PdfZoomStripContainer: React.FC<PdfZoomStripContainerProps> = ({
  children,
  className = "w-full h-full overflow-y-auto overflow-x-auto bg-[#e8ebf0] dark:bg-neutral-900 relative select-none scroll-smooth",
  resetDependency,
  minZoom = 0.35,
  maxZoom = 2.5,
  onZoomChange
}) => {
  const [zoom, setZoom] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Touch tracking refs
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const initialZoomRef = useRef<number>(1.0);
  const isPinchingRef = useRef<boolean>(false);

  // Reset zoom on document change
  useEffect(() => {
    setZoom(1.0);
  }, [resetDependency]);

  // Notify parent of zoom changes
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(zoom);
    }
  }, [zoom, onZoomChange]);

  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // 1. Double tap detection (single finger tap within 300ms)
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTouchTimeRef.current < 300) {
        // Toggle: if zoomed out or in, reset to normal 1.0; if normal 1.0, zoom in to 1.75
        setZoom(prev => (Math.abs(prev - 1.0) > 0.05 ? 1.0 : 1.75));
        lastTouchTimeRef.current = 0;
        return;
      }
      lastTouchTimeRef.current = now;
    }

    // 2. Pinch initiation (two fingers)
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e);
      if (dist !== null) {
        lastTouchDistanceRef.current = dist;
        initialZoomRef.current = zoom;
        isPinchingRef.current = true;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // 2-finger Pinch gesture: smooth zoom in AND zoom out into page strip
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const dist = getTouchDistance(e);
      if (dist !== null) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        const delta = dist / lastTouchDistanceRef.current;
        lastTouchDistanceRef.current = dist;
        
        setZoom(prev => {
          const next = prev * delta;
          return Math.max(minZoom, Math.min(next, maxZoom));
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastTouchDistanceRef.current = null;
      isPinchingRef.current = false;
    }
  };

  // Zoom via Scroll Wheel + Ctrl Key (desktop/tablet trackpads)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(prev => Math.max(minZoom, Math.min(prev * delta, maxZoom)));
    }
  };

  // Step-wise buttons
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(minZoom, Number((prev - 0.15).toFixed(2))));
  }, [minZoom]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(maxZoom, Number((prev + 0.15).toFixed(2))));
  }, [maxZoom]);

  const handleReset = useCallback(() => {
    setZoom(1.0);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 
        The Continuous Page Strip:
        When zoom <= 1.0 (normal or zoomed out):
        - The strip width scales down to e.g. 50% or 35% of the screen.
        - Centered with mx-auto on the gray viewer canvas.
        - Pages form a long, centered, continuous vertical strip.
        - Full-height native vertical scrolling allows gliding through all pages.
        When zoom > 1.0:
        - The strip expands wider than the screen.
        - The user can pan horizontally and scroll vertically.
      */}
      <div 
        className="pdf-page-strip mx-auto py-4 sm:py-6 px-2 sm:px-4 flex flex-col items-center transition-[width,max-width] duration-150 ease-out"
        style={{
          width: zoom <= 1.0 
            ? `${Math.max(35, Math.min(100, Math.round(zoom * 100)))}%` 
            : `${Math.round(zoom * 100)}%`,
          maxWidth: zoom <= 1.0 
            ? `${Math.max(200, Math.round(zoom * 720))}px` 
            : `${Math.round(zoom * 720)}px`,
          gap: `${Math.max(6, Math.round(16 * Math.min(zoom, 1.0)))}px`
        }}
      >
        {children}
      </div>

      {/* Floating glassmorphic HUD for quick zoom control and 1-tap reset */}
      <AnimatePresence>
        {Math.abs(zoom - 1.0) > 0.02 && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-16 right-4 sm:bottom-6 sm:right-6 bg-neutral-900/90 backdrop-blur-md text-white border border-white/15 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl z-[9999] select-none pointer-events-auto"
          >
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-xs font-bold cursor-pointer text-neutral-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-bold font-mono min-w-[36px] text-center text-neutral-100">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-xs font-bold cursor-pointer text-neutral-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-[1px] h-4 bg-white/15" />
            <button
              onClick={handleReset}
              className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 hover:bg-amber-500/35 active:scale-95 rounded-md transition-all flex items-center gap-1 cursor-pointer"
              title="Reset to 100%"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
