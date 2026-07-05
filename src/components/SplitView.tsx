import React, { useState } from 'react';
import { Upload, FileDown, Scissors, X, Loader2, CheckCircle2, ChevronRight, File } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { PDFDocument } from 'pdf-lib';
import { motion } from 'motion/react';
import { formatFileSize } from '../utils/fileUtils';
import { cn } from '../utils/cn';
import { storageService } from '../services/storageService';
import { adService } from '../services/adService';
import { DocFile } from '../types';
import { getTranslator } from '../utils/translator';

export const SplitView: React.FC<{ language?: string }> = ({ language = 'English US' }) => {
  const t = getTranslator(language);
  const [file, setFile] = useState<File | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedPdfUrl, setExtractedPdfUrl] = useState<string | null>(null);
  const [pageRange, setPageRange] = useState<{start: number | string, end: number | string}>({ start: 1, end: 1 });
  const [totalPages, setTotalPages] = useState(0);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setExtractedPdfUrl(null);
      setProgress(0);
      
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const count = pdf.getPageCount();
        setTotalPages(count);
        setPageRange({ start: 1, end: count });
      } catch (error) {
        console.error("Error loading PDF:", error);
        alert("Failed to read PDF. Please select a valid document.");
        setFile(null);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const performSplit = async () => {
    setIsSplitting(true);
    setProgress(0);

    try {
      // Progress simulation
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 150);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const splitPdf = await PDFDocument.create();
      
      const startNum = Number(pageRange.start) || 1;
      const endNum = Number(pageRange.end) || totalPages;
      const start = Math.max(0, startNum - 1);
      const end = Math.min(totalPages - 1, endNum - 1);
      
      const indices = [];
      for (let i = start; i <= end; i++) {
        indices.push(i);
      }

      const copiedPages = await splitPdf.copyPages(pdf, indices);
      copiedPages.forEach((page) => splitPdf.addPage(page));

      const splitPdfBytes = await splitPdf.save();
      const blob = new Blob([splitPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const newFileName = `${file.name.replace('.pdf', '')}_extracted_${Date.now()}.pdf`;
      const newFile: DocFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: newFileName,
        type: 'pdf',
        size: blob.size,
        createdAt: Date.now(),
        url: url,
      };

      await storageService.saveFile({ ...newFile, data: blob });
      
      clearInterval(interval);

      // Show interstitial ad after split completes
      adService.showInterstitial(() => {
        setExtractedPdfUrl(url);
        setProgress(100);
      });
    } catch (error) {
      console.error("Split failed:", error);
      alert("Failed to split PDF. Please check the page range.");
    } finally {
      setTimeout(() => setIsSplitting(false), 500);
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    // Show interstitial ad before split starts
    adService.showInterstitial(performSplit);
  };

  const downloadSplit = () => {
    if (!extractedPdfUrl) return;
    const a = document.createElement('a');
    a.href = extractedPdfUrl;
    a.download = `extracted_pages_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">{t('splitPdf')}</h2>
        <p className="text-neutral-500 font-medium">{t('extractSpecificPagesDesc')}</p>
      </div>

      {!file ? (
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
            isDragActive ? "border-orange-500 bg-orange-50 scale-[0.98]" : "border-neutral-200/80 hover:border-orange-400 hover:bg-neutral-50"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-20 h-20 rounded-[24px] bg-orange-50 flex items-center justify-center text-orange-500 mb-6 shadow-sm border border-orange-100/50">
            <Scissors size={36} strokeWidth={1.5} />
          </div>
          <p className="text-neutral-900 font-bold text-lg">{t('clickOrDragPdf')}</p>
          <p className="text-neutral-400 text-sm mt-2 font-medium">{t('selectSinglePdf')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white border border-neutral-200/60 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 bg-neutral-50 rounded-[16px] flex items-center justify-center text-orange-500 border border-neutral-100">
              <File size={24} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-neutral-900 truncate tracking-tight">{file.name}</p>
              <p className="text-sm text-neutral-400 font-medium mt-0.5">{totalPages} {t('pages')} • {formatFileSize(file.size)}</p>
            </div>
            <button onClick={() => setFile(null)} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-white p-6 rounded-[24px] border border-neutral-200/60 shadow-sm space-y-6">
            <h3 className="font-bold text-neutral-900 tracking-wide uppercase text-sm">{t('selectPageRange') || 'Select Page Range'}</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">{t('startPage')}</label>
                <div className="flex bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                  <button 
                    onClick={() => setPageRange(prev => ({ ...prev, start: Math.max(1, (typeof prev.start === 'number' ? prev.start : 1) - 1) }))}
                    className="px-4 py-3 text-neutral-500 hover:text-orange-500 hover:bg-orange-50 transition-colors font-bold text-lg flex items-center justify-center outline-none"
                    type="button"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    min="1" 
                    max={totalPages}
                    value={pageRange.start}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPageRange(prev => ({ ...prev, start: '' }));
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setPageRange(prev => ({ ...prev, start: Math.min(totalPages, num) }));
                        }
                      }
                    }}
                    onBlur={() => {
                      if (pageRange.start === '' || Number(pageRange.start) < 1) {
                        setPageRange(prev => ({ ...prev, start: 1 }));
                      }
                    }}
                    className="w-full bg-transparent px-2 py-3 font-bold text-neutral-900 outline-none text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: 'textfield' }}
                  />
                  <button 
                    onClick={() => setPageRange(prev => ({ ...prev, start: Math.min(totalPages, (typeof prev.start === 'number' ? prev.start : 0) + 1) }))}
                    className="px-4 py-3 text-neutral-500 hover:text-orange-500 hover:bg-orange-50 transition-colors font-bold text-lg flex items-center justify-center outline-none"
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">{t('endPage')}</label>
                <div className="flex bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                  <button 
                    onClick={() => setPageRange(prev => ({ ...prev, end: Math.max(1, (typeof prev.end === 'number' ? prev.end : 1) - 1) }))}
                    className="px-4 py-3 text-neutral-500 hover:text-orange-500 hover:bg-orange-50 transition-colors font-bold text-lg flex items-center justify-center outline-none"
                    type="button"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    min="1" 
                    max={totalPages}
                    value={pageRange.end}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPageRange(prev => ({ ...prev, end: '' }));
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setPageRange(prev => ({ ...prev, end: Math.min(totalPages, num) }));
                        }
                      }
                    }}
                    onBlur={() => {
                      if (pageRange.end === '' || Number(pageRange.end) < 1) {
                        setPageRange(prev => ({ ...prev, end: totalPages || 1 }));
                      }
                    }}
                    className="w-full bg-transparent px-2 py-3 font-bold text-neutral-900 outline-none text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: 'textfield' }}
                  />
                  <button 
                    onClick={() => setPageRange(prev => ({ ...prev, end: Math.min(totalPages, (typeof prev.end === 'number' ? prev.end : 0) + 1) }))}
                    className="px-4 py-3 text-neutral-500 hover:text-orange-500 hover:bg-orange-50 transition-colors font-bold text-lg flex items-center justify-center outline-none"
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-neutral-400 font-medium italic text-center">
              {t('extractingPagesOf')} {pageRange.start === '' ? 1 : pageRange.start} {t('to') || 'to'} {pageRange.end === '' ? totalPages : pageRange.end} {t('of')} {totalPages}
            </p>
          </div>

          <button 
            onClick={handleSplit}
            disabled={isSplitting}
            className="w-full bg-orange-500 text-white p-4 rounded-[24px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-orange-600 disabled:opacity-100 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] overflow-hidden relative"
          >
            {isSplitting && (
              <motion.div 
                className="absolute inset-0 bg-orange-600/50"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            )}
            <div className="flex items-center gap-2 relative z-10">
              {isSplitting ? <Loader2 size={18} className="animate-spin" /> : <Scissors size={20} />}
              <span>{isSplitting ? `${t('splittingPercent')} (${Math.floor(progress)}%)` : t('extractPagesBtn')}</span>
            </div>
            {isSplitting && (
              <div className="text-[10px] uppercase tracking-wider relative z-10 opacity-70">{t('extractingDocPages')}</div>
            )}
          </button>

          {extractedPdfUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-orange-50 border border-orange-100 rounded-[24px] p-8 flex flex-col items-center text-center shadow-sm"
            >
              <div className="w-16 h-16 bg-orange-500 text-white rounded-[20px] flex items-center justify-center mb-4 shadow-lg shadow-orange-500/30">
                <CheckCircle2 size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display font-bold text-xl text-orange-900 tracking-tight">{t('pagesExtracted')}</h3>
              <p className="text-orange-600/70 text-sm mt-2 font-medium">{t('newPdfReadyDownload')}</p>
              
              <div className="mt-6 w-full py-3 rounded-full flex items-center justify-center gap-2 text-orange-600 font-bold bg-orange-50 transition-colors shadow-sm cursor-not-allowed opacity-50">
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
