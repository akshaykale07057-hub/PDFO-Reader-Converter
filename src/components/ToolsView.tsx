import React from 'react';
import { FileText, Image as ImageIcon, FileArchive, Copy, Scissors, Lock } from 'lucide-react';
import { cn } from '../utils/cn';
import { getTranslator } from '../utils/translator';

interface ToolsViewProps {
  onBack?: () => void;
  onSelectAction?: (action: string) => void;
  language?: string;
}

export function ToolsView({ onBack, onSelectAction, language = 'English US' }: ToolsViewProps) {
  const t = getTranslator(language);

  const tools = [
    { id: 'compress-pdf', icon: FileArchive, labelKey: 'compressPdf', descKey: 'reduceSize', color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'merge-pdf', icon: Copy, labelKey: 'mergePdfLabel', descKey: 'combineMultiple', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'split-pdf', icon: Scissors, labelKey: 'splitPdfLabel', descKey: 'extractPages', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'jpg-to-pdf', icon: ImageIcon, labelKey: 'jpgToPdf', descKey: 'convertJpg', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'pdf-to-jpg', icon: ImageIcon, labelKey: 'pdfToJpg', descKey: 'extractImages', color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'word-to-pdf', icon: FileText, labelKey: 'wordToPdf', descKey: 'convertDoc', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'pdf-to-word', icon: FileText, labelKey: 'pdfToWord', descKey: 'convertPdf', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'protect-pdf', icon: Lock, labelKey: 'protectPdf', descKey: 'addPassword', color: 'text-zinc-600', bg: 'bg-zinc-100' },
  ];

  const handleToolClick = (tool: any) => {
    if (onSelectAction) {
      onSelectAction(tool.id);
    }
  };

  return (
    <div className="pt-14 pb-32 px-6 space-y-6">
      <header className="mb-8 font-sans">
        <h1 className="text-3xl font-display font-bold tracking-tight text-neutral-900">{t('tools')}</h1>
        <p className="text-neutral-500 mt-2 font-medium">{t('extraFeatures')}</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {tools.map(tool => (
          <button 
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            className="flex flex-col items-center text-center p-6 bg-white border border-neutral-200/60 rounded-[24px] shadow-sm hover:shadow-md hover:border-neutral-300 transition-all active:scale-95 gap-3"
          >
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
}
