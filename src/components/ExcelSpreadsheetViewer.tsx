import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ZoomIn, ZoomOut, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExcelSpreadsheetViewerProps {
  excelData: any[][];
  sheetNames: string[];
  currentSheet: string;
  onSheetSelect: (name: string) => void;
  fileName: string;
  fileId: string;
  t: (key: any) => string;
}

const getExcelColName = (colIdx: number): string => {
  let temp = colIdx;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

const getExcelAlignmentClass = (cellVal: any): string => {
  if (cellVal === undefined || cellVal === null || cellVal === '') return 'text-left';
  const str = String(cellVal).trim();
  const isNumeric = /^\s*[-+]?(?:\d[\d,]*\.?\d*|\.\d+)\s*%?$/i.test(str) || /^\s*[\$₹€£]?\s*[-+]?(?:\d[\d,]*\.?\d*|\.\d+)\s*$/i.test(str);
  if (isNumeric) return 'text-right font-mono text-neutral-900';
  return 'text-left';
};

export const ExcelSpreadsheetViewer: React.FC<ExcelSpreadsheetViewerProps> = ({
  excelData,
  sheetNames,
  currentSheet,
  onSheetSelect,
  fileName,
  fileId,
  t
}) => {
  const [excelZoom, setExcelZoom] = useState(1.0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number; val: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleRowsCount, setVisibleRowsCount] = useState(250);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  // Reset states on sheet or file change
  useEffect(() => {
    setSearchQuery('');
    setVisibleRowsCount(250);
    if (excelData && excelData.length > 0 && excelData[0].length > 0) {
      setSelectedCell({
        row: 0,
        col: 0,
        val: excelData[0][0] !== null && excelData[0][0] !== undefined ? String(excelData[0][0]) : ''
      });
    } else {
      setSelectedCell(null);
    }
  }, [fileId, currentSheet]);

  // Touch gesture listeners for 2-finger pinch zoom & double-tap
  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Double-tap detection
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTouchTimeRef.current < 300) {
        setExcelZoom(prev => (Math.abs(prev - 1.0) > 0.05 ? 1.0 : 1.4));
        lastTouchTimeRef.current = 0;
        return;
      }
      lastTouchTimeRef.current = now;
    }

    if (e.touches.length === 2) {
      const dist = getTouchDistance(e);
      if (dist !== null) {
        lastTouchDistanceRef.current = dist;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const dist = getTouchDistance(e);
      if (dist !== null) {
        if (e.cancelable) e.preventDefault();
        const delta = dist / lastTouchDistanceRef.current;
        lastTouchDistanceRef.current = dist;
        setExcelZoom(prev => {
          const next = prev * delta;
          return Math.max(0.4, Math.min(next, 2.0));
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastTouchDistanceRef.current = null;
    }
  };

  // Ctrl + Mouse Wheel zoom for desktop / laptops
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setExcelZoom(prev => Math.max(0.4, Math.min(prev * delta, 2.0)));
    }
  };

  // Infinite scroll row loading
  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 250) {
      setVisibleRowsCount(prev => Math.min(prev + 200, excelData.length));
    }
  };

  // Search filtering
  const q = searchQuery.toLowerCase().trim();
  const rowsWithKey = excelData.map((row, originalIdx) => ({ row, originalIdx }));
  const filteredExcelRows = q
    ? rowsWithKey.filter(({ row, originalIdx }) => {
        if (originalIdx === 0) return true;
        return row.some(cell => {
          if (cell === null || cell === undefined) return false;
          return String(cell).toLowerCase().includes(q);
        });
      })
    : rowsWithKey;

  const paginatedRows = filteredExcelRows.slice(0, visibleRowsCount);

  // Search query highlight
  const renderCellWithHighlight = (value: string) => {
    if (!q) return value;
    try {
      const escapedQuery = searchQuery.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const parts = value.split(new RegExp(`(${escapedQuery})`, 'gi'));
      return (
        <>
          {parts.map((part, index) =>
            part.toLowerCase() === q ? (
              <mark key={index} className="bg-yellow-200 text-yellow-950 font-bold px-0.5 rounded-[2px] border border-yellow-300">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch {
      return value;
    }
  };

  // Dynamic scaled dimensions based on excelZoom
  const colWidth = Math.max(48, Math.round(112 * excelZoom));
  const rowHeaderWidth = Math.max(28, Math.round(44 * excelZoom));
  const fontSize = Math.max(8, Math.round(11 * excelZoom));
  const paddingX = Math.max(3, Math.round(8 * excelZoom));
  const paddingY = Math.max(2, Math.round(5 * excelZoom));
  const cellHeight = Math.max(18, Math.round(26 * excelZoom));

  return (
    <div className="h-full w-full bg-[#f8f9fa] flex flex-col overflow-hidden select-none">
      {/* 1. TOP EXCEL TOOLBAR: Sheet Tabs & Quick Search */}
      <div className="border-b border-neutral-300 bg-[#f1f3f6] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Worksheets sheet selection tabs styled like real Excel */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-[200px]">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-1 rounded border border-emerald-200 shrink-0 flex items-center gap-1">
            <FileSpreadsheet size={12} className="text-emerald-700" />
            {t('sheets')}
          </span>
          {sheetNames.map(name => (
            <button
              key={name}
              onClick={() => onSheetSelect(name)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all border whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                currentSheet === name
                  ? "bg-white border-b-2 border-b-emerald-600 text-emerald-800 shadow-xs border-neutral-300 font-extrabold"
                  : "bg-neutral-200/70 border-transparent text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Zoom controls & Search */}
        <div className="flex items-center gap-2">
          {/* Quick Step Zoom Buttons */}
          <div className="flex items-center bg-white border border-neutral-300 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setExcelZoom(prev => Math.max(0.4, Number((prev - 0.15).toFixed(2))))}
              className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 rounded active:scale-95 transition-all text-xs cursor-pointer"
              title="Zoom Out (PC view)"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[10px] font-mono font-bold text-neutral-700 px-1.5 min-w-[34px] text-center">
              {Math.round(excelZoom * 100)}%
            </span>
            <button
              onClick={() => setExcelZoom(prev => Math.min(2.0, Number((prev + 0.15).toFixed(2))))}
              className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 rounded active:scale-95 transition-all text-xs cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={12} />
            <input
              type="text"
              placeholder={t('searchPlaceholder') || "Search in sheet..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-300 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 rounded-lg pl-7 pr-6 py-1 text-xs text-neutral-800 placeholder-neutral-400 outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. FORMULA / ACTIVE CELL BAR (Like PC/Laptop Excel!) */}
      <div className="bg-[#fcfdfe] border-b border-neutral-300 px-3 py-1 flex items-center gap-2 text-xs font-mono shrink-0 shadow-2xs select-none">
        {/* Coordinate Name Box (e.g. A1, B4) */}
        <div className="bg-white border border-neutral-300 rounded px-2.5 py-0.5 font-bold text-neutral-700 text-center min-w-[50px] shadow-2xs text-[11px]">
          {selectedCell ? `${getExcelColName(selectedCell.col)}${selectedCell.row + 1}` : 'A1'}
        </div>
        
        {/* Formula fx Icon */}
        <div className="text-neutral-400 font-serif italic font-bold select-none px-1 text-xs">
          fx
        </div>

        {/* Selected Cell Value Input/Display */}
        <div className="flex-1 bg-white border border-neutral-200 rounded px-2.5 py-0.5 text-neutral-800 text-xs truncate font-sans min-h-[24px] flex items-center shadow-2xs select-text">
          {selectedCell?.val || ''}
        </div>

        {/* Row count summary */}
        <div className="text-[10px] font-mono text-neutral-400 font-semibold uppercase px-1 hidden sm:block">
          {excelData.length} Rows × {excelData[0]?.length || 0} Cols
        </div>
      </div>

      {/* 3. MAIN SPREADSHEET GRID (Full-Bleed, Native 2D Scroll, Sticky Headers) */}
      <div
        ref={containerRef}
        className="w-full flex-1 overflow-auto bg-[#eef1f5] relative select-none scrollbar-thin"
        onScroll={handleGridScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <table className="border-collapse bg-white inline-block min-w-full table-fixed select-text">
          {/* Column Headers (A, B, C, D...) */}
          <thead className="sticky top-0 z-30 bg-[#f0f3f6] shadow-xs select-none">
            <tr>
              {/* Top-Left Corner Cell Intersection */}
              <th
                className="sticky top-0 left-0 z-40 bg-[#e2e6eb] border-r border-b border-neutral-300 text-center font-mono font-bold text-neutral-500 select-none shadow-[1px_1px_2px_rgba(0,0,0,0.04)]"
                style={{
                  width: `${rowHeaderWidth}px`,
                  minWidth: `${rowHeaderWidth}px`,
                  height: `${cellHeight}px`
                }}
              >
                #
              </th>

              {/* Column Letter Headers */}
              {excelData[0]?.map((_, colIdx) => (
                <th
                  key={colIdx}
                  className="sticky top-0 z-30 bg-[#f0f3f6] border-r border-b border-neutral-300 text-center font-mono font-bold text-neutral-600 uppercase tracking-wider select-none"
                  style={{
                    width: `${colWidth}px`,
                    minWidth: `${colWidth}px`,
                    fontSize: `${fontSize}px`,
                    padding: `${paddingY}px ${paddingX}px`,
                    height: `${cellHeight}px`
                  }}
                >
                  {getExcelColName(colIdx)}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Data Rows */}
          <tbody>
            {paginatedRows.map(({ row, originalIdx }) => {
              const isSelectedRow = selectedCell?.row === originalIdx;
              return (
                <tr
                  key={originalIdx}
                  className={`transition-colors ${
                    originalIdx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                  } ${isSelectedRow ? 'bg-emerald-50/20' : ''}`}
                >
                  {/* Row Number Header (1, 2, 3...) - Sticky Left */}
                  <td
                    className="sticky left-0 z-20 bg-[#f0f3f6] border-r border-b border-neutral-300 text-center font-mono font-bold text-neutral-500 select-none shadow-[1px_0_2px_rgba(0,0,0,0.03)]"
                    style={{
                      width: `${rowHeaderWidth}px`,
                      minWidth: `${rowHeaderWidth}px`,
                      fontSize: `${Math.max(7, Math.round(9 * excelZoom))}px`,
                      height: `${cellHeight}px`
                    }}
                  >
                    {originalIdx + 1}
                  </td>

                  {/* Data Cells */}
                  {row.map((cell, cellIdx) => {
                    const cellStrVal = cell !== null && cell !== undefined ? String(cell) : '';
                    const alignmentClass = getExcelAlignmentClass(cell);
                    const isCellSelected = selectedCell?.row === originalIdx && selectedCell?.col === cellIdx;

                    return (
                      <td
                        key={cellIdx}
                        onClick={() => setSelectedCell({ row: originalIdx, col: cellIdx, val: cellStrVal })}
                        className={`border-r border-b border-neutral-200 text-neutral-800 truncate font-medium cursor-pointer transition-colors ${alignmentClass} ${
                          isCellSelected
                            ? "ring-2 ring-emerald-600 ring-inset bg-emerald-50/70 font-semibold"
                            : "hover:bg-neutral-100/60"
                        }`}
                        style={{
                          width: `${colWidth}px`,
                          minWidth: `${colWidth}px`,
                          maxWidth: `${colWidth * 2.5}px`,
                          fontSize: `${fontSize}px`,
                          padding: `${paddingY}px ${paddingX}px`,
                          height: `${cellHeight}px`,
                          lineHeight: `${cellHeight}px`
                        }}
                        title={cellStrVal}
                      >
                        {renderCellWithHighlight(cellStrVal)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. FLOATING HUD FOR ZOOM STATUS & 1-TAP RESET */}
      <AnimatePresence>
        {Math.abs(excelZoom - 1.0) > 0.02 && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-16 right-4 sm:bottom-6 sm:right-6 bg-neutral-900/90 backdrop-blur-md text-white border border-white/15 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl z-[9999] select-none pointer-events-auto"
          >
            <button
              onClick={() => setExcelZoom(prev => Math.max(0.4, Number((prev - 0.15).toFixed(2))))}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-xs font-bold cursor-pointer text-neutral-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-bold font-mono min-w-[36px] text-center text-neutral-100">
              {Math.round(excelZoom * 100)}%
            </span>
            <button
              onClick={() => setExcelZoom(prev => Math.min(2.0, Number((prev + 0.15).toFixed(2))))}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all text-xs font-bold cursor-pointer text-neutral-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-[1px] h-4 bg-white/15" />
            <button
              onClick={() => setExcelZoom(1.0)}
              className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/35 active:scale-95 rounded-md transition-all flex items-center gap-1 cursor-pointer"
              title="Reset to 100%"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. FOOTER STATUS BAR */}
      <div className="p-3 bg-white border-t border-neutral-300 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 text-neutral-600 font-sans">
          <FileSpreadsheet size={16} className="text-emerald-600" />
          <span className="text-xs font-bold truncate max-w-[200px] sm:max-w-md">{fileName}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono font-medium text-neutral-500">
          <span>{currentSheet}</span>
          <span className="text-neutral-300">|</span>
          <span>{Math.round(excelZoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
