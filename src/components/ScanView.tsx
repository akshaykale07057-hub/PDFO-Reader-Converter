import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  Camera, Check, X, Trash2, RefreshCw, Image as ImageIcon, RotateCw, 
  Zap, Loader2, Crop, Sparkles, SlidersHorizontal, Sun, Contrast, 
  RotateCcw, Eye, Layers, FileText, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { imagesToPdf } from '../utils/fileUtils';
import { 
  autoCropDocument, checkStabilityForAutoCapture, rotateImage, 
  detectCornersFromSource, DocumentBounds, warpPerspective, Point2D,
  applyImageFilter, FilterType, FilterOptions
} from '../utils/imageProcessing';
import { storageService } from '../services/storageService';
import { DocFile } from '../types';
import { cn } from '../utils/cn';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ScanViewProps {
  onComplete: (file: DocFile) => void;
  onCancel: () => void;
  requirePremiumOrAd?: (callback: () => void) => void;
  adBannerHeight?: number;
}

export interface CapturedImage {
  id: string;
  url: string;
  originalUrl: string;
  filter?: FilterType;
  brightness?: number;
  contrast?: number;
}

export const FILTER_OPTIONS: { id: FilterType; label: string; description: string; icon: any }[] = [
  { id: 'clear', label: 'Clear & Visible', description: 'Magic Color: crisp text & white background', icon: Sparkles },
  { id: 'bw', label: 'B&W Document', description: 'High contrast text, zero background shadows', icon: FileText },
  { id: 'grayscale', label: 'Grayscale', description: 'Balanced smooth tones for diagrams & charts', icon: Layers },
  { id: 'brighten', label: 'Brighten', description: 'Lifts shadows & improves low light photos', icon: Sun },
  { id: 'original', label: 'Original', description: 'Natural camera photo without enhancement', icon: ImageIcon },
];

const SortableImageItem: React.FC<{ img: CapturedImage, idx: number, setPreviewIndex: (i: number) => void, removeImage: (i: number) => void }> = ({ img, idx, setPreviewIndex, removeImage }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: img.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative flex-shrink-0 group", isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <img 
        src={img.url} 
        onClick={(e) => { e.stopPropagation(); setPreviewIndex(idx); }}
        className="w-16 h-20 object-cover rounded-lg border border-white/20 cursor-pointer hover:border-red-500 transition-colors pointer-events-auto" 
      />
      <div className="absolute top-0 right-0 -mt-2 -mr-2 transition-opacity z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
          className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg pointer-events-auto hover:bg-red-600"
        >
          <X size={14} />
        </button>
      </div>
      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded pointer-events-none">
        {idx + 1}
      </div>
    </div>
  );
}

export const ScanView: React.FC<ScanViewProps> = ({ onComplete, onCancel, requirePremiumOrAd, adBannerHeight = 0 }) => {
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [history, setHistory] = useState<CapturedImage[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const isCameraReadyRef = useRef(false);
  const setCameraReady = (ready: boolean) => {
    isCameraReadyRef.current = ready;
    setIsCameraReady(ready);
  };
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [captureMode, setCaptureMode] = useState<'manual' | 'auto'>('auto');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [autoCaptureTimer, setAutoCaptureTimer] = useState<number | null>(null);
  const [isWaitingForEdges, setIsWaitingForEdges] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishProgress, setFinishProgress] = useState(0);
  const [detectedBounds, setDetectedBounds] = useState<DocumentBounds | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [cropCorners, setCropCorners] = useState<DocumentBounds | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null>(null);

  // Filter & Clarity Editor states
  const [filterTargetIndex, setFilterTargetIndex] = useState<number | null>(null);
  const [filterBaseImage, setFilterBaseImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('clear');
  const [filterBrightness, setFilterBrightness] = useState<number>(0);
  const [filterContrast, setFilterContrast] = useState<number>(0);
  const [filterPreviewUrl, setFilterPreviewUrl] = useState<string | null>(null);
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const [showSliders, setShowSliders] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const filterDebounceRef = useRef<any>(null);

  const mapVideoToScreen = useCallback((point: { x: number; y: number }) => {
    const video = videoRef.current;
    if (!video) return point;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const elementWidth = video.clientWidth;
    const elementHeight = video.clientHeight;
    if (videoWidth === 0 || videoHeight === 0 || elementWidth === 0 || elementHeight === 0) {
      return point;
    }

    const r_video = videoWidth / videoHeight;
    const r_element = elementWidth / elementHeight;

    let x = point.x;
    let y = point.y;

    if (r_video > r_element) {
      const scaledWidth = elementHeight * r_video;
      const offsetX = (elementWidth - scaledWidth) / 2;
      x = (point.x * scaledWidth + offsetX) / elementWidth;
    } else {
      const scaledHeight = elementWidth / r_video;
      const offsetY = (elementHeight - scaledHeight) / 2;
      y = (point.y * scaledHeight + offsetY) / elementHeight;
    }

    return { x, y };
  }, []);

  const mappedBounds = useMemo(() => {
    if (!detectedBounds) return null;
    return {
      topLeft: mapVideoToScreen(detectedBounds.topLeft),
      topRight: mapVideoToScreen(detectedBounds.topRight),
      bottomLeft: mapVideoToScreen(detectedBounds.bottomLeft),
      bottomRight: mapVideoToScreen(detectedBounds.bottomRight),
    };
  }, [detectedBounds, mapVideoToScreen]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stabilityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const cameraSessionIdRef = useRef<number>(0);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const detectedBoundsRef = useRef<DocumentBounds | null>(null);
  const prevDetectedBoundsRef = useRef<DocumentBounds | null>(null);

  const updateImagesWithHistory = (newImages: CapturedImage[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newImages);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
    setCapturedImages(newImages);
  };

  const handleClearAll = () => {
    setCapturedImages([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setPreviewIndex(null);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCapturedImages(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCapturedImages(history[newIndex]);
    }
  };

  useEffect(() => {
    if (window.isSecureContext === false) {
      setCameraError("Camera access requires a secure connection (HTTPS). Please ensure you are not using a plain HTTP link.");
    }
  }, []);

  const startCamera = useCallback(async () => {
    const sessionId = ++cameraSessionIdRef.current;
    
    // Auto transition to sandbox explanation screen if stream initialization stalls
    const streamTimeout = setTimeout(() => {
      if (sessionId === cameraSessionIdRef.current && !isCameraReadyRef.current) {
        console.warn("Live stream initialization stalled. Sandbox boundaries of development editor might be blocking webcam feeds.");
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach(track => track.stop());
          activeStreamRef.current = null;
        }
        setCameraError("permission_denied");
      }
    }, 10000); // Increased to 10s so user has time to click "Allow" on the permission prompt

    try {
      console.log(`Starting camera session #${sessionId} with facingMode:`, facingMode);
      setCameraError(null);
      setCameraReady(false);

      if (Capacitor.isNativePlatform()) {
        const check = await CapacitorCamera.checkPermissions();
        if (check.camera !== 'granted') {
          const request = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
          if (request.camera !== 'granted') {
            throw new Error('Camera permission was denied');
          }
        }
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        clearTimeout(streamTimeout);
        setCameraError("Camera access is not supported by your browser. Please use a modern browser like Chrome or Safari.");
        return;
      }
      
      // Stop existing tracks safely
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const constraints = {
        video: {
          facingMode: facingMode === 'environment' ? { ideal: 'environment' } : 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      let stream: MediaStream;
      try {
        // Attempt 1: Good constraints
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // Check if error is actually a permission issue before falling back
        const isActuallyPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.toString().toLowerCase().includes('denied');
        if (isActuallyPermission) {
          clearTimeout(streamTimeout);
          throw err;
        }

        console.warn("High-res constraints failed, trying simpler constraints", err);
        try {
          // Attempt 2: Any video with requested facing mode
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: facingMode } } 
          });
        } catch (err2) {
          console.warn("Facing mode failed, trying any video", err2);
          // Attempt 3: Any video at all
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      // Check if this session has been superceded or cancelled during async stream request
      if (sessionId !== cameraSessionIdRef.current) {
        clearTimeout(streamTimeout);
        console.log(`Camera session #${sessionId} superceded mid-request. Stopping stream.`);
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      activeStreamRef.current = stream;

      if (videoRef.current) {
        const onReady = () => {
          if (sessionId !== cameraSessionIdRef.current) return;
          console.log("Video ready, dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
          clearTimeout(streamTimeout);
          setCameraReady(true);
          videoRef.current?.play().catch(() => {});
        };

        // Attach event listeners FIRST to guarantee catching events
        videoRef.current.onloadedmetadata = onReady;
        videoRef.current.onloadeddata = onReady;
        videoRef.current.oncanplay = onReady;

        videoRef.current.srcObject = stream;
        
        // Force play immediately to ensure stream is active on mobile webviews
        videoRef.current.play().then(() => {
          console.log("Successfully started video stream playback programmatically.");
          if (videoRef.current && (videoRef.current.readyState >= 2 || videoRef.current.videoWidth > 0)) {
            clearTimeout(streamTimeout);
            setCameraReady(true);
          }
        }).catch(e => {
          console.warn("Explicit play() command was blocked or failed:", e);
        });
        
        // Manual backup validation block to activate camera scan UI
        setTimeout(() => {
          if (sessionId === cameraSessionIdRef.current && videoRef.current) {
            if (videoRef.current.readyState >= 1 || (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0)) {
              clearTimeout(streamTimeout);
              setCameraReady(true);
            } else {
              // Try playing once more in case browser suspended playback on user interaction boundaries
              videoRef.current.play().then(() => {
                clearTimeout(streamTimeout);
                setCameraReady(true);
              }).catch(() => {});
            }
          }
        }, 800);
      }
      setIsCameraActive(true);
    } catch (err: any) {
      clearTimeout(streamTimeout);
      if (sessionId !== cameraSessionIdRef.current) return;
      const errorName = err.name || '';
      const errorMessage = err.message || '';
      
      const isPermissionError = 
        errorName === 'NotAllowedError' || 
        errorName === 'PermissionDeniedError' || 
        errorName === 'SecurityError' ||
        errorMessage.toLowerCase().includes('denied') ||
        errorMessage.toLowerCase().includes('permission') ||
        errorMessage.toLowerCase().includes('allow') ||
        errorMessage.toLowerCase().includes('authorized') ||
        err.toString().toLowerCase().includes('denied') ||
        err.toString().toLowerCase().includes('permission');
      
      if (isPermissionError) {
        console.warn("Camera start blocked by browser or iframe permissions:", err);
        setCameraError("permission_denied");
      } else {
        console.error("Camera start failed:", err);
        if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setCameraError("No camera device found on this system.");
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          setCameraError("Camera is already in use by another application or tab.");
        } else {
          setCameraError(`Unexpected camera error: ${errorName} ${errorMessage}`);
        }
      }
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      // Invalidate current session
      cameraSessionIdRef.current++;
      
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [startCamera]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      const readPromises = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      const rawImagesDatas = (await Promise.all(readPromises)).filter(Boolean) as string[];
      
      // Auto crop if in auto mode, otherwise just use raw images
      const finalImages = captureMode === 'auto' 
        ? await Promise.all(rawImagesDatas.map(autoCropDocument))
        : rawImagesDatas;

      if (finalImages.length > 0) {
        const startIndex = capturedImages.length;
        const imageObjects: CapturedImage[] = finalImages.map(img => ({
          id: Math.random().toString(36).substr(2, 9),
          url: img,
          originalUrl: img,
          filter: 'original',
          brightness: 0,
          contrast: 0
        }));
        setCapturedImages(prev => {
          const nextImages = [...prev, ...imageObjects];
          setHistory(hPrev => {
            const nextHistory = hPrev.slice(0, historyIndex + 1);
            nextHistory.push(nextImages);
            return nextHistory;
          });
          setHistoryIndex(iPrev => iPrev + 1);
          return nextImages;
        });

        if (finalImages.length === 1) {
          openCropEditor(startIndex, imageObjects[0].url);
        }
      }
    } finally {
      setIsProcessing(false);
    }
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const openCropEditor = useCallback((index: number, optionalImageUrl?: string) => {
    setIsProcessing(true);
    const imageUrl = optionalImageUrl || capturedImages[index]?.url;
    if (!imageUrl) {
      setIsProcessing(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const detected = detectCornersFromSource(canvas);
        if (detected) {
          setCropCorners(detected);
        } else {
          setCropCorners({
            topLeft: { x: 0.1, y: 0.1 },
            topRight: { x: 0.9, y: 0.1 },
            bottomLeft: { x: 0.1, y: 0.9 },
            bottomRight: { x: 0.9, y: 0.9 },
            confidence: 0
          });
        }
      }
      setCropTargetIndex(index);
      setIsProcessing(false);
    };
    img.onerror = () => {
      setCropCorners({
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.9, y: 0.1 },
        bottomLeft: { x: 0.1, y: 0.9 },
        bottomRight: { x: 0.9, y: 0.9 },
        confidence: 0
      });
      setCropTargetIndex(index);
      setIsProcessing(false);
    };
    img.src = imageUrl;
  }, [capturedImages]);

  const openFilterEditor = useCallback(async (index: number, optionalBaseUrl?: string) => {
    const item = capturedImages[index];
    const base = optionalBaseUrl || item?.originalUrl || item?.url;
    if (!base) return;

    setFilterTargetIndex(index);
    setFilterBaseImage(base);

    // Default to 'clear' (Clear & Visible) for newly clicked photos, or preserve chosen filter
    const initialFilter: FilterType = item?.filter && item.filter !== 'original' ? item.filter : 'clear';
    const initialB = item?.brightness ?? 0;
    const initialC = item?.contrast ?? 0;

    setActiveFilter(initialFilter);
    setFilterBrightness(initialB);
    setFilterContrast(initialC);
    setIsComparingOriginal(false);
    setShowSliders(false);
    setIsFiltering(true);

    try {
      const filtered = await applyImageFilter(base, {
        filter: initialFilter,
        brightness: initialB,
        contrast: initialC
      });
      setFilterPreviewUrl(filtered);
    } catch (e) {
      console.error("Failed to generate initial filter preview:", e);
      setFilterPreviewUrl(base);
    } finally {
      setIsFiltering(false);
    }
  }, [capturedImages]);

  const handleSelectFilter = useCallback(async (filter: FilterType) => {
    if (!filterBaseImage) return;
    setActiveFilter(filter);
    setIsFiltering(true);
    try {
      const filtered = await applyImageFilter(filterBaseImage, {
        filter,
        brightness: filterBrightness,
        contrast: filterContrast
      });
      setFilterPreviewUrl(filtered);
    } catch (e) {
      console.error("Filter preview failed:", e);
    } finally {
      setIsFiltering(false);
    }
  }, [filterBaseImage, filterBrightness, filterContrast]);

  const handleAdjustmentChange = (bVal: number, cVal: number) => {
    setFilterBrightness(bVal);
    setFilterContrast(cVal);
    if (!filterBaseImage) return;

    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(async () => {
      setIsFiltering(true);
      try {
        const filtered = await applyImageFilter(filterBaseImage, {
          filter: activeFilter,
          brightness: bVal,
          contrast: cVal
        });
        setFilterPreviewUrl(filtered);
      } catch (err) {
        console.error("Adjustment preview failed:", err);
      } finally {
        setIsFiltering(false);
      }
    }, 60);
  };

  const handleSaveFilter = () => {
    if (filterTargetIndex === null || !filterPreviewUrl) return;
    const index = filterTargetIndex;
    const newImages = [...capturedImages];
    if (newImages[index]) {
      newImages[index] = {
        ...newImages[index],
        originalUrl: filterBaseImage || newImages[index].originalUrl,
        url: filterPreviewUrl,
        filter: activeFilter,
        brightness: filterBrightness,
        contrast: filterContrast
      };
      updateImagesWithHistory(newImages);
    }
    setFilterTargetIndex(null);
    setFilterBaseImage(null);
    setFilterPreviewUrl(null);
  };

  const handleCancelFilter = () => {
    setFilterTargetIndex(null);
    setFilterBaseImage(null);
    setFilterPreviewUrl(null);
  };

  const handleSkipCropToFilter = () => {
    if (cropTargetIndex === null) return;
    const index = cropTargetIndex;
    const base = capturedImages[index]?.originalUrl || capturedImages[index]?.url;
    setCropTargetIndex(null);
    setCropCorners(null);
    if (base) {
      openFilterEditor(index, base);
    }
  };

  const handleBackToCropFromFilter = () => {
    const idx = filterTargetIndex;
    const base = filterBaseImage;
    setFilterTargetIndex(null);
    setFilterBaseImage(null);
    setFilterPreviewUrl(null);
    if (idx !== null) {
      openCropEditor(idx, base || undefined);
    }
  };

  const handleQuickFilterInPreview = async (filter: FilterType) => {
    if (previewIndex === null) return;
    const index = previewIndex;
    const item = capturedImages[index];
    if (!item) return;

    setIsProcessing(true);
    try {
      const base = item.originalUrl || item.url;
      const filtered = await applyImageFilter(base, {
        filter,
        brightness: item.brightness ?? 0,
        contrast: item.contrast ?? 0
      });
      const newImages = [...capturedImages];
      newImages[index] = {
        ...newImages[index],
        originalUrl: base,
        url: filtered,
        filter: filter
      };
      updateImagesWithHistory(newImages);
    } catch (e) {
      console.error("Quick filter failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const captureCapacitorImage = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      let captureSuccess = false;
      let finalImage = '';
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          source: CameraSource.Camera, // Skips gallery, opens camera directly
          resultType: CameraResultType.Uri,
          presentationStyle: 'fullscreen'
        });
        
        if (image && image.webPath) {
          setIsProcessing(true);
          finalImage = image.webPath;
          const newImageObj: CapturedImage = { 
            id: Math.random().toString(36).substr(2, 9), 
            url: finalImage,
            originalUrl: finalImage,
            filter: 'original',
            brightness: 0,
            contrast: 0
          };
          
          const nextImages = [...capturedImages, newImageObj];
          setCapturedImages(nextImages);
          
          const nextHistory = [...history.slice(0, historyIndex + 1), nextImages];
          setHistory(nextHistory);
          setHistoryIndex(historyIndex + 1);
          captureSuccess = true;
        }
      } catch (err) {
        console.error("Android Native Camera Error:", err);
      } finally {
        setIsProcessing(false);
      }

      if (captureSuccess && finalImage) {
        openCropEditor(capturedImages.length, finalImage);
      }
      return true;
    }
    return false;
  }, [capturedImages, history, historyIndex, openCropEditor]);

  const chooseCapacitorGalleryImage = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      let captureSuccess = false;
      let finalImage = '';
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          source: CameraSource.Photos, // Open gallery
          resultType: CameraResultType.Uri,
          presentationStyle: 'fullscreen'
        });
        
        if (image && image.webPath) {
          setIsProcessing(true);
          finalImage = image.webPath;
          const newImageObj: CapturedImage = { 
            id: Math.random().toString(36).substr(2, 9), 
            url: finalImage,
            originalUrl: finalImage,
            filter: 'original',
            brightness: 0,
            contrast: 0
          };
          
          const nextImages = [...capturedImages, newImageObj];
          setCapturedImages(nextImages);
          
          const nextHistory = [...history.slice(0, historyIndex + 1), nextImages];
          setHistory(nextHistory);
          setHistoryIndex(historyIndex + 1);
          captureSuccess = true;
        }
      } catch (err) {
        console.error("Android Native Gallery Error:", err);
      } finally {
        setIsProcessing(false);
      }

      if (captureSuccess && finalImage) {
        openCropEditor(capturedImages.length, finalImage);
      }
      return true;
    }
    return false;
  }, [capturedImages, history, historyIndex, openCropEditor]);

  const captureImage = useCallback(async () => {
    // Try Capacitor Native Camera first if running in native wrapper and stream is not active/ready
    if (Capacitor.isNativePlatform() && (!isCameraActive || !isCameraReady)) {
      const handled = await captureCapacitorImage();
      if (handled) return;
    }

    if (isProcessingRef.current) return;
    let captureSuccess = false;
    let finalImage = '';

    if (videoRef.current && canvasRef.current) {
      isProcessingRef.current = true;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Ensure we have actual video dimensions
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (context && width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        
        try {
          const rawImageData = canvas.toDataURL('image/jpeg', 0.85);

          // Visual feedback immediately
          const flash = document.createElement('div');
          flash.className = 'fixed inset-0 bg-white z-[100] animate-flash pointer-events-none';
          document.body.appendChild(flash);
          setTimeout(() => flash.remove(), 300);

          setIsProcessing(true);
          
          finalImage = rawImageData;
          const newImageObj: CapturedImage = { 
            id: Math.random().toString(36).substr(2, 9), 
            url: finalImage,
            originalUrl: finalImage,
            filter: 'original',
            brightness: 0,
            contrast: 0
          };
          
          const nextImages = [...capturedImages, newImageObj];
          setCapturedImages(nextImages);
          
          const nextHistory = [...history.slice(0, historyIndex + 1), nextImages];
          setHistory(nextHistory);
          setHistoryIndex(historyIndex + 1);
          captureSuccess = true;
        } catch (err) {
          console.error("Failed to capture image:", err);
        } finally {
          setIsProcessing(false);
          isProcessingRef.current = false;
          setAutoCaptureTimer(null);
        }
      } else {
        isProcessingRef.current = false;
        console.warn("Attempted to capture image from video with 0 dimensions.");
      }
    }

    if (captureSuccess && finalImage) {
      openCropEditor(capturedImages.length, finalImage);
    }
  }, [capturedImages, history, historyIndex, isCameraActive, isCameraReady, captureCapacitorImage, openCropEditor]);

  // Real-time page corner detection loop
  useEffect(() => {
    if (!isCameraActive || !isCameraReady || previewIndex !== null || cropTargetIndex !== null || captureMode !== 'auto') {
      setDetectedBounds(null);
      detectedBoundsRef.current = null;
      return;
    }

    let active = true;
    const runDetection = () => {
      if (!active) return;
      if (videoRef.current && videoRef.current.readyState >= 2) {
        if (!detectionCanvasRef.current) {
          detectionCanvasRef.current = document.createElement('canvas');
        }
        const bounds = detectCornersFromSource(videoRef.current, detectionCanvasRef.current);
        setDetectedBounds(bounds);
        detectedBoundsRef.current = bounds;
      }
      requestAnimationFrame(runDetection);
    };

    const timeout = setTimeout(() => {
      runDetection();
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [isCameraActive, isCameraReady, previewIndex, cropTargetIndex, captureMode]);

  // Auto-capture logic (only active when page corners are successfully detected and camera is still)
  useEffect(() => {
    let timer: any;
    if (captureMode === 'auto' && isCameraActive && !isProcessing && isCameraReady && previewIndex === null && cropTargetIndex === null && videoRef.current) {
      timer = setInterval(() => {
        if (!stabilityCanvasRef.current) {
          stabilityCanvasRef.current = document.createElement('canvas');
        }
        
        const currentBounds = detectedBoundsRef.current;
        const prevBounds = prevDetectedBoundsRef.current;
        let isDocumentStill = true;

        if (currentBounds && prevBounds) {
          const dist = (p1: Point2D, p2: Point2D) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const tlDiff = dist(currentBounds.topLeft, prevBounds.topLeft);
          const trDiff = dist(currentBounds.topRight, prevBounds.topRight);
          const blDiff = dist(currentBounds.bottomLeft, prevBounds.bottomLeft);
          const brDiff = dist(currentBounds.bottomRight, prevBounds.bottomRight);

          // If any corner shifted by more than 3% of the screen dimension
          if (tlDiff > 0.03 || trDiff > 0.03 || blDiff > 0.03 || brDiff > 0.03) {
            isDocumentStill = false;
          }
        }

        // Update previous bounds ref for next comparison tick
        prevDetectedBoundsRef.current = currentBounds;

        const isStable = checkStabilityForAutoCapture(videoRef.current!, stabilityCanvasRef.current);
        const hasBounds = !!currentBounds;

        if (hasBounds && isStable && isDocumentStill) {
          setAutoCaptureTimer(prev => {
            if (prev === null) return 3; // Hold for 3 seconds
            if (prev <= 1) {
              captureImage();
              prevDetectedBoundsRef.current = null;
              return null;
            }
            return prev - 1;
          });
        } else {
          setAutoCaptureTimer(null);
        }
      }, 1000); // Check stability and countdown every 1 second
    } else {
      setAutoCaptureTimer(null);
    }
    return () => {
      clearInterval(timer);
      setAutoCaptureTimer(null);
    };
  }, [captureMode, isCameraActive, isCameraReady, isProcessing, captureImage, previewIndex, cropTargetIndex]);

  const removeImage = (index: number) => {
    const newImages = capturedImages.filter((_, i) => i !== index);
    updateImagesWithHistory(newImages);
    if (previewIndex === index) setPreviewIndex(null);
  };

  const handleFinish = async () => {
    if (capturedImages.length === 0) return;
    
    const doFinish = async () => {
      setIsFinishing(true);
      setFinishProgress(0);
      
      const simulation = setInterval(() => {
        setFinishProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 10;
        });
      }, 300);

      try {
        const pdfBlob = await imagesToPdf(capturedImages.map(img => img.url));
        clearInterval(simulation);
        setFinishProgress(100);
        
        await new Promise(resolve => setTimeout(resolve, 500));

        const url = URL.createObjectURL(pdfBlob);
        
        const newFile: DocFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Scan_${new Date().getTime()}.pdf`,
          type: 'pdf',
          size: pdfBlob.size,
          createdAt: Date.now(),
          url: url,
        };

        await storageService.saveFile({ ...newFile, data: pdfBlob });
        onComplete(newFile);
      } catch (e) {
        console.error(e);
        alert("Failed to save PDF");
      } finally {
        setIsFinishing(false);
        setFinishProgress(0);
      }
    };

    if (requirePremiumOrAd) {
      requirePremiumOrAd(() => doFinish());
    } else {
      doFinish();
    }
  };

  const handleRotate = async (index: number) => {
    setIsProcessing(true);
    try {
      const item = capturedImages[index];
      if (!item) return;
      const baseToRotate = item.originalUrl || item.url;
      const rotatedBase = await rotateImage(baseToRotate, 90);
      const rotatedUrl = item.filter && item.filter !== 'original'
        ? await applyImageFilter(rotatedBase, {
            filter: item.filter,
            brightness: item.brightness,
            contrast: item.contrast
          })
        : rotatedBase;

      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = { 
          ...newImages[index], 
          originalUrl: rotatedBase,
          url: rotatedUrl 
        };
        // Update history
        setHistory(hPrev => {
          const nextHistory = hPrev.slice(0, historyIndex + 1);
          nextHistory.push(newImages);
          return nextHistory;
        });
        setHistoryIndex(iPrev => iPrev + 1);
        return newImages;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Relocated openCropEditor definition to top of component

  const handleResetCrop = () => {
    setCropCorners({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomLeft: { x: 0, y: 1 },
      bottomRight: { x: 1, y: 1 },
      confidence: 1
    });
  };

  const handleAutoDetectCrop = () => {
    if (cropTargetIndex === null) return;
    setIsProcessing(true);
    const imageUrl = capturedImages[cropTargetIndex].url;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const detected = detectCornersFromSource(canvas);
        if (detected) {
          setCropCorners(detected);
        } else {
          alert("Could not detect document bounds in this image. Try adjusting manually.");
        }
      }
      setIsProcessing(false);
    };
    img.onerror = () => {
      setIsProcessing(false);
    };
    img.src = imageUrl;
  };

  const handleSaveCrop = async () => {
    if (cropTargetIndex === null || !cropCorners) return;
    setIsProcessing(true);
    const index = cropTargetIndex;
    const imageUrl = capturedImages[index]?.originalUrl || capturedImages[index]?.url;

    try {
      const croppedBase64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error("Could not initialize 2D context"));
              return;
            }
            ctx.drawImage(img, 0, 0);
            const warpedCanvas = warpPerspective(canvas, cropCorners);
            resolve(warpedCanvas.toDataURL('image/jpeg', 0.9));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image for cropping"));
        img.src = imageUrl;
      });

      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = { 
          ...newImages[index], 
          originalUrl: croppedBase64,
          url: croppedBase64 
        };
        
        // Update history
        setHistory(hPrev => {
          const nextHistory = hPrev.slice(0, historyIndex + 1);
          nextHistory.push(newImages);
          return nextHistory;
        });
        setHistoryIndex(iPrev => iPrev + 1);
        return newImages;
      });

      setCropTargetIndex(null);
      setCropCorners(null);

      // Immediately open Filter Editor for this newly cropped photo!
      openFilterEditor(index, croppedBase64);
    } catch (err) {
      console.error("Warp perspective failed:", err);
      alert("Failed to crop image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePointerMove = (x: number, y: number, width: number, height: number) => {
    if (!draggingCorner || !cropCorners) return;
    let rx = x / width;
    let ry = y / height;
    rx = Math.max(0, Math.min(1, rx));
    ry = Math.max(0, Math.min(1, ry));
    setCropCorners(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [draggingCorner]: { x: rx, y: ry }
      };
    });
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const items = capturedImages;
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const nextImages = arrayMove(items, oldIndex, newIndex) as CapturedImage[];
      updateImagesWithHistory(nextImages);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden select-none">
      {/* Full-screen Camera Viewfinder / Preview */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        {!cameraError && !isCameraActive && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
            <p className="text-white/60 font-medium">Initializing camera...</p>
          </div>
        )}

        {cameraError ? (
          capturedImages.length > 0 ? (
            <div className="w-full h-full relative bg-black">
              <img 
                src={capturedImages[capturedImages.length - 1].url} 
                alt="Latest capture" 
                className="w-full h-full object-contain" 
              />
              <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none z-20">
                <div className="bg-black/90 text-white px-5 py-2.5 rounded-2xl text-xs backdrop-blur-md border border-white/20 shadow-lg font-medium text-center max-w-[85%] pointer-events-auto leading-relaxed">
                  {cameraError === 'permission_denied' 
                    ? "Camera is blocked in sandbox iframe. Please open the app in a new tab (arrow in top-right) to scan." 
                    : cameraError}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-md text-center p-8 bg-neutral-800 rounded-3xl border border-white/10 shadow-2xl mx-4 z-20">
              <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
                {isMobile ? <Camera size={32} /> : <ImageIcon size={32} />}
              </div>
              <h3 className="text-white font-bold text-lg mb-2">
                {!isMobile ? "Upload Document Image" : "Camera Access Restricted"}
              </h3>
              <p className="text-white/75 text-xs mb-6 sm:text-sm leading-relaxed px-4">
                {!isMobile 
                  ? "Live webcam streaming is restricted inside sandboxed development previews of the editor. Since desktop browsers do not have native camera apps, you can select or drag-and-drop document files from your computer to run the high-fidelity scan processing."
                  : "Live webcam streaming is blocked inside sandboxed development previews of the editor. You can open the app in a new tab using the top-right button, or capture a fast photo immediately using your phone's native camera below!"}
              </p>
              
              <div className="space-y-3.5">
                {Capacitor.isNativePlatform() ? (
                  <>
                    <button 
                      onClick={captureCapacitorImage}
                      className="w-full bg-emerald-600 text-white py-3.5 rounded-full font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera size={18} />
                      <span>Launch Phone Camera</span>
                    </button>

                    <button 
                      onClick={chooseCapacitorGalleryImage}
                      className="w-full bg-blue-600 text-white py-3.5 rounded-full font-bold hover:bg-blue-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ImageIcon size={18} />
                      <span>Choose from Photo Gallery</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Native input for files or mobile camera */}
                    <div className="relative overflow-hidden w-full bg-emerald-600 text-white py-3.5 rounded-full font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                      {isMobile ? <Camera size={18} /> : <ImageIcon size={18} />}
                      <span>{isMobile ? "Launch Phone Camera" : "Select Document Image File(s)"}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture={isMobile ? "environment" : undefined}
                        multiple={!isMobile}
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>

                    {isMobile && (
                      <div className="relative overflow-hidden w-full bg-blue-600 text-white py-3.5 rounded-full font-bold hover:bg-blue-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                        <ImageIcon size={18} />
                        <span>Choose from Photo Gallery</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Open in a new tab trigger to bypass iframe sandbox restrictions */}
                <a 
                  href={window.location.origin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-neutral-700 text-white py-3.5 rounded-full font-bold hover:bg-neutral-600 transition-all text-xs flex items-center justify-center gap-2 shadow-md outline-none border border-neutral-600"
                >
                  <RotateCw size={14} />
                  <span>Open App in New Tab for Live Webcam Stream</span>
                </a>
              </div>
            </div>
          )
        ) : (
          <div className={cn("absolute inset-0 w-full h-full", !isCameraActive && "hidden")}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
                isCameraReady ? "opacity-100" : "opacity-0"
              )}
            />
            
            {!isCameraReady && (
              capturedImages.length > 0 ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
                  <img 
                    src={capturedImages[capturedImages.length - 1].url} 
                    alt="Latest capture" 
                    className="w-full h-full object-contain" 
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-900/90 backdrop-blur-sm p-6 text-center z-20">
                   <Loader2 size={32} className="text-blue-500 animate-spin" />
                   <p className="text-white/85 text-xs font-bold uppercase tracking-widest">Warming up camera...</p>
                   <p className="text-white/50 text-xs mt-1 max-w-[270px] leading-relaxed">
                     {!isMobile 
                       ? "Browsers may block the live webcam stream inside development preview sandboxes. You can select document files from your computer to start instantly instead!"
                       : "Browsers may block the live webcam stream inside development preview sandboxes. You can tap below to snap cards using your phone's camera immediately!"}
                   </p>
                   
                   <div className="flex flex-col gap-2.5 mt-3 w-full max-w-[280px]">
                     {Capacitor.isNativePlatform() ? (
                       <>
                         <button 
                           onClick={captureCapacitorImage}
                           className="bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-emerald-500 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                         >
                           <Camera size={14} />
                           <span>Launch Phone Camera</span>
                         </button>

                         <button 
                           onClick={chooseCapacitorGalleryImage}
                           className="bg-neutral-700 text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-neutral-600 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                         >
                           <ImageIcon size={14} />
                           <span>Choose from Gallery</span>
                         </button>
                       </>
                     ) : (
                       <>
                         <div className="relative overflow-hidden bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-emerald-500 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
                           {isMobile ? <Camera size={14} /> : <ImageIcon size={14} />}
                           <span>{isMobile ? "Launch Phone Camera" : "Select Document Image"}</span>
                           <input 
                             type="file" 
                             accept="image/*" 
                             capture={isMobile ? "environment" : undefined}
                             multiple={!isMobile}
                             onChange={handleFileUpload}
                             className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                           />
                         </div>
                         
                         {isMobile && (
                           <div className="relative overflow-hidden bg-neutral-700 text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-neutral-600 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
                             <ImageIcon size={14} />
                             <span>Choose from Gallery</span>
                             <input 
                               type="file" 
                               accept="image/*" 
                               multiple
                               onChange={handleFileUpload}
                               className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                             />
                           </div>
                         )}
                       </>
                     )}
                   </div>
                </div>
              )
            )}

            {isCameraReady && mappedBounds && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon 
                  points={`${mappedBounds.topLeft.x * 100},${mappedBounds.topLeft.y * 100} ${mappedBounds.topRight.x * 100},${mappedBounds.topRight.y * 100} ${mappedBounds.bottomRight.x * 100},${mappedBounds.bottomRight.y * 100} ${mappedBounds.bottomLeft.x * 100},${mappedBounds.bottomLeft.y * 100}`}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke={autoCaptureTimer !== null ? "#10b981" : "#3b82f6"}
                  strokeWidth="1.5"
                  className="transition-colors duration-300"
                />
                <circle cx={`${mappedBounds.topLeft.x * 100}`} cy={`${mappedBounds.topLeft.y * 100}`} r="1.5" fill={autoCaptureTimer !== null ? "#10b981" : "#3b82f6"} stroke="white" strokeWidth="0.5" />
                <circle cx={`${mappedBounds.topRight.x * 100}`} cy={`${mappedBounds.topRight.y * 100}`} r="1.5" fill={autoCaptureTimer !== null ? "#10b981" : "#3b82f6"} stroke="white" strokeWidth="0.5" />
                <circle cx={`${mappedBounds.bottomRight.x * 100}`} cy={`${mappedBounds.bottomRight.y * 100}`} r="1.5" fill={autoCaptureTimer !== null ? "#10b981" : "#3b82f6"} stroke="white" strokeWidth="0.5" />
                <circle cx={`${mappedBounds.bottomLeft.x * 100}`} cy={`${mappedBounds.bottomLeft.y * 100}`} r="1.5" fill={autoCaptureTimer !== null ? "#10b981" : "#3b82f6"} stroke="white" strokeWidth="0.5" />
              </svg>
            )}

          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Auto Capture Indicator */}
        {captureMode === 'auto' && autoCaptureTimer !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-48 h-48 border-2 border-dashed border-red-500/50 rounded-xl flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-[2px]">
              <span className="text-4xl font-bold text-white mb-2">{autoCaptureTimer}</span>
              <span className="text-[10px] text-white/80 uppercase tracking-widest font-bold">Hold Still</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Header Overlay: Kept ONLY cross symbol (for take back) and pages scan text */}
      <div className="absolute top-0 inset-x-0 z-30 pt-4 pb-8 px-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex justify-between items-center text-white pointer-events-none">
        <button 
          onClick={onCancel} 
          className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors pointer-events-auto border border-white/10 active:scale-95 shadow-md"
          title="Close camera"
        >
          <X size={24} />
        </button>
        <span className="font-semibold text-white text-base tracking-wide drop-shadow-md pointer-events-auto">
          {capturedImages.length} Pages Scanned
        </span>
        <div className="w-11" />
      </div>

      {/* Floating Thumbnail Strip (ONLY shown when pages are captured - no empty strip, no 'No pages captured yet') */}
      <AnimatePresence>
        {capturedImages.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 inset-x-0 z-20 px-4 flex items-center gap-3 overflow-x-auto no-scrollbar pointer-events-auto py-2"
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={capturedImages.map(img => img.id)} strategy={horizontalListSortingStrategy}>
                {capturedImages.map((img, idx) => (
                  <SortableImageItem 
                    key={img.id} 
                    img={img} 
                    idx={idx} 
                    setPreviewIndex={setPreviewIndex} 
                    removeImage={removeImage} 
                  />
                ))}
              </SortableContext>
            </DndContext>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Image Preview Modal */}
      <AnimatePresence>
        {previewIndex !== null && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[70] bg-black flex flex-col"
          >
            <div className="p-4 flex justify-between items-center text-white bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={() => setPreviewIndex(null)} className="p-2 bg-white/10 rounded-full">
                <X size={24} />
              </button>
              <span className="font-bold">Page {previewIndex + 1} of {capturedImages.length}</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const idx = previewIndex!;
                    setPreviewIndex(null);
                    openFilterEditor(idx);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-full transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer text-white"
                  title="Filter: Clear & Visible"
                >
                  <Sparkles size={16} className="text-amber-300" />
                  <span className="text-xs font-bold">Filter</span>
                </button>
                <button 
                  onClick={() => openCropEditor(previewIndex!)}
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-full transition-colors"
                  title="Crop Image"
                >
                  <Crop size={20} />
                </button>
                <button 
                  onClick={() => handleRotate(previewIndex!)}
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-full transition-colors"
                  title="Rotate 90°"
                >
                  <RotateCw size={20} />
                </button>
                <button 
                  onClick={() => removeImage(previewIndex!)}
                  className="p-2 bg-red-500 rounded-full"
                  title="Delete Page"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
              <img 
                src={capturedImages[previewIndex].url} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Quick Filter Bar in Preview Modal */}
            <div className="px-4 py-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar bg-black/40 backdrop-blur-sm border-t border-white/10">
              {FILTER_OPTIONS.map((f) => {
                const Icon = f.icon;
                const isSelected = capturedImages[previewIndex]?.filter === f.id || (!capturedImages[previewIndex]?.filter && f.id === 'original');
                return (
                  <button
                    key={f.id}
                    onClick={() => handleQuickFilterInPreview(f.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer active:scale-95",
                      isSelected 
                        ? "bg-blue-600 text-white border-blue-400 shadow-md ring-1 ring-blue-400/40" 
                        : "bg-neutral-800/80 text-white/70 hover:text-white border-white/10 hover:border-white/20"
                    )}
                  >
                    <Icon size={14} className={isSelected ? "text-white" : "text-white/60"} />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>

            <div 
              className="pt-4 px-8 flex justify-center gap-4 transition-all duration-300 ease-out"
              style={{ 
                paddingBottom: adBannerHeight > 0 ? `${adBannerHeight + 24}px` : '1.5rem' 
              }}
            >
              <button 
                onClick={() => {
                  setPreviewIndex(null);
                }}
                className="px-8 py-3 bg-white text-black rounded-full font-bold active:scale-95 transition-transform"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop Editor Modal */}
      <AnimatePresence>
        {cropTargetIndex !== null && cropCorners && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black flex flex-col"
          >
            {/* Header */}
            <div className="p-4 flex justify-between items-center text-white bg-gradient-to-b from-black/60 to-transparent">
              <button 
                onClick={handleSkipCropToFilter} 
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                title="Skip crop & continue to filter"
              >
                <X size={24} />
              </button>
              <span className="font-bold">Adjust boundaries</span>
              <button 
                onClick={handleSaveCrop}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold text-sm flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer text-white"
                title="Next: Choose Filter"
              >
                <Sparkles size={16} className="text-amber-300" />
                <span>Next: Filter</span>
              </button>
            </div>

            {/* Crop Canvas/Viewport */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden select-none">
              <div className="relative max-w-full max-h-[70vh] select-none">
                <img 
                  ref={cropImageRef}
                  src={capturedImages[cropTargetIndex].originalUrl || capturedImages[cropTargetIndex].url} 
                  alt="Crop Target"
                  className="max-w-full max-h-[70vh] block h-auto w-auto rounded-lg shadow-2xl pointer-events-none select-none"
                />
                
                {/* SVG Overlay */}
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-auto select-none touch-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handlePointerMove(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
                  }}
                  onTouchMove={(e) => {
                    if (e.touches.length > 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      handlePointerMove(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top, rect.width, rect.height);
                    }
                  }}
                  onMouseUp={() => setDraggingCorner(null)}
                  onMouseLeave={() => setDraggingCorner(null)}
                  onTouchEnd={() => setDraggingCorner(null)}
                >
                  {/* Outer dim background overlay except the cropped region */}
                  <path 
                    d={`M 0,0 L 100,0 L 100,100 L 0,100 Z M ${cropCorners.topLeft.x * 100},${cropCorners.topLeft.y * 100} L ${cropCorners.bottomLeft.x * 100},${cropCorners.bottomLeft.y * 100} L ${cropCorners.bottomRight.x * 100},${cropCorners.bottomRight.y * 100} L ${cropCorners.topRight.x * 100},${cropCorners.topRight.y * 100} Z`} 
                    fill="rgba(0, 0, 0, 0.65)" 
                    fillRule="evenodd" 
                  />

                  {/* Lines connecting the handles */}
                  <line x1={`${cropCorners.topLeft.x * 100}`} y1={`${cropCorners.topLeft.y * 100}`} x2={`${cropCorners.topRight.x * 100}`} y2={`${cropCorners.topRight.y * 100}`} stroke="#3b82f6" strokeWidth="1.5" />
                  <line x1={`${cropCorners.topRight.x * 100}`} y1={`${cropCorners.topRight.y * 100}`} x2={`${cropCorners.bottomRight.x * 100}`} y2={`${cropCorners.bottomRight.y * 100}`} stroke="#3b82f6" strokeWidth="1.5" />
                  <line x1={`${cropCorners.bottomRight.x * 100}`} y1={`${cropCorners.bottomRight.y * 100}`} x2={`${cropCorners.bottomLeft.x * 100}`} y2={`${cropCorners.bottomLeft.y * 100}`} stroke="#3b82f6" strokeWidth="1.5" />
                  <line x1={`${cropCorners.bottomLeft.x * 100}`} y1={`${cropCorners.bottomLeft.y * 100}`} x2={`${cropCorners.topLeft.x * 100}`} y2={`${cropCorners.topLeft.y * 100}`} stroke="#3b82f6" strokeWidth="1.5" />

                  {/* Draggable corner handles */}
                  {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const).map((corner) => {
                    const pt = cropCorners[corner];
                    const isDragging = draggingCorner === corner;
                    return (
                      <g 
                        key={corner}
                        className="cursor-pointer select-none"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingCorner(corner);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingCorner(corner);
                        }}
                      >
                        {/* Enlarged touch target */}
                        <circle cx={`${pt.x * 100}`} cy={`${pt.y * 100}`} r="10" fill="transparent" />
                        {/* Visual handle */}
                        <circle 
                          cx={`${pt.x * 100}`} 
                          cy={`${pt.y * 100}`} 
                          r={isDragging ? "4" : "3"} 
                          fill="#3b82f6" 
                          stroke="white" 
                          strokeWidth="1.5"
                          className="transition-all duration-100"
                        />
                        <circle cx={`${pt.x * 100}`} cy={`${pt.y * 100}`} r="0.8" fill="white" />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Toolbar Footer */}
            <div 
              className="pt-6 px-6 bg-neutral-950 border-t border-white/10 flex justify-around items-center transition-all duration-300 ease-out"
              style={{ 
                paddingBottom: adBannerHeight > 0 ? `${adBannerHeight + 24}px` : '1.5rem' 
              }}
            >
              <button 
                onClick={handleResetCrop}
                className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Reset to Full
              </button>
              <button 
                onClick={handleAutoDetectCrop}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Auto Detect
              </button>
              <button 
                onClick={handleSkipCropToFilter}
                className="px-5 py-2.5 bg-neutral-800/80 hover:bg-neutral-700 text-white/80 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Skip Crop
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter & Clarity Editor Modal */}
      <AnimatePresence>
        {filterTargetIndex !== null && filterBaseImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] bg-black flex flex-col"
          >
            {/* Header */}
            <div className="p-4 flex justify-between items-center text-white bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <button 
                onClick={handleCancelFilter} 
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95"
                title="Cancel filter"
              >
                <X size={24} />
              </button>
              <div className="flex flex-col items-center">
                <span className="font-bold text-base flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-400" />
                  <span>Document Filter</span>
                </span>
                <span className="text-[11px] text-white/60">
                  Page {filterTargetIndex + 1} of {capturedImages.length}
                </span>
              </div>
              <button 
                onClick={handleSaveFilter}
                disabled={isFiltering}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold text-sm flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 text-white"
                title="Apply & Save Page"
              >
                <Check size={18} />
                <span>Done</span>
              </button>
            </div>

            {/* Viewport with Live Preview & Hold-to-Compare */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-4 overflow-hidden select-none">
              <div className="relative max-w-full max-h-[62vh] flex items-center justify-center">
                <img 
                  src={isComparingOriginal ? filterBaseImage : (filterPreviewUrl || filterBaseImage)} 
                  alt="Enhanced Document Preview"
                  className="max-w-full max-h-[62vh] block h-auto w-auto rounded-xl shadow-2xl object-contain border border-white/10"
                />

                {/* Filter Loading Indicator */}
                {isFiltering && (
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                    <Loader2 size={36} className="text-white animate-spin" />
                  </div>
                )}

                {/* Hold to Compare Floating Button */}
                <button
                  onMouseDown={() => setIsComparingOriginal(true)}
                  onMouseUp={() => setIsComparingOriginal(false)}
                  onTouchStart={() => setIsComparingOriginal(true)}
                  onTouchEnd={() => setIsComparingOriginal(false)}
                  className={cn(
                    "absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95",
                    isComparingOriginal 
                      ? "bg-amber-500 text-black font-bold ring-2 ring-amber-300" 
                      : "bg-black/70 hover:bg-black/90 text-white/90 border border-white/20"
                  )}
                  title="Press and hold to view original photo"
                >
                  <Eye size={14} />
                  <span>{isComparingOriginal ? "Viewing Original (Raw)" : "Hold to Compare"}</span>
                </button>
              </div>

              {/* Filter Active Badge */}
              <div className="mt-2 text-center">
                <span className="text-xs font-medium text-white/70 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                  {FILTER_OPTIONS.find(f => f.id === activeFilter)?.description || ''}
                </span>
              </div>
            </div>

            {/* Bottom Controls / Filter Presets & Sliders */}
            <div 
              className="bg-neutral-950 border-t border-white/10 flex flex-col transition-all duration-300 ease-out z-10"
              style={{ 
                paddingBottom: adBannerHeight > 0 ? `${adBannerHeight + 16}px` : '1rem' 
              }}
            >
              {/* Optional Fine-Tune Sliders */}
              <AnimatePresence>
                {showSliders && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-white/10 bg-neutral-900/60 px-5 py-3 space-y-3"
                  >
                    <div className="flex justify-between items-center text-xs font-semibold text-white/80">
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal size={14} />
                        <span>Fine-Tune Clarity</span>
                      </span>
                      {(filterBrightness !== 0 || filterContrast !== 0) && (
                        <button 
                          onClick={() => handleAdjustmentChange(0, 0)}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                        >
                          <RotateCcw size={12} />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>

                    {/* Brightness Slider */}
                    <div className="flex items-center gap-3">
                      <Sun size={16} className="text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-white/70 w-16">Bright</span>
                      <input 
                        type="range" 
                        min="-50" 
                        max="50" 
                        value={filterBrightness}
                        onChange={(e) => handleAdjustmentChange(Number(e.target.value), filterContrast)}
                        className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
                      />
                      <span className="text-[11px] text-white/60 font-mono w-8 text-right">
                        {filterBrightness > 0 ? `+${filterBrightness}` : filterBrightness}
                      </span>
                    </div>

                    {/* Contrast Slider */}
                    <div className="flex items-center gap-3">
                      <Contrast size={16} className="text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-white/70 w-16">Contrast</span>
                      <input 
                        type="range" 
                        min="-50" 
                        max="50" 
                        value={filterContrast}
                        onChange={(e) => handleAdjustmentChange(filterBrightness, Number(e.target.value))}
                        className="flex-1 accent-blue-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
                      />
                      <span className="text-[11px] text-white/60 font-mono w-8 text-right">
                        {filterContrast > 0 ? `+${filterContrast}` : filterContrast}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Filter Selection Pills */}
              <div className="pt-3 px-4 pb-2 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
                {FILTER_OPTIONS.map((f) => {
                  const Icon = f.icon;
                  const isSelected = activeFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFilter(f.id)}
                      className={cn(
                        "flex flex-col items-center justify-center flex-shrink-0 px-3.5 py-2 rounded-2xl transition-all cursor-pointer min-w-[76px] border active:scale-95",
                        isSelected 
                          ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/25 ring-2 ring-blue-400/40" 
                          : "bg-neutral-800/80 hover:bg-neutral-800 text-white/80 border-white/10 hover:border-white/20"
                      )}
                    >
                      <Icon size={20} className={cn("mb-1", isSelected ? "text-white" : "text-white/70")} />
                      <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">{f.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Footer Actions: Fine-Tune toggle + Crop Re-adjust */}
              <div className="px-4 py-2 flex justify-between items-center text-xs border-t border-white/5">
                <button 
                  onClick={() => setShowSliders(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors cursor-pointer",
                    showSliders 
                      ? "bg-white/20 border-white/30 text-white font-semibold" 
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                  )}
                >
                  <SlidersHorizontal size={14} />
                  <span>{showSliders ? "Hide Fine-Tune" : "Fine-Tune Sliders"}</span>
                </button>

                <button 
                  onClick={handleBackToCropFromFilter}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <Crop size={14} />
                  <span>Adjust Crop</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finishing Loader Overlay */}
      <AnimatePresence>
        {isFinishing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-white mb-8 shadow-2xl shadow-blue-500/20">
                <Loader2 size={40} className="animate-spin" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Creating your PDF</h2>
              <p className="text-white/60 mb-8 font-medium">Please wait while we process {capturedImages.length} pages...</p>
              
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mb-4 border border-white/5">
                <motion.div 
                  className="h-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${finishProgress}%` }}
                />
              </div>
              <span className="text-blue-400 font-black text-lg">{Math.round(finishProgress)}%</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="absolute bottom-0 inset-x-0 z-30 pt-8 px-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex justify-around items-center transition-all duration-300 ease-out pointer-events-auto"
        style={{ 
          paddingBottom: adBannerHeight > 0 ? `${adBannerHeight + 24}px` : '1.75rem' 
        }}
      >
        <button 
          onClick={handleClearAll}
          disabled={capturedImages.length === 0}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
            capturedImages.length > 0 ? "text-white hover:bg-white/10 active:scale-95" : "opacity-0 pointer-events-none"
          )}
          title="Clear all pages"
        >
          <Trash2 size={24} />
        </button>

        <div className="flex gap-4 items-center">
          {capturedImages.length > 0 ? (
            <button 
              onClick={() => setPreviewIndex(capturedImages.length - 1)}
              className="relative overflow-hidden w-12 h-12 rounded-lg border-2 border-white/40 hover:border-white transition-all shadow-lg shadow-black/50"
            >
              <img 
                src={capturedImages[capturedImages.length - 1].url} 
                alt="Latest Capture" 
                className="w-full h-full object-cover" 
              />
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {capturedImages.length}
              </div>
            </button>
          ) : (
            <div className="relative overflow-hidden w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/20">
              <ImageIcon size={24} />
              <input 
                type="file" 
                accept="image/*" 
                multiple
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Upload Image"
              />
            </div>
          )}

          {cameraError ? (
            Capacitor.isNativePlatform() ? (
              <button 
                onClick={captureCapacitorImage}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-blue-500/20 active:scale-95 transition-transform"
                title="Take Photo"
              >
                <div className="w-16 h-16 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                  <Camera size={32} className="text-white" />
                </div>
              </button>
            ) : (
              <div className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-blue-500/20 active:scale-95 transition-transform overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                  <Camera size={32} className="text-white" />
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture={isMobile ? "environment" : undefined}
                  multiple={!isMobile}
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  title="Take Photo"
                />
              </div>
            )
          ) : !isCameraReady ? (
            Capacitor.isNativePlatform() ? (
              <button 
                onClick={captureCapacitorImage}
                className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/5 animate-pulse cursor-pointer"
                title="Take Photo using Native Camera"
              >
                 <Loader2 size={32} className="text-white/40 animate-spin" />
              </button>
            ) : (
              <div className="relative w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/5 animate-pulse overflow-hidden cursor-pointer">
                 <Loader2 size={32} className="text-white/40 animate-spin" />
                 {isMobile && (
                   <input 
                     type="file" 
                     accept="image/*" 
                     capture="environment" 
                     onChange={handleFileUpload}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                     title="Take Photo"
                   />
                 )}
              </div>
            )
          ) : (
            <button 
              onClick={captureImage}
              disabled={isProcessing}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 active:scale-95 transition-transform disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-white shadow-lg" />
            </button>
          )}
          
          <button 
            onClick={() => {
              if (isCameraActive) {
                setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
              } else {
                startCamera();
              }
            }}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/20"
            title={isCameraActive ? "Switch Camera" : "Restart Camera"}
          >
            <RefreshCw size={24} className={cn(!isCameraActive && "animate-pulse")} />
          </button>
        </div>

        <button 
          onClick={handleFinish}
          disabled={capturedImages.length === 0}
          className={cn(
            "w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95",
            capturedImages.length > 0 ? "bg-red-500 text-white hover:bg-red-600" : "opacity-0 pointer-events-none"
          )}
        >
          <Check size={24} />
          <span className="text-[8px] font-bold uppercase mt-0.5">Save PDF</span>
        </button>
      </div>
    </div>
  );
};
