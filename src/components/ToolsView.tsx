import React from 'react';
import { FileText, Image as ImageIcon, Lock, ArrowLeft, WifiOff, FileSpreadsheet, RotateCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { getTranslator } from '../utils/translator';
import { useNetworkStatus, isOnlineSync, triggerOfflineAlert } from '../utils/networkUtils';
import { OfflineBanner } from './OfflineAlertModal';

interface ToolsViewProps {
  onBack?: () => void;
  onSelectAction?: (action: string) => void;
  language?: string;
}

export const ToolsView = React.memo(function ToolsView({ onBack, onSelectAction, language = 'English US' }: ToolsViewProps) {
  const t = getTranslator(language);
  const isOnline = useNetworkStatus();

  const tools = [
    { id: 'excel-to-pdf', icon: FileSpreadsheet, labelKey: 'excelToPdf', descKey: 'convertExcel', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'pdf-to-excel', icon: FileSpreadsheet, labelKey: 'pdfToExcel', descKey: 'convertPdfToExcel', color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'rotate-pdf', icon: RotateCw, labelKey: 'rotatePdf', descKey: 'rotatePdfDesc', color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'jpg-to-pdf', icon: ImageIcon, labelKey: 'jpgToPdf', descKey: 'convertJpg', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'pdf-to-jpg', icon: ImageIcon, labelKey: 'pdfToJpg', descKey: 'extractImages', color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'word-to-pdf', icon: FileText, labelKey: 'wordToPdf', descKey: 'convertDoc', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'pdf-to-word', icon: FileText, labelKey: 'pdfToWord', descKey: 'convertPdf', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'protect-pdf', icon: Lock, labelKey: 'protectPdf', descKey: 'addPassword', color: 'text-zinc-600', bg: 'bg-zinc-100' },
  ];

  const handleToolClick = (tool: any) => {
    // If offline, document conversion/tools are blocked!
    if (!isOnlineSync()) {
      triggerOfflineAlert();
      return;
    }

    if (onSelectAction) {
      onSelectAction(tool.id);
    }
  };

  return (
    <div className="pt-10 pb-12 px-6 space-y-6">
      <header className="mb-2 font-sans flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-white border border-neutral-200/60 shadow-sm flex items-center justify-center text-neutral-700 hover:bg-neutral-50 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-neutral-900">{t('tools')}</h1>
          <p className="text-neutral-500 mt-0.5 font-medium text-sm">{t('extraFeatures')}</p>
        </div>
      </header>

      {/* Offline Warning Banner */}
      {!isOnline && (
        <OfflineBanner language={language} className="mb-2" />
      )}

      <div className="grid grid-cols-2 gap-4">
        {tools.map(tool => (
          <button 
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            className={cn(
              "relative flex flex-col items-center text-center p-6 bg-white border border-neutral-200/60 rounded-[24px] shadow-sm hover:shadow-md hover:border-neutral-300 transition-all active:scale-95 gap-3 cursor-pointer",
              !isOnline && "opacity-85 hover:border-rose-200"
            )}
          >
            {!isOnline && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center" title="Offline - requires internet">
                <WifiOff size={11} strokeWidth={2.5} />
              </div>
            )}
            <div className={cn("w-16 h-16 rounded-[20px] flex items-center justify-center", tool.bg, tool.color)}>
              <tool.icon size={28} strokeWidth={2} />
            </div>
            <div>
              <div className="font-bold text-neutral-800 text-sm">{t(tool.labelKey)}</div>
              <div className="text-[10px] text-neutral-500 font-medium mt-1">{t(tool.descKey)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});
