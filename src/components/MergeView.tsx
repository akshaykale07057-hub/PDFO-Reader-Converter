import React, { useState } from 'react';
import { Upload, FilePlus, ChevronRight, X, Loader2, CheckCircle2, FileDown, Layers } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { PDFDocument } from 'pdf-lib';
import { motion, Reorder } from 'motion/react';
import { formatFileSize } from '../utils/fileUtils';
import { cn } from '../utils/cn';
import { storageService } from '../services/storageService';
import { adService } from '../services/adService';
import { DocFile } from '../types';
import { getTranslator } from '../utils/translator';
import { isOnlineSync, checkIsOnline, triggerOfflineAlert, useNetworkStatus } from '../utils/networkUtils';
import { OfflineBanner } from './OfflineAlertModal';

export const MergeView: React.FC<{ language?: string }> = ({ language = 'English US' }) => {
  const t = getTranslator(language);
  const isOnline = useNetworkStatus();
  const [files, setFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setMergedPdfUrl(null);
    setProgress(0);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true
  } as any);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setMergedPdfUrl(null);
  };

  const performMerge = async () => {
    setIsMerging(true);
    setProgress(0);

    try {
      const mergedPdf = await PDFDocument.create();
      
      let targetWidth = 595.28; // Default A4
      let targetHeight = 841.89; // Default A4
      let isFirstPage = true;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Calculate progress based on files processed
        setProgress((i / files.length) * 80);

        const fileArrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(fileArrayBuffer);
        
        if (isFirstPage && pdf.getPageCount() > 0) {
          const firstPage = pdf.getPage(0);
          const { width, height } = firstPage.getSize();
          targetWidth = width;
          targetHeight = height;
          isFirstPage = false;
        }
        
        // Embed pages instead of copyPages so we can scale them onto a standard sized page
        const embeddedPages = await mergedPdf.embedPages(pdf.getPages());
        
        embeddedPages.forEach((embeddedPage) => {
          const newPage = mergedPdf.addPage([targetWidth, targetHeight]);
          
          const { width, height } = embeddedPage.size();
          
          // Calculate scale to fit within the target dimensions while maintaining aspect ratio
          const scale = Math.min(targetWidth / width, targetHeight / height);
          
          newPage.drawPage(embeddedPage, {
            x: (targetWidth - width * scale) / 2,
            y: (targetHeight - height * scale) / 2,
            xScale: scale,
            yScale: scale
          });
        });
      }

      setProgress(90);
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const newFileName = `Merged_${Date.now()}.pdf`;
      const newFile: DocFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: newFileName,
        type: 'pdf',
        size: blob.size,
        createdAt: Date.now(),
        url: url,
      };

      await storageService.saveFile({ ...newFile, data: blob });

      // Show interstitial ad after merge completes
      adService.showInterstitial(() => {
        setMergedPdfUrl(url);
        setProgress(100);
      });
    } catch (error) {
      console.error("Merge failed:", error);
      alert("Failed to merge PDFs. Please ensure all files are valid PDF documents.");
    } finally {
      setTimeout(() => setIsMerging(false), 500);
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    if (!isOnlineSync()) {
      triggerOfflineAlert();
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      triggerOfflineAlert();
      return;
    }
    // Show interstitial ad before merge starts
    adService.showInterstitial(performMerge);
  };

  const downloadMerged = () => {
    if (!mergedPdfUrl) return;
    const a = document.createElement('a');
    a.href = mergedPdfUrl;
    a.download = `merged_document_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">{t('pdfMerge')}</h2>
        <p className="text-neutral-500 font-medium">{t('combineMultiplePdfsDesc')}</p>
      </div>

      {!isOnline && (
        <OfflineBanner language={language} className="mb-2" />
      )}

      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-[32px] p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
          isDragActive ? "border-indigo-500 bg-indigo-50 scale-[0.98]" : "border-neutral-200/80 hover:border-indigo-400 hover:bg-neutral-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-[20px] bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4 shadow-sm border border-indigo-100/50">
          <FilePlus size={32} strokeWidth={1.5} />
        </div>
        <p className="text-neutral-900 font-bold">{t('addPdfFiles')}</p>
        <p className="text-neutral-400 text-sm mt-1 font-medium text-center">{t('selectTwoOrMorePdfs')}</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <Layers size={18} className="text-indigo-500" />
              {t('filesToMerge')} ({files.length})
            </h3>
            <button 
              onClick={() => setFiles([])}
              className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
            >
              {t('clearAll')}
            </button>
          </div>

          <Reorder.Group axis="y" values={files} onReorder={setFiles} className="space-y-3">
            {files.map((file, index) => (
              <Reorder.Item 
                key={`${file.name}-${index}`} 
                value={file}
                className="bg-white border border-neutral-200/60 rounded-[20px] p-4 flex items-center gap-4 shadow-sm cursor-grab active:cursor-grabbing"
              >
                <div className="w-10 h-10 bg-neutral-50 rounded-[12px] flex items-center justify-center text-neutral-400 border border-neutral-100">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-neutral-900 truncate tracking-tight">{file.name}</p>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">{formatFileSize(file.size)}</p>
                </div>
                <button 
                  onClick={() => removeFile(index)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X size={18} />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {!mergedPdfUrl && (
            <button 
              onClick={handleMerge}
              disabled={files.length < 2 || isMerging}
              className="w-full bg-indigo-600 text-white p-4 rounded-[24px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-indigo-700 disabled:opacity-100 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] overflow-hidden relative"
            >
              {isMerging && (
                <motion.div 
                  className="absolute inset-0 bg-indigo-700/50"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              )}
              <div className="flex items-center gap-2 relative z-10">
                {isMerging ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={20} />}
                <span>{isMerging ? `${t('mergingPercent')} (${Math.floor(progress)}%)` : `${t('mergeFiles')} ${files.length} ${t('files')}`}</span>
              </div>
              {isMerging && (
                <div className="text-[10px] uppercase tracking-wider relative z-10 opacity-70">{t('combiningPages')}</div>
              )}
            </button>
          )}

          {mergedPdfUrl && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-indigo-50 border border-indigo-100 rounded-[24px] p-8 flex flex-col items-center text-center shadow-sm"
            >
              <div className="w-16 h-16 bg-indigo-500 text-white rounded-[20px] flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
                <CheckCircle2 size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display font-bold text-xl text-indigo-900 tracking-tight">{t('mergeComplete')}</h3>
              <p className="text-indigo-600/70 text-sm mt-2 font-medium">{t('combinedDocReady')}</p>
              
              <div className="mt-6 w-full py-3 rounded-full flex items-center justify-center gap-2 text-indigo-600 font-bold bg-white border border-indigo-200 transition-colors shadow-sm cursor-not-allowed opacity-50">
                <FileDown size={20} />
                {t('downloadUnavailable')}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
