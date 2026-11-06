import React from 'react';
import { WifiOff, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTranslator } from '../utils/translator';
import { cn } from '../utils/cn';

interface OfflineAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  customMessage?: string;
}

export const OfflineAlertModal: React.FC<OfflineAlertModalProps> = ({
  isOpen,
  onClose,
  language = 'English US',
  customMessage,
}) => {
  const t = getTranslator(language);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-neutral-100 z-10 flex flex-col items-center text-center overflow-hidden"
          >
            {/* Top decorative gradient glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-44 h-44 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-500 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Offline Icon */}
            <div className="relative mt-2 mb-4">
              <div className="w-20 h-20 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-inner">
                <WifiOff size={34} strokeWidth={2.2} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-white shadow-sm">
                <AlertTriangle size={14} strokeWidth={2.5} />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-display font-bold text-neutral-900 tracking-tight mb-2">
              {t('youAreOffline') || 'You are offline'}
            </h3>

            {/* Main Message */}
            <p className="text-sm font-semibold text-rose-600 mb-2 leading-snug">
              {customMessage || t('offlineConvertNotice') || 'Without online you not convert any document'}
            </p>

            {/* Helpful explanation */}
            <p className="text-xs text-neutral-500 leading-relaxed mb-6 px-2">
              {t('connectInternetNotice') || 'Please check your internet connection to continue converting, compressing, merging, or protecting documents.'}
            </p>

            {/* Dismiss Button */}
            <button
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-neutral-900/15 cursor-pointer"
            >
              {t('ok') || 'OK'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface OfflineBannerProps {
  language?: string;
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  language = 'English US',
  className,
}) => {
  const t = getTranslator(language);

  return (
    <div
      className={cn(
        'w-full bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 flex items-center gap-3 text-rose-900 shadow-xs animate-in fade-in duration-300',
        className
      )}
    >
      <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
        <WifiOff size={18} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-rose-950 flex items-center gap-2">
          <span>{t('youAreOffline') || 'You are offline'}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
        </div>
        <div className="text-[11px] font-medium text-rose-700 leading-snug mt-0.5 truncate">
          {t('offlineConvertNotice') || 'Without online you not convert any document'}
        </div>
      </div>
    </div>
  );
};
