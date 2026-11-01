import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, FileSpreadsheet, FilePieChart, BookOpen, Image as ImageIcon, MoreVertical, Clock, Edit2, Trash2, Share2, CircleCheck, Circle, Download, Info, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DocFile, FileType } from '../types';
import { formatFileSize } from '../utils/fileUtils';
import { cn } from '../utils/cn';
import { useMarkFileAsOpened } from '../hooks/useMarkFileAsOpened';
import { getTranslator } from '../utils/translator';

interface FileListProps {
  files: DocFile[];
  onFileClick: (file: DocFile) => void;
  onRenameFile?: (id: string, newName: string) => void;
  onDeleteFile?: (id: string) => void;
  onShareFile?: (file: DocFile) => void;
  onShareFiles?: (files: DocFile[]) => void;
  onDownloadFile?: (file: DocFile) => void;
  title?: string;
  language?: string;
  onRefresh?: () => void;
}

const getFileIcon = (type: FileType) => {
  switch (type) {
    case 'pdf': return <FileText className="text-red-500" />;
    case 'doc': return <FileText className="text-blue-500" />;
    case 'xlsx': return <FileSpreadsheet className="text-emerald-500" />;
    case 'ppt': return <FilePieChart className="text-orange-500" />;
    case 'epub': return <BookOpen className="text-indigo-500" />;
    case 'image': return <ImageIcon className="text-blue-500" />;
    default: return <FileText className="text-neutral-500" />;
  }
};

export const FileList: React.FC<FileListProps> = React.memo(function FileList({ files, onFileClick, onRenameFile, onDeleteFile, onShareFile, onShareFiles, onDownloadFile, title, language = 'English US', onRefresh }) {
  const markFileAsOpened = useMarkFileAsOpened();
  const t = getTranslator(language);
  const [activeMenuFile, setActiveMenuFile] = useState<DocFile | null>(null);
  const [renameFile, setRenameFile] = useState<DocFile | null>(null);
  const [fileDetail, setFileDetail] = useState<DocFile | null>(null);
  const [newName, setNewName] = useState('');
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = (id: string) => {
    if (selectionMode) return;
    timerRef.current = setTimeout(() => {
      setSelectionMode(true);
      setSelectedIds(new Set([id]));
    }, 600);
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (newSet.size === 0) setSelectionMode(false);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-neutral-400">
        <FileText size={48} strokeWidth={1} className="mb-4" />
        <p className="text-sm font-semibold text-neutral-600 mb-6">{t('NoDocumentsFound') || "No Documents Found"}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full shadow-lg shadow-red-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider cursor-pointer"
          >
            <RefreshCw size={14} className="animate-spin-slow" />
            {t('scanStorage') || "Scan Storage"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pb-20">
      <div className="flex justify-between items-center mb-2 ml-2">
        {title && <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{title}</h3>}
        {selectionMode && (
          <button 
            onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
            className="text-xs font-bold text-red-500 uppercase tracking-widest mr-2 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {files.map((file) => (
          <div
            key={file.id}
            onPointerDown={() => handlePointerDown(file.id)}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={cn(
              "w-full flex items-center gap-4 p-4 bg-white border rounded-[20px] text-left relative select-none file-item-card",
              selectedIds.has(file.id) ? "border-red-500 shadow-sm bg-red-50/10" : "border-neutral-100 hover:border-neutral-200"
            )}
          >
            <div 
              className="flex-1 flex items-center gap-4 min-w-0 cursor-pointer"
              onClick={(e) => {
                if (selectionMode) {
                  toggleSelection(e, file.id);
                } else {
                  onFileClick(file);
                }
              }}
            >
              {selectionMode ? (
                <div className={cn(
                  "w-12 h-12 rounded-[14px] flex items-center justify-center transition-colors shadow-sm",
                  selectedIds.has(file.id) ? "bg-red-500 text-white" : "bg-neutral-100 text-neutral-400"
                )}>
                  {selectedIds.has(file.id) ? <CircleCheck size={24} /> : <Circle size={24} />}
                </div>
              ) : (
                <div className="w-12 h-12 bg-neutral-50 rounded-[14px] flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
                  {getFileIcon(file.type)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-neutral-900 truncate tracking-tight">{file.name}</h4>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1 font-medium">
                  <span className="bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-600">{file.type.toUpperCase()}</span>
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            {!selectionMode && (
              <div 
                className="relative shrink-0 flex items-center" 
                onPointerDown={e => e.stopPropagation()}
              >
                <button 
                  type="button"
                  aria-label="Document options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuFile(file);
                  }}
                  className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 transition-colors cursor-pointer"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectionMode && selectedIds.size > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-28 left-0 right-0 px-4 flex justify-center z-[100]"
            >
              <div className="bg-neutral-900 border border-neutral-700 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl shadow-black/50 text-white w-full max-w-sm justify-between">
                <span className="font-bold text-sm">{selectedIds.size} {t('selected')}</span>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      if (onShareFiles) {
                        const filesToShare = files.filter(f => selectedIds.has(f.id));
                        onShareFiles(filesToShare);
                      }
                      setSelectionMode(false);
                      setSelectedIds(new Set());
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 transition-colors flex items-center justify-center group relative cursor-pointer"
                  >
                    <Share2 size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (onDeleteFile) {
                        selectedIds.forEach(id => onDeleteFile(id));
                      }
                      setSelectionMode(false);
                      setSelectedIds(new Set());
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors flex items-center justify-center group relative cursor-pointer"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedIds(new Set());
                    }}
                    className="bg-neutral-700 hover:bg-neutral-600 text-white rounded-full p-2 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Clock size={18} className="rotate-45 opacity-0 group-hover:opacity-100" />
                    <span className="mx-2 text-sm font-medium">{t('done')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* File Action Sheet / Three-dot Options Menu */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeMenuFile && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveMenuFile(null)}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
              />

              {/* Sheet / Modal */}
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-neutral-100 z-10 max-h-[85vh] overflow-y-auto no-scrollbar"
              >
                {/* Drag Handle for mobile */}
                <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4 sm:hidden" />

                {/* File Info Header */}
                <div className="flex items-center gap-3.5 pb-4 mb-3 border-b border-neutral-100">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center shrink-0 border border-neutral-100">
                    {getFileIcon(activeMenuFile.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-900 text-sm truncate tracking-tight">
                      {activeMenuFile.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5 font-medium">
                      <span className="bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-600 font-semibold uppercase text-[10px]">
                        {activeMenuFile.type}
                      </span>
                      <span>{formatFileSize(activeMenuFile.size)}</span>
                      <span>•</span>
                      <span>{new Date(activeMenuFile.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMenuFile(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Actions List */}
                <div className="space-y-1">
                  {/* Details */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = activeMenuFile;
                      setActiveMenuFile(null);
                      setFileDetail(f);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-neutral-50 active:bg-neutral-100 text-sm font-semibold text-neutral-700 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Info size={18} />
                    </div>
                    <span>{t('details') || 'Details'}</span>
                  </button>

                  {/* Rename */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = activeMenuFile;
                      setActiveMenuFile(null);
                      setRenameFile(f);
                      setNewName(f.name);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-neutral-50 active:bg-neutral-100 text-sm font-semibold text-neutral-700 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Edit2 size={18} />
                    </div>
                    <span>{t('rename') || 'Rename'}</span>
                  </button>

                  {/* Share */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = activeMenuFile;
                      setActiveMenuFile(null);
                      if (onShareFile) onShareFile(f);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-neutral-50 active:bg-neutral-100 text-sm font-semibold text-neutral-700 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Share2 size={18} />
                    </div>
                    <span>{t('share') || 'Share'}</span>
                  </button>

                  {/* Download */}
                  {onDownloadFile && (
                    <button
                      type="button"
                      onClick={() => {
                        const f = activeMenuFile;
                        setActiveMenuFile(null);
                        onDownloadFile(f);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-neutral-50 active:bg-neutral-100 text-sm font-semibold text-neutral-700 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Download size={18} />
                      </div>
                      <span>{t('download') || 'Download'}</span>
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      const f = activeMenuFile;
                      setActiveMenuFile(null);
                      if (onDeleteFile) onDeleteFile(f.id);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-red-50 active:bg-red-100 text-sm font-semibold text-red-600 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      <Trash2 size={18} />
                    </div>
                    <span>{t('delete') || 'Delete'}</span>
                  </button>
                </div>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={() => setActiveMenuFile(null)}
                  className="w-full mt-4 py-3 rounded-full font-bold text-sm text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  {t('cancel') || 'Cancel'}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* File Details Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {fileDetail && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-pointer"
                onClick={() => setFileDetail(null)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="relative bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-neutral-100 z-10 cursor-default"
              >
                <h3 className="text-xl font-display font-bold text-neutral-900 mb-4">{t('fileDetails')}</h3>
                <div className="space-y-3 text-sm">
                  <p><span className="font-bold text-neutral-500">{t('name')}:</span> <span className="break-all">{fileDetail.name}</span></p>
                  <p><span className="font-bold text-neutral-500">{t('type')}:</span> {fileDetail.type.toUpperCase()}</p>
                  <p><span className="font-bold text-neutral-500">{t('size')}:</span> {formatFileSize(fileDetail.size)}</p>
                  <p><span className="font-bold text-neutral-500">{t('created')}:</span> {new Date(fileDetail.createdAt).toLocaleString()}</p>
                  {fileDetail.lastOpenedAt && (
                     <p><span className="font-bold text-neutral-500">{t('lastOpened')}:</span> {new Date(fileDetail.lastOpenedAt).toLocaleString()}</p>
                  )}
                  <p><span className="font-bold text-neutral-500">{t('id')}:</span> <span className="break-all font-mono text-xs">{fileDetail.id}</span></p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFileDetail(null)}
                  className="w-full mt-6 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                >
                  {t('close')}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Rename Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {renameFile && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-pointer"
                onClick={() => setRenameFile(null)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="relative bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-neutral-100 z-10 cursor-default"
              >
                <h3 className="text-xl font-display font-bold text-neutral-900 mb-4">{t('renameFile')}</h3>
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (newName.trim() && onRenameFile) {
                        onRenameFile(renameFile.id, newName.trim());
                      }
                      setRenameFile(null);
                    }
                  }}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setRenameFile(null)}
                    className="flex-1 py-3 rounded-full font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (newName.trim() && onRenameFile) {
                        onRenameFile(renameFile.id, newName.trim());
                      }
                      setRenameFile(null);
                    }}
                    className="flex-1 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    {t('save')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
});
