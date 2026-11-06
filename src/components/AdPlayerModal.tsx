import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Loader2, X, WifiOff, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { isOnlineSync } from '../utils/networkUtils';
import { adService } from '../services/adService';

interface AdPlayerModalProps {
  onComplete: () => void;
  onGoPro?: () => void;
  onClose?: () => void;
}

export const AdPlayerModal: React.FC<AdPlayerModalProps> = ({ onComplete, onClose }) => {
  const [status, setStatus] = useState<'loading' | 'failed' | 'showing'>('loading');
  const [statusText, setStatusText] = useState('Connecting to ad network...');
  const isStartedRef = useRef(false);

  // If user is completely offline, bypass ads so offline files can be read
  useEffect(() => {
    if (!isOnlineSync()) {
      onComplete();
    }
  }, [onComplete]);

  const startAdFlow = useCallback(async () => {
    setStatus('loading');
    setStatusText('Connecting to ad network...');

    const result = await adService.loadAndShowInterstitial((step) => {
      if (step === 'connecting') {
        setStatusText('Connecting to ad network...');
      } else if (step === 'downloading') {
        setStatusText('Buffering video ad...');
      } else if (step === 'showing') {
        setStatus('showing');
        setStatusText('Ad ready! Showing now...');
      }
    });

    if (result === 'success') {
      onComplete();
    } else {
      setStatus('failed');
    }
  }, [onComplete]);

  // Start loading the real AdMob ad immediately when modal opens
  useEffect(() => {
    if (!isStartedRef.current) {
      isStartedRef.current = true;
      startAdFlow();
    }
  }, [startAdFlow]);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center p-6 backdrop-blur-sm select-none">
      <div className="w-full max-w-sm bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 relative p-8 text-center flex flex-col items-center">
        {/* Close / Cancel Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer z-10 p-2 rounded-full hover:bg-white/10 active:scale-95"
            aria-label="Cancel"
            title="Cancel"
          >
            <X size={20} />
          </button>
        )}

        {status === 'loading' || status === 'showing' ? (
          <>
            {/* Pulsing Ad Loading Icon */}
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping opacity-60" />
              <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center relative">
                <Loader2 className="animate-spin text-amber-500" size={36} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Loading Ad...</h2>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              Please wait while the ad loads over your network. Your document will open immediately after watching.
            </p>

            {/* Network Step Badge */}
            <div className="w-full py-3 px-4 bg-neutral-800/80 border border-white/5 rounded-2xl flex items-center justify-center gap-2.5 text-neutral-300 text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{statusText}</span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="mt-6 text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline cursor-pointer"
              >
                Cancel and return to files
              </button>
            )}
          </>
        ) : (
          <>
            {/* Failed State due to slow / weak internet */}
            <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 text-rose-400">
              <WifiOff size={34} />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Network Too Slow</h2>
            <p className="text-neutral-400 text-xs mb-8 leading-relaxed">
              Ad could not load due to poor internet speed. Documents can only be viewed after an ad is watched.
            </p>

            <div className="flex flex-col w-full gap-3">
              <button
                onClick={startAdFlow}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <RefreshCw size={16} />
                Retry Loading Ad
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 font-semibold rounded-2xl transition-all text-sm cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
