import React, { useState } from 'react';
import { Upload, FileDown, ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react';
import { useDropzone, Accept } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { motion } from 'motion/react';
import { formatFileSize } from '../utils/fileUtils';
import { cn } from '../utils/cn';
import { storageService } from '../services/storageService';
import { adService } from '../services/adService';
import { DocFile } from '../types';
import { getTranslator } from '../utils/translator';
import { isOnlineSync, checkIsOnline, triggerOfflineAlert, useNetworkStatus } from '../utils/networkUtils';
import { OfflineBanner } from './OfflineAlertModal';
import { Capacitor } from '@capacitor/core';
import { downloadDocumentFile } from '../utils/shareUtils';

export const CompressorView: React.FC<{ onComplete?: () => void; language?: string }> = ({ onComplete, language = 'English US' }) => {
  const t = getTranslator(language);
  const isOnline = useNetworkStatus();
  const [file, setFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [targetSizeKB, setTargetSizeKB] = useState<number>(500);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setCompressedFile(null);
      setProgress(0);
    }
  };

  const accept: Accept = { 'image/*': [] };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept,
    multiple: false
  } as any);

  const performCompress = async () => {
    setIsCompressing(true);
    setProgress(0);
    
    // Progress simulation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const options = {
        maxSizeMB: targetSizeKB / 1024,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      
      const compressedBlob = await imageCompression(file, options);
      setProgress(100);
      
      const newCompressedFile = new File([compressedBlob], file.name, { type: file.type });
      setCompressedFile(newCompressedFile);

      const fileName = file.name;
      const newDoc: DocFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: fileName,
        type: 'image',
        size: compressedBlob.size,
        createdAt: Date.now(),
        url: URL.createObjectURL(compressedBlob)
      };
      await storageService.saveFile({ ...newDoc, data: compressedBlob });
      adService.showInterstitial(() => {
        if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
          onComplete?.();
        }
      });
    } catch (error) {
      console.error("Compression failed:", error);
    } finally {
      clearInterval(interval);
      setTimeout(() => setIsCompressing(false), 300);
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    if (!isOnlineSync()) {
      triggerOfflineAlert();
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      triggerOfflineAlert();
      return;
    }
    // Show interstitial ad before compression starts
    adService.showInterstitial(performCompress);
  };

  const downloadCompressed = async () => {
    if (!compressedFile) return;
    if (Capacitor.isNativePlatform()) {
      await downloadDocumentFile({
        id: `compressed-${Date.now()}`,
        name: compressedFile.name,
        type: 'image',
        size: compressedFile.size,
        createdAt: Date.now(),
        url: URL.createObjectURL(compressedFile)
      }, undefined, compressedFile);
    } else {
      const url = URL.createObjectURL(compressedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = compressedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">{t('sizeConverter')}</h2>
        <p className="text-neutral-500 font-medium">{t('compressImagesDesc')}</p>
      </div>

      {!isOnline && (
        <OfflineBanner language={language} className="mb-2" />
      )}

      {!file ? (
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
            isDragActive ? "border-red-500 bg-red-50 scale-[0.98]" : "border-neutral-200/80 hover:border-red-400 hover:bg-neutral-50"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-20 h-20 rounded-[24px] bg-red-50 flex items-center justify-center text-red-500 mb-6 shadow-sm border border-red-100/50">
            <Upload size={36} strokeWidth={1.5} />
          </div>
          <p className="text-neutral-900 font-bold text-lg">{t('clickOrDragImage')}</p>
          <p className="text-neutral-400 text-sm mt-2 font-medium">{t('supportsJpgPngWebp')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white border border-neutral-200/60 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 bg-neutral-50 rounded-[16px] flex items-center justify-center text-neutral-500 border border-neutral-100">
              <Upload size={24} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-neutral-900 truncate tracking-tight">{file.name}</p>
              <p className="text-sm text-neutral-500 font-medium mt-0.5">{formatFileSize(file.size)}</p>
            </div>
            <button onClick={() => setFile(null)} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Loader2 className={cn("animate-spin", !isCompressing && "hidden")} />
              {!isCompressing && <X size={20} />}
            </button>
          </div>

          <div className="space-y-5 bg-white p-6 rounded-[24px] border border-neutral-200/60 shadow-sm">
            <label className="block text-sm font-bold text-neutral-900 tracking-wide uppercase">{t('targetSizeKB')}</label>
            <input 
              type="range" 
              min="10" 
              max="2000" 
              step="10"
              value={targetSizeKB}
              onChange={(e) => setTargetSizeKB(parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-full appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-xs font-bold text-neutral-400">
              <span>10 KB</span>
              <span className="text-red-500 bg-red-50 px-3 py-1 rounded-full">{targetSizeKB} KB</span>
              <span>2000 KB</span>
            </div>
          </div>

          <button 
            onClick={handleCompress}
            disabled={isCompressing}
            className="w-full bg-red-500 text-white p-4 rounded-[24px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-red-600 disabled:opacity-100 transition-all shadow-lg shadow-red-500/20 active:scale-[0.98] overflow-hidden relative"
          >
            {isCompressing && (
              <motion.div 
                className="absolute inset-0 bg-red-600/50"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            )}
            <div className="flex items-center gap-2 relative z-10">
              {isCompressing ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={20} />}
              <span>{isCompressing ? `${t('compressingPercent')} (${Math.floor(progress)}%)` : t('convertSize')}</span>
            </div>
            {isCompressing && (
               <div className="text-[10px] uppercase tracking-wider relative z-10 opacity-70">{t('processingImageData')}</div>
            )}
          </button>

          {compressedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 rounded-[24px] p-8 flex flex-col items-center text-center shadow-sm"
            >
              <div className="w-16 h-16 bg-red-500 text-white rounded-[20px] flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
                <CheckCircle2 size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display font-bold text-xl text-red-900 tracking-tight">{t('processingComplete')}</h3>
              <div className="mt-3 flex items-center gap-4 text-sm bg-white/60 px-4 py-2 rounded-full">
                <span className="text-neutral-500 line-through font-medium">{formatFileSize(file.size)}</span>
                <ArrowRight size={14} className="text-neutral-400" />
                <span className="font-bold text-red-600">{formatFileSize(compressedFile.size)}</span>
              </div>
              {['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type) ? (
                <>
                  <p className="text-xs text-red-700 mt-4 text-center">{t('autoSavedHomeLib')}</p>
                  <button 
                    onClick={onComplete}
                    className="mt-6 w-full bg-red-500 border border-red-500 py-3 rounded-full flex items-center justify-center gap-2 text-white font-bold hover:bg-red-600 transition-colors shadow-sm"
                  >
                    {t('goHome')}
                  </button>
                </>
              ) : (
                <div className="mt-6 w-full py-3 rounded-full flex items-center justify-center gap-2 text-red-600 font-bold bg-white border border-red-200 transition-colors shadow-sm cursor-not-allowed opacity-50">
                  <FileDown size={20} />
                  {t('downloadUnavailable')}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
