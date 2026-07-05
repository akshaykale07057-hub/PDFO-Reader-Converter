import React, { useState, useEffect, useRef } from 'react';
import { FileText, FileSpreadsheet, FilePieChart, BookOpen, Image as ImageIcon, MoreVertical, Clock, Edit2, Trash2, Share2, CircleCheck, Circle, Download, Info, RefreshCw } from 'lucide-react';
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

export const FileList: React.FC<FileListProps> = ({ files, onFileClick, onRenameFile, onDeleteFile, onShareFile, onShareFiles, onDownloadFile, title, language = 'English US', onRefresh }) => {
  const markFileAsOpened = useMarkFileAsOpened();
  const t = getTranslator(language);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameFile, setRenameFile] = useState<DocFile | null>(null);
  const [fileDetail, setFileDetail] = useState<DocFile | null>(null);
  const [newName, setNewName] = useState('');
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

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
        <p className="text-sm font-semibold text-neutral-600 mb-6">{t('noDocumentsFound') || "No documents found"}</p>
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
              "w-full flex items-center gap-4 p-4 bg-white border rounded-[20px] hover:shadow-md transition-all duration-300 text-left relative select-none",
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
              <div className="relative" onPointerDown={e => e.stopPropagation()}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === file.id ? null : file.id);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors"
                >
                  <MoreVertical size={18} className="text-neutral-400" />
                </button>

                <AnimatePresence>
                  {openMenuId === file.id && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-10 w-40 bg-white rounded-2xl shadow-xl border border-neutral-100 z-50 overflow-hidden"
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileDetail(file);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 text-sm font-medium text-neutral-700 transition-colors"
                      >
                        <Info size={16} />
                        {t('details')}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameFile(file);
                          setNewName(file.name);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 text-sm font-medium text-neutral-700 transition-colors border-t border-neutral-50"
                      >
                        <Edit2 size={16} />
                        {t('rename')}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onShareFile) onShareFile(file);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 text-sm font-medium text-neutral-700 transition-colors border-t border-neutral-50"
                      >
                        <Share2 size={16} />
                        {t('share')}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteFile) onDeleteFile(file.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-sm font-medium text-red-600 transition-colors border-t border-neutral-50"
                      >
                        <Trash2 size={16} />
                        {t('delete')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-28 left-0 right-0 px-4 flex justify-center z-50"
          >
            <div className="bg-neutral-900 border border-neutral-700 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl shadow-black/50 text-white w-full max-w-sm justify-between">
              <span className="font-bold text-sm">{selectedIds.size} {t('selected')}</span>
              <div className="flex items-center gap-2">
                <button 
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
      </AnimatePresence>

      <AnimatePresence>
        {fileDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm cursor-pointer"
            onClick={() => setFileDetail(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-neutral-100 cursor-default"
            >
              <h3 className="text-xl font-display font-bold text-neutral-900 mb-4">{t('fileDetails')}</h3>
              <div className="space-y-3 text-sm">
                <p><span className="font-bold text-neutral-500">{t('name')}:</span> {fileDetail.name}</p>
                <p><span className="font-bold text-neutral-500">{t('type')}:</span> {fileDetail.type.toUpperCase()}</p>
                <p><span className="font-bold text-neutral-500">{t('size')}:</span> {formatFileSize(fileDetail.size)}</p>
                <p><span className="font-bold text-neutral-500">{t('created')}:</span> {new Date(fileDetail.createdAt).toLocaleString()}</p>
                {fileDetail.lastOpenedAt && (
                   <p><span className="font-bold text-neutral-500">{t('lastOpened')}:</span> {new Date(fileDetail.lastOpenedAt).toLocaleString()}</p>
                )}
                <p><span className="font-bold text-neutral-500">{t('id')}:</span> {fileDetail.id}</p>
              </div>
              <button 
                onClick={() => setFileDetail(null)}
                className="w-full mt-6 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                {t('close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {renameFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm cursor-pointer"
            onClick={() => setRenameFile(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-neutral-100 cursor-default"
            >
              <h3 className="text-xl font-display font-bold text-neutral-900 mb-4">{t('renameFile')}</h3>
              <input 
                type="text" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                autoFocus
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setRenameFile(null)}
                  className="flex-1 py-3 rounded-full font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={() => {
                    if (newName.trim() && onRenameFile) {
                      onRenameFile(renameFile.id, newName.trim());
                    }
                    setRenameFile(null);
                  }}
                  className="flex-1 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  {t('save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
