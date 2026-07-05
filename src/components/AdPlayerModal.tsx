import React, { useState, useEffect } from 'react';
import { Play, Loader2, Crown, X } from 'lucide-react';
import { cn } from '../utils/cn';

interface AdPlayerModalProps {
  onComplete: () => void;
  onGoPro: () => void;
  onClose?: () => void;
}

export const AdPlayerModal: React.FC<AdPlayerModalProps> = ({ onComplete, onGoPro, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      onComplete();
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft, onComplete]);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 relative">
        {onClose && !isPlaying && (
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer z-10"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
        {!isPlaying ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6">
              <Play className="text-amber-500" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Watch Ad to Continue</h2>
            <p className="text-neutral-400 mb-8">
              Or upgrade to PDF Reader Pro to remove all ads forever!
            </p>
            
            <div className="flex flex-col w-full gap-4">
              <button 
                onClick={() => setIsPlaying(true)}
                className="w-full py-4 bg-white text-black font-bold rounded-2xl active:scale-95 transition-all text-lg"
              >
                Watch Short Ad (5s)
              </button>
              <button 
                onClick={onGoPro}
                className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all outline-none"
              >
                <Crown size={20} />
                Get Pro & Remove Ads
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center flex flex-col items-center aspect-video justify-center relative">
             {/* Mock Ad Content */}
             <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-white/50">
                  <Loader2 className="animate-spin" size={32} />
                  <span>Loading amazing offer...</span>
                </div>
             </div>
             
             {/* Ad Overlay Controls */}
             <div className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/90 font-bold border border-white/10">
               {timeLeft}
             </div>
             <div className="absolute bottom-4 left-0 w-full px-4 z-10">
                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${((5 - timeLeft) / 5) * 100}%` }}
                  />
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
