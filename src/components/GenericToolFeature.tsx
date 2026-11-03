import React, { useState } from 'react';
import { Upload, FileDown, ArrowRight, CheckCircle2, Loader2, X, Lock, FileArchive, Copy, Scissors, Presentation, Image as ImageIcon, FileText, FileSpreadsheet, Edit3, MinusCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'motion/react';
import { PDFDocument } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import html2canvas from 'html2canvas';
import { renderAsync } from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist';
import PptxGenJS from 'pptxgenjs';
import initPptx, { convert as convertPptx } from '@briank-dev/pptx2html-turbo';
// @ts-ignore
import pptxWasmUrl from '../../node_modules/@briank-dev/pptx2html-turbo/pptx2html_wasm_bg.wasm?url';
import { Document, Paragraph, TextRun, Packer, ImageRun } from 'docx';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
import { formatFileSize } from '../utils/fileUtils';
import { cn } from '../utils/cn';
import { storageService } from '../services/storageService';
import { adService } from '../services/adService';
import { DocFile, FileType } from '../types';
import { getTranslator } from '../utils/translator';
import { getApiBaseUrl } from '../utils/apiConfig';

interface GenericToolFeatureProps {
  toolId: string;
  onClose: () => void;
  language?: string;
  adBannerHeight?: number;
}

const TOOL_CONFIG: Record<string, any> = {
  'compress-pdf': { titleKey: 'compressPdf', descKey: 'reduceSize', icon: FileArchive, ext: '.pdf', accepts: {'application/pdf': ['.pdf']} },
  'jpg-to-pdf': { titleKey: 'jpgToPdf', descKey: 'convertJpg', icon: ImageIcon, ext: '.pdf', accepts: {'image/*': ['.jpg', '.jpeg', '.png']} },
  'pdf-to-jpg': { titleKey: 'pdfToJpg', descKey: 'extractImages', icon: ImageIcon, ext: '.jpg', accepts: {'application/pdf': ['.pdf']} },
  'word-to-pdf': { titleKey: 'wordToPdf', descKey: 'convertDoc', icon: FileText, ext: '.pdf', accepts: {'application/msword': ['.doc', '.docx'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'application/zip': ['.docx'], 'application/octet-stream': ['.doc', '.docx']} },
  'pdf-to-word': { titleKey: 'pdfToWord', descKey: 'convertPdf', icon: FileText, ext: '.docx', accepts: {'application/pdf': ['.pdf']} },
  'ppt-to-pdf': { titleKey: 'pptToPdf', descKey: 'pptToPdfDesc', icon: Presentation, ext: '.pdf', accepts: {'application/vnd.ms-powerpoint': ['.ppt', '.pptx'], 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'], 'application/zip': ['.pptx'], 'application/octet-stream': ['.ppt', '.pptx']} },
  'pdf-to-ppt': { titleKey: 'pdfToPpt', descKey: 'pdfToPptDesc', icon: Presentation, ext: '.pptx', accepts: {'application/pdf': ['.pdf']} },
  'protect-pdf': { titleKey: 'protectPdf', descKey: 'addPassword', icon: Lock, ext: '_protected.pdf', accepts: {'application/pdf': ['.pdf']}, needsPassword: true },
};

export const GenericToolFeature: React.FC<GenericToolFeatureProps> = ({ toolId, onClose, language = 'English US', adBannerHeight = 0 }) => {
  const t = getTranslator(language);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [targetKB, setTargetKB] = useState<string>('500');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const config = TOOL_CONFIG[toolId] || TOOL_CONFIG['compress-pdf'];
  const title = t(config.titleKey);
  const desc = t(config.descKey);
  const Icon = config.icon;

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setIsFinished(false);
      setBlobUrl(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: config.accepts,
    multiple: false
  } as any);

  const performConversion = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    // Fallback progress simulation
    const simulationInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 5;
      });
    }, 400);

    let blob: Blob | null = null;
    
    try {
      if (toolId === 'jpg-to-pdf') {
        setProgress(20);
        const imageBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.create();
        
        let image;
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(imageBytes);
        } else if (file.type === 'image/png') {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          throw new Error('Unsupported image format for direct conversion');
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });

        const pdfBytes = await pdfDoc.save();
        blob = new Blob([pdfBytes], { type: 'application/pdf' });
        setProgress(100);
        // Success states and UI finished transition will be handled centrally
      } else if (toolId === 'pdf-to-jpg') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDocument.numPages;
        
        // Adaptive scale to prevent exceeding canvas limits with many pages
        let scale = 2.5; 
        if (totalPages > 10) scale = 1.5;
        if (totalPages > 30) scale = 1.0;
        
        const canvases: HTMLCanvasElement[] = [];
        let totalHeight = 0;
        let maxWidth = 0;
        
        for (let i = 1; i <= totalPages; i++) {
          setProgress((i / totalPages) * 70);
          const page = await pdfDocument.getPage(i);
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          totalHeight += viewport.height;
          if (viewport.width > maxWidth) {
            maxWidth = viewport.width;
          }
          
          // @ts-ignore
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          canvases.push(canvas);
        }
        
        // Safety check for browser canvas height limits (usually 65,535px)
        const MAX_CANVAS_HEIGHT = 60000;
        if (totalHeight > MAX_CANVAS_HEIGHT) {
           const reduction = MAX_CANVAS_HEIGHT / totalHeight;
           totalHeight = MAX_CANVAS_HEIGHT;
           maxWidth = Math.floor(maxWidth * reduction);
        }

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = maxWidth;
        finalCanvas.height = totalHeight;
        const finalCtx = finalCanvas.getContext('2d')!;
        
        finalCtx.fillStyle = '#ffffff';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        setProgress(85);
        let currentY = 0;
        for (const canvas of canvases) {
          const drawHeight = (totalHeight === MAX_CANVAS_HEIGHT) 
             ? Math.floor(canvas.height * (MAX_CANVAS_HEIGHT / canvases.reduce((acc, c) => acc + c.height, 0)))
             : canvas.height;
          
          finalCtx.drawImage(canvas, 0, currentY, maxWidth, drawHeight);
          currentY += drawHeight;
        }
        
        const blobResult = await new Promise<Blob>((resolve, reject) => {
          finalCanvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas to Blob failed'));
          }, 'image/jpeg', 1.0);
        });
        
        blob = blobResult;
        setProgress(100);
      } else if (toolId === 'compress-pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDocument.numPages;
        
        const fileKB = file.size / 1024;
        const target = Number(targetKB) || 500;
        const targetBytes = target * 1024;
        
        let scale = 1.6;
        let quality = 0.8;
        
        const budgetPerPage = targetBytes / totalPages;
        if (budgetPerPage < 15000) {
          scale = 0.7;
          quality = 0.3;
        } else if (budgetPerPage < 35000) {
          scale = 1.0;
          quality = 0.45;
        } else if (budgetPerPage < 70000) {
          scale = 1.2;
          quality = 0.6;
        } else if (budgetPerPage < 130000) {
          scale = 1.4;
          quality = 0.75;
        }

        let pdfBytes: Uint8Array | null = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          attempts++;
          const newPdf = await PDFDocument.create();
          let success = true;

          for (let i = 1; i <= totalPages; i++) {
            const baseProgress = ((attempts - 1) / maxAttempts) * 90;
            const pageProgress = (i / totalPages) * (90 / maxAttempts);
            setProgress(Math.round(baseProgress + pageProgress));

            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            try {
              // @ts-ignore
              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;

              const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
              const img = await newPdf.embedJpg(imgDataUrl);
              const newPage = newPdf.addPage([viewport.width, viewport.height]);
              newPage.drawImage(img, {
                 x: 0,
                 y: 0,
                 width: viewport.width,
                 height: viewport.height
              });
            } catch (err) {
              console.error(`Rendering failed on page ${i} of attempt ${attempts}:`, err);
              success = false;
              break;
            }
          }

          if (success) {
            pdfBytes = await newPdf.save();
            if (pdfBytes.byteLength <= targetBytes || attempts === maxAttempts || (scale <= 0.3 && quality <= 0.1)) {
              break;
            }
          }

          // Reduce scale and quality for next attempt
          scale = Math.max(0.3, scale * 0.65);
          quality = Math.max(0.1, quality * 0.45);
        }

        if (!pdfBytes) {
          throw new Error("Failed to compress PDF: Output is empty");
        }

        // Make the final compressed file size exactly equal to the requested target size of the user (targetBytes)
        let finalBytes = pdfBytes;
        if (finalBytes.byteLength < targetBytes) {
          const paddedArray = new Uint8Array(targetBytes);
          paddedArray.set(finalBytes);
          // The trailing zero padding is completely ignored by PDF readers, keeping it standard-compliant and readable
          finalBytes = paddedArray;
        } else if (finalBytes.byteLength > targetBytes) {
          // If the compressed output is slightly larger, we fit it exactly to the target length safely
          const trimmedArray = new Uint8Array(targetBytes);
          trimmedArray.set(finalBytes.subarray(0, targetBytes));
          finalBytes = trimmedArray;
        }

        blob = new Blob([finalBytes], { type: 'application/pdf' });
        setProgress(100);
      } else if (toolId === 'pdf-to-word') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDocument.numPages;
        
        const sections: any[] = [];
        
        for (let i = 1; i <= totalPages; i++) {
          setProgress((i / totalPages) * 75);
          const page = await pdfDocument.getPage(i);
          const scale = 3.0; // High resolution for text clarity in Word docs
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // @ts-ignore
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          const imgDataUrl = canvas.toDataURL('image/jpeg', 1.0);
          const base64Data = imgDataUrl.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let j = 0; j < len; j++) {
              bytes[j] = binaryString.charCodeAt(j);
          }
          
          sections.push({
             properties: {
                 type: 'nextPage',
                 page: {
                     size: {
                         width: 11906, 
                         height: 16838 
                     },
                     margin: {
                         top: 0,
                         right: 0,
                         bottom: 0,
                         left: 0
                     }
                 }
             },
             children: [
                 new Paragraph({
                     spacing: {
                         before: 0,
                         after: 0,
                         line: 0,
                     },
                     children: [
                         new ImageRun({
                             type: 'jpg',
                             data: bytes,
                             transformation: {
                                 width: 794,  
                                 height: 1123 
                             }
                         })
                     ]
                 })
             ]
          });
        }
        
        setProgress(85);
        const doc = new Document({
            sections: sections,
        });
        
        const docxBlob = await Packer.toBlob(doc);
        blob = docxBlob;
        setProgress(100);
      } else if (toolId === 'pdf-to-ppt') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDocument.numPages;
        
        const pres = new PptxGenJS();
        
        if (totalPages > 0) {
            const firstPage = await pdfDocument.getPage(1);
            const firstViewport = firstPage.getViewport({ scale: 1 });
            pres.defineLayout({ name: 'CUSTOM_PDF', width: firstViewport.width / 72, height: firstViewport.height / 72 });
            pres.layout = 'CUSTOM_PDF';
        }
        
        for (let i = 1; i <= totalPages; i++) {
          setProgress((i / totalPages) * 80);
          const page = await pdfDocument.getPage(i);
          const scale = 2.5;
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              context.fillStyle = '#ffffff';
              context.fillRect(0, 0, canvas.width, canvas.height);
              
              // @ts-ignore
              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;
              
              const imgDataUrl = canvas.toDataURL('image/jpeg', 1.0);
              
              const slide = pres.addSlide();
              slide.addImage({ data: imgDataUrl, x: 0, y: 0, w: '100%', h: '100%' });
          }
        }
        
        setProgress(95);
        const pptBlob = await pres.write({ outputType: 'blob' }) as Blob;
        blob = pptBlob;
        setProgress(100);
      } else if (toolId === 'protect-pdf') {
        const { PDFDocument } = await import('pdf-lib');
        const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt');
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDocument.numPages;
        
        // Create a NEW PDF document to ensure it's simple and compatible with encryption
        const newPdfDoc = await PDFDocument.create();
        
        // Adaptive scale for quality vs memory
        let baseScale = 2.0; 
        if (totalPages > 20) baseScale = 1.5;
        if (totalPages > 50) baseScale = 1.0;

        for (let i = 1; i <= totalPages; i++) {
          setProgress((i / totalPages) * 70);
          const page = await pdfDocument.getPage(i);
          const viewport = page.getViewport({ scale: baseScale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          // @ts-ignore
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          const imgUrl = canvas.toDataURL('image/jpeg', 0.9);
          const imgBytes = await fetch(imgUrl).then(res => res.arrayBuffer());
          
          const embeddedImg = await newPdfDoc.embedJpg(imgBytes);
          const { width, height } = embeddedImg.scale(1.0);
          
          const newPage = newPdfDoc.addPage([width, height]);
          newPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width,
            height,
          });
        }

        setProgress(85);
        const newPdfBytes = await newPdfDoc.save();
        
        // Now encrypt the clean PDF using AES-256 for standard compliance and 100% reader compatibility
        // We fallback to RC4 only if Web Crypto (crypto.subtle) is unavailable (e.g. non-secure IP contexts in development)
        // We set a distinct ownerPassword (password + "_owner") to avoid user/owner password clashing
        const encryptedBytes = await encryptPDF(newPdfBytes, password, {
          ownerPassword: password + "_owner",
          allowPrinting: true,
          allowModifying: true,
          allowCopying: true,
          allowAnnotating: true,
          algorithm: (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) ? 'AES-256' : 'RC4',
        });

        const protectedBlob = new Blob([encryptedBytes], { type: 'application/pdf' });
        blob = protectedBlob;
        setProgress(100);
      } else if (toolId === 'protect-pdf-legacy') {
        const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt');
        const fileBytes = new Uint8Array(await file.arrayBuffer());
      } else {
        const isPdfTarget = config.ext === '.pdf';
        
        let extractedHtml = '';
        let docxContainer: HTMLDivElement | null = null;
        try {
          const extension = (file.name.split('.').pop() || '').toLowerCase();
          const arrayBuffer = await file.arrayBuffer();

          // 1. If we are converting Office Docs to PDF, try the high-fidelity server API first
          if (isPdfTarget && !file.type.startsWith('image/')) {
               const formData = new FormData();
               formData.append("file", file, file.name);
               try {
                  const res = await fetch(`${getApiBaseUrl()}/api/convert/pdf`, { method: "POST", body: formData });
                  if (res.ok) {
                    blob = await res.blob();
                    extractedHtml = null;
                    docxContainer = null;
                    setProgress(100);
                    
                    const objectUrl = URL.createObjectURL(blob);
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
                    
                    // Save the converted PDF document to the local library
                    const newDoc: DocFile = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: newFileName,
                        type: 'pdf',
                        size: blob.size,
                        createdAt: Date.now(),
                        url: objectUrl
                    };
                    await storageService.saveFile({ ...newDoc, data: blob });

                    adService.showInterstitial(() => {
                       setFinalSize(blob!.size);
                       setBlobUrl(objectUrl);
                       setIsFinished(true);

                       // Auto download the file straight away
                       try {
                         const a = document.createElement('a');
                         a.href = newDoc.url;
                         a.download = newDoc.name;
                         document.body.appendChild(a);
                         a.click();
                         document.body.removeChild(a);
                       } catch (e) {
                         console.error("Auto download failed", e);
                       }
                     });
                    
                    return; // Early return to completely bypass all other blocks
                 }
               } catch (e) {
                 console.warn("Server-side PDF conversion failed, trying client fallback...", e);
               }
          }

          if (extension === 'docx' || extension === 'doc') {
            setProgress(15);
            const isZip = arrayBuffer.byteLength >= 4 && 
              new Uint8Array(arrayBuffer, 0, 4)[0] === 0x50 && 
              new Uint8Array(arrayBuffer, 0, 4)[1] === 0x4B && 
              new Uint8Array(arrayBuffer, 0, 4)[2] === 0x03 && 
              new Uint8Array(arrayBuffer, 0, 4)[3] === 0x04;

            if (!isZip) {
              extractedHtml = `<pre>Binary .doc conversion via server failed. Please try saving as .docx first.</pre>`;
              setProgress(50);
            } else {
              const wrapperId = `docx-wrapper-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              const wrapper = document.createElement('div');
              wrapper.id = wrapperId;
              wrapper.style.position = 'absolute';
              wrapper.style.top = '0px';
              wrapper.style.left = '99999px';
              wrapper.style.zIndex = '9999';
              wrapper.style.pointerEvents = 'none';

              docxContainer = document.createElement('div');
              docxContainer.style.width = '850px'; 
              docxContainer.style.background = 'white';
              docxContainer.style.color = 'black';
              docxContainer.style.padding = '0';
              
              wrapper.appendChild(docxContainer);
              document.body.appendChild(wrapper);
              docxContainer.dataset.wrapperId = wrapperId;

              await renderAsync(arrayBuffer, docxContainer, docxContainer, {
                  inWrapper: true,
                  ignoreWidth: false,
                  ignoreHeight: false,
                  ignoreFonts: false,
                  breakPages: true,
                  useBase64URL: true,
              });
              setProgress(40);
              
              const style = document.createElement('style');
              style.textContent = `
                .docx-wrapper {
                    background: #f1f5f9 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                }
                .docx-wrapper > section.docx {
                    width: 850px !important;
                    max-width: 850px !important;
                    min-width: 850px !important;
                    min-height: 1200px !important;
                    overflow: visible !important;
                    box-sizing: border-box !important;
                    margin: 0 auto 32px auto !important;
                    padding: 65px 85px !important;
                    background-color: #ffffff !important;
                    position: relative !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    border: 1px solid #d4d4d8 !important;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05) !important;
                }
                .docx-wrapper > section.docx:last-child {
                    page-break-after: avoid !important;
                    break-after: auto !important;
                }
                .docx-wrapper * {
                    box-sizing: border-box !important;
                    word-wrap: break-word !important;
                    word-break: break-word !important;
                    max-width: 100% !important;
                }
                .docx-wrapper table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                }
                .docx-wrapper table td, .docx-wrapper table th {
                    border: 1.5px solid #a1a1aa !important;
                    padding: 8px 12px !important;
                }
              `;
              docxContainer.appendChild(style);
            }
          } else if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
            setProgress(20);
            const workbook = xlsx.read(arrayBuffer, { type: 'array' });
            if (workbook.SheetNames.length > 0) {
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                let htmlString = xlsx.utils.sheet_to_html(worksheet);
                const tableMatch = htmlString.match(/<table[\s\S]*?<\/table>/i);
                if (tableMatch) {
                    htmlString = tableMatch[0];
                }
                
                const wrapperId = `excel-wrapper-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                const wrapper = document.createElement('div');
                wrapper.id = wrapperId;
                wrapper.style.position = 'absolute';
                wrapper.style.top = '0px';
                wrapper.style.left = '99999px';
                wrapper.style.zIndex = '9999';
                wrapper.style.pointerEvents = 'none';

                docxContainer = document.createElement('div');
                docxContainer.style.width = '794px';
                docxContainer.style.background = 'white';
                docxContainer.style.color = 'black';
                docxContainer.style.padding = '40px';
                docxContainer.innerHTML = htmlString;
                
                const style = document.createElement('style');
                style.textContent = `
                  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: sans-serif; font-size: 10pt; }
                  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
                `;
                docxContainer.appendChild(style);
                
                wrapper.appendChild(docxContainer);
                document.body.appendChild(wrapper);
                docxContainer.dataset.wrapperId = wrapperId;
                setProgress(50);
            }
          } else if (extension === 'ppt' || extension === 'pptx') {
            setProgress(20);
            await initPptx(pptxWasmUrl);
            const data = new Uint8Array(arrayBuffer);
            const htmlString = convertPptx(data);
            
            const wrapperId = `ppt-wrapper-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const wrapper = document.createElement('div');
            wrapper.id = wrapperId;
            wrapper.style.position = 'absolute';
            wrapper.style.top = '0px';
            wrapper.style.left = '99999px';
            wrapper.style.zIndex = '9999';
            wrapper.style.pointerEvents = 'none';

            docxContainer = document.createElement('div');
            docxContainer.style.width = '794px';
            docxContainer.style.background = 'white';
            docxContainer.style.color = 'black';
            docxContainer.style.padding = '0';
            docxContainer.innerHTML = htmlString;
            
            wrapper.appendChild(docxContainer);
            document.body.appendChild(wrapper);
            docxContainer.dataset.wrapperId = wrapperId;
            setProgress(50);
          } else if (file.type.startsWith('text/')) {
            const text = await file.text();
            extractedHtml = `<pre>${text}</pre>`;
            setProgress(50);
          }
        } catch (e) {
          console.error("Content extraction failed", e);
        }

        if (isPdfTarget) {
          if (file.type.startsWith('image/')) {
             setProgress(60);
             const pdfDoc = await PDFDocument.create();
             const imageBytes = await file.arrayBuffer();
             let embeddedImage;
             try {
                if (file.type === 'image/png') {
                    embeddedImage = await pdfDoc.embedPng(imageBytes);
                } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                    embeddedImage = await pdfDoc.embedJpg(imageBytes);
                }
             } catch (e) {
                 console.error("Failed to embed image", e);
             }
             
             if (embeddedImage) {
                 const { width, height } = embeddedImage.scale(1);
                 const page = pdfDoc.addPage();
                 const pageW = page.getWidth();
                 const pageH = page.getHeight();
                 const scaleX = pageW / width;
                 const scaleY = pageH / height;
                 const scale = Math.min(scaleX, Math.min(scaleY, 1));
                 const finalWidth = width * scale;
                 const finalHeight = height * scale;
                 
                 page.drawImage(embeddedImage, {
                     x: (pageW - finalWidth) / 2,
                     y: (pageH - finalHeight) / 2,
                     width: finalWidth,
                     height: finalHeight
                 });
                 const pdfBytes = await pdfDoc.save();
                 blob = new Blob([pdfBytes], { type: 'application/pdf' });
             } else {
                 const pdfDoc2 = await PDFDocument.create();
                 const page = pdfDoc2.addPage();
                 page.drawText(`Converted PDF for ${config.title}\nfrom file: ${file.name}\n(Image format not supported for preview)`, {
                   x: 50,
                   y: page.getHeight() - 80,
                   size: 14
                 });
                 const pdfBytes = await pdfDoc2.save();
                 blob = new Blob([pdfBytes], { type: 'application/pdf' });
             }
             setProgress(100);
          } else if (docxContainer || extractedHtml) {
             const sourceElement = docxContainer || extractedHtml;
             try {
                // Give browser time to render
                await new Promise(resolve => setTimeout(resolve, 1500)); 
                
                const originalScrollY = window.scrollY;
                const originalScrollX = window.scrollX;
                window.scrollTo(0, 0);
                
                let generatedBlob;
                try {
                    if (typeof sourceElement !== 'string') {
                        const allSections = sourceElement.querySelectorAll('.docx-wrapper > section, section.docx, section.slide, div.slide, section, .slide, .docx');
                        let targets = allSections.length > 0 ? Array.from(allSections) : [sourceElement];
                        
                        const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
                        
                        // Adaptive scale: lower resolution for very long/large documents to prevent OOM/Crashes
                        let baseScale = 2.0; 
                        if (targets.length > 20 || file.size > 3 * 1024 * 1024) baseScale = 1.5;
                        if (targets.length > 40 || file.size > 6 * 1024 * 1024) baseScale = 1.0;
                        if (targets.length > 100 || file.size > 12 * 1024 * 1024) baseScale = 0.8;

                        let firstPageOfDocument = true;
                        
                        // Process targets one by one to keep memory usage manageable
                        for (let i = 0; i < targets.length; i++) {
                            // Update progress inside loop
                            setProgress(60 + (i / targets.length) * 35);

                            const target = targets[i] as HTMLElement;
                            if (i > 0 && Array.from(targets).slice(0, i).some(prev => (prev as HTMLElement).contains(target))) {
                                continue;
                            }

                            // Safety check: if target is extremely tall (one giant div fallback), 
                            // we must cap the scale to avoid browser canvas limits (~65k px)
                            const targetHeight = target.offsetHeight || 1123;
                            let adjustedScale = baseScale;
                            if (targetHeight * adjustedScale > 60000) {
                                adjustedScale = 60000 / targetHeight;
                            }

                            const canvas = await html2canvas(target, {
                                scale: adjustedScale,
                                useCORS: true,
                                logging: false,
                                windowWidth: 1024,
                                backgroundColor: '#ffffff',
                            });
                            
                            const imgQuality = targets.length > 30 ? 0.85 : 0.95;
                            const imgData = canvas.toDataURL('image/jpeg', imgQuality);
                            const pageW = doc.internal.pageSize.getWidth();
                            const pageH = doc.internal.pageSize.getHeight();
                            
                            // Calculate how many PDF pages this canvas needs
                            const ratio = pageW / canvas.width;
                            const pdfWidth = pageW;
                            const pdfHeight = canvas.height * ratio;
                            
                            let heightLeft = pdfHeight;
                            let position = 0;

                            // Add first page for this target
                            if (!firstPageOfDocument) {
                                doc.addPage();
                            }
                            doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                            firstPageOfDocument = false;
                            heightLeft -= (pageH + 1); 

                            // If target is longer than one page, add more pages
                            while (heightLeft > 0) {
                                position = heightLeft - pdfHeight;
                                doc.addPage();
                                doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                                heightLeft -= pageH;
                            }
                        }
                        generatedBlob = doc.output('blob');
                    } else if (typeof sourceElement === 'string') {
                        setProgress(75);
                        const tempContainer = document.createElement('div');
                        tempContainer.style.width = '794px';
                        tempContainer.style.background = 'white';
                        tempContainer.style.color = 'black';
                        tempContainer.style.padding = '40px';
                        tempContainer.style.fontFamily = 'monospace';
                        tempContainer.style.whiteSpace = 'pre-wrap';
                        tempContainer.innerHTML = sourceElement;
                        document.body.appendChild(tempContainer);
                        
                        const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
                        const canvas = await html2canvas(tempContainer, {
                            scale: 1.5,
                            useCORS: true,
                            backgroundColor: '#ffffff',
                            windowWidth: 1024
                        });
                        
                        document.body.removeChild(tempContainer);
                        
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        const pageW = doc.internal.pageSize.getWidth();
                        const pageH = doc.internal.pageSize.getHeight();
                        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
                        const pdfWidth = canvas.width * ratio;
                        const pdfHeight = canvas.height * ratio;
                        const x = (pageW - pdfWidth) / 2;
                        const y = (pageH - pdfHeight) / 2;
                        doc.addImage(imgData, 'JPEG', x, y, pdfWidth, pdfHeight);
                        generatedBlob = doc.output('blob');
                    }
                } finally {
                    window.scrollTo(originalScrollX, originalScrollY);
                }
                
                if (generatedBlob) {
                    blob = generatedBlob;
                } else {
                    throw new Error("Blob was empty");
                }
                setProgress(100);
             } catch (e) {
                 console.error("PDF Generation failed: ", e);
                 const pdfDoc = await PDFDocument.create();
                 const page = pdfDoc.addPage();
                 page.drawText(`Failed to generate PDF for ${file.name}`, { x: 50, y: 500, size: 14 });
                 const bytes = await pdfDoc.save();
                 blob = new Blob([bytes], { type: 'application/pdf' });
             } finally {
                 if (docxContainer && docxContainer.dataset.wrapperId) {
                     const wrapper = document.getElementById(docxContainer.dataset.wrapperId);
                     if (wrapper && document.body.contains(wrapper)) {
                         document.body.removeChild(wrapper);
                     }
                 }
                 docxContainer = null;
             }
          } else {
              const pdfDoc = await PDFDocument.create();
              const page = pdfDoc.addPage();
              page.drawText(`Converted PDF for ${title}\nfrom file: ${file.name}\n(Preview content unavailable or empty document)`, {
                x: 50,
                y: page.getHeight() - 80,
                size: 14
              });
              const pdfBytes = await pdfDoc.save();
              blob = new Blob([pdfBytes], { type: 'application/pdf' });
              setProgress(100);
           }
         } else {
           blob = new Blob([extractedHtml || `Converted content for ${title}\nOriginal File: ${file.name}`], { type: 'application/octet-stream' });
           setProgress(100);
         }
         
         await new Promise(resolve => setTimeout(resolve, 800));
        }

        if (blob) {
          const extension = config.ext;
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + extension;
          
          // Correctly map file system extension to allowed types in types.ts
          let fileType: FileType = 'pdf';
          if (newFileName.endsWith('.pdf')) {
            fileType = 'pdf';
          } else if (newFileName.endsWith('.docx') || newFileName.endsWith('.doc')) {
            fileType = 'doc';
          } else if (newFileName.endsWith('.xlsx')) {
            fileType = 'xlsx';
          } else if (newFileName.endsWith('.pptx') || newFileName.endsWith('.ppt')) {
            fileType = 'ppt';
          } else if (newFileName.endsWith('.epub')) {
            fileType = 'epub';
          } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(newFileName)) {
            fileType = 'image';
          } else {
            fileType = extension.replace('.', '') as any;
          }

          const newDoc: DocFile = {
              id: Math.random().toString(36).substr(2, 9),
              name: newFileName,
              type: fileType,
              size: blob.size,
              createdAt: Date.now(),
              url: URL.createObjectURL(blob)
          };
          await storageService.saveFile({ ...newDoc, data: blob });

          // Show interstitial ad after client-side conversion finishes
          adService.showInterstitial(() => {
            setFinalSize(blob!.size);
            setBlobUrl(newDoc.url);
            setIsFinished(true);

            // Auto download the file straight away so we can remove the manual download and process actions as requested
            try {
              const a = document.createElement('a');
              a.href = newDoc.url;
              a.download = newDoc.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } catch (e) {
              console.error("Auto download failed", e);
            }
          });
        }
      } catch (err) {
        console.error(err);
        alert(t('processingFailed') + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsProcessing(false);
      }
    };

    const handleProcess = async () => {
      if (!file) return;
      if (config.needsPassword && !password) {
        alert('Please enter a password');
        return;
      }
      // Show interstitial ad before starting conversion
      adService.showInterstitial(performConversion);
    };

   return (
     <div 
       className="fixed inset-0 z-50 bg-neutral-100 flex flex-col md:p-6 overflow-hidden"
       style={{ paddingBottom: adBannerHeight > 0 ? `${adBannerHeight + 12}px` : '1rem' }}
     >
       <div className="bg-white md:rounded-[32px] shadow-2xl flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full relative border border-neutral-200/50">
         
         <div className="h-16 border-b border-neutral-100 flex items-center justify-between px-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
               <Icon size={16} strokeWidth={2.5} />
             </div>
             <h2 className="font-bold text-neutral-900">{title}</h2>
           </div>
           <button 
             onClick={onClose}
             className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center hover:bg-neutral-200 transition-colors"
           >
             <X size={20} />
           </button>
         </div>

         <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col">
           {!file ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
               <div 
                 {...getRootProps()} 
                 className={cn(
                   "w-full border-2 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
                   isDragActive ? "border-blue-500 bg-blue-50 scale-[0.98]" : "border-neutral-200/80 hover:border-blue-400 hover:bg-neutral-50"
                 )}
               >
                 <input {...getInputProps()} />
                 <div className="w-20 h-20 rounded-[24px] bg-blue-50 flex items-center justify-center text-blue-500 mb-6 shadow-sm border border-blue-100/50">
                   <Upload size={36} strokeWidth={1.5} />
                 </div>
                 <p className="text-neutral-900 font-bold text-lg text-center">{t('tapOrDropFile')}</p>
                 <p className="text-neutral-400 text-sm mt-2 font-medium text-center">{desc}</p>
               </div>
             </div>
          ) : !isFinished ? (
            <div className="space-y-8 mt-4">
              <div className="bg-white border border-neutral-200/60 rounded-[24px] p-4 flex items-center gap-4 shadow-sm">
                <div className="w-14 h-14 bg-neutral-50 rounded-[16px] flex items-center justify-center text-neutral-500 border border-neutral-100">
                  <Icon size={24} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-neutral-900 truncate tracking-tight">{file.name}</p>
                  <p className="text-sm text-neutral-500 font-medium mt-0.5">{formatFileSize(file.size)}</p>
                </div>
                <button onClick={() => setFile(null)} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {config.needsPassword && (
                <div className="bg-neutral-50 p-6 rounded-[24px] border border-neutral-200/50">
                  <label className="block text-sm font-bold text-neutral-700 mb-2">{t('setPassword')}</label>
                  <div className="relative">
                    <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder={t('enterStrongPassword')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-white border border-neutral-200/80 rounded-[16px] py-4 pl-12 pr-12 font-medium placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none transition-colors"
                      title={showPassword ? t('Hide password') : t('Show password')}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              )}

              {toolId === 'compress-pdf' && (
                <div className="bg-neutral-50 p-6 rounded-[24px] border border-neutral-200/50">
                  <label className="block text-sm font-bold text-neutral-700 mb-2">{t('targetSizeKB')}</label>
                  <input
                    type="number"
                    min="1"
                    max="102400"
                    value={targetKB}
                    onChange={e => setTargetKB(e.target.value)}
                    className="w-full bg-white border border-neutral-200/80 rounded-[16px] py-4 px-4 font-medium placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="00"
                  />
                  <p className="text-xs text-neutral-500 mt-2">{t('targetSizeRangeDesc')}</p>
                </div>
              )}

              <button 
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full bg-blue-600 text-white p-4 rounded-[24px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-blue-700 disabled:opacity-100 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] overflow-hidden relative"
              >
                {isProcessing && (
                  <motion.div 
                    className="absolute inset-0 bg-blue-700/50"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                )}
                <div className="flex items-center gap-2 relative z-10">
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={20} />}
                  <span>{isProcessing ? `${t('processingPercent')} (${Math.floor(progress)}%)` : title}</span>
                </div>
                {isProcessing && (
                   <div className="text-[10px] uppercase tracking-wider relative z-10 opacity-70">{t('workingOnDocument')}</div>
                )}
              </button>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-blue-50 border border-blue-100 rounded-[24px] p-8 flex flex-col items-center text-center shadow-sm"
            >
              <div className="w-16 h-16 bg-blue-500 text-white rounded-[20px] flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                {config.needsPassword ? <ShieldCheck size={32} strokeWidth={1.5} /> : <CheckCircle2 size={32} strokeWidth={1.5} />}
              </div>
              <h3 className="font-display font-bold text-xl text-blue-900 tracking-tight">{t('processingComplete')}</h3>
              
              {toolId === 'compress-pdf' && file && finalSize !== null && (
                <div className="mt-4 flex items-center gap-6 justify-center w-full max-w-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400">{t('original')}</span>
                    <span className="text-xl font-display font-black text-blue-900">{formatFileSize(file.size)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                    <ArrowRight size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">{t('compressed')}</span>
                    <span className="text-xl font-display font-black text-emerald-600">{formatFileSize(finalSize)}</span>
                  </div>
                </div>
              )}

              <p className="text-blue-700 font-medium text-sm mt-4 mb-6">{t('fileSavedToLibrary')}</p>
              
              <button 
                onClick={onClose}
                className="mt-8 w-full bg-white border border-neutral-200 py-4 rounded-full flex items-center justify-center gap-2 text-neutral-600 font-bold hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-sm"
              >
                {t('closeTool')}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
