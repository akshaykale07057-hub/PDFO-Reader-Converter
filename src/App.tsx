import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Files,
  Clock,
  Camera,
  Search,
  Folder,
  Settings,
  Plus,
  ArrowUpRight,
  Minimize2,
  X,
  Merge,
  Scissors,
  Crown,
  Globe,
  Share2,
  Star,
  MessageSquare,
  Shield,
  ChevronRight,
  Check,
  Smartphone,
  Wallet,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronUp,
  FilePlus,
  FolderOpen,
  ShieldCheck,
  Bell,
  ArrowDown,
  Download,
  QrCode,
  Database,
  Copy,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { App as CapApp } from '@capacitor/app';
import { DocFile, TabType } from './types';
import { storageService } from './services/storageService';
import { adService } from './services/adService';
import { ScanView } from './components/ScanView';
import { CompressorView } from './components/CompressorView';
import { MergeView } from './components/MergeView';
import { SplitView } from './components/SplitView';
import { QRScannerView } from './components/QRScannerView';
import { FileList } from './components/FileList';
import { ToolsView } from './components/ToolsView';
import { scanDeviceForDocuments } from './folderscan/FileScanner';
import { GenericToolFeature } from './components/GenericToolFeature';
import { AdPlayerModal } from './components/AdPlayerModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { directShareFile, directShareMultipleFiles } from './utils/shareUtils';
import { cn } from './utils/cn';
import { formatFileSize } from './utils/fileUtils';
import { getTranslator, LANGUAGE_DISPLAY_NAMES } from './utils/translator';

// No initial files to ensure real experience
const INITIAL_FILES: DocFile[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [files, setFiles] = useState<DocFile[]>([]);
  const [recentFiles, setRecentFiles] = useState<DocFile[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [selectedFile, setSelectedFile] = useState<DocFile | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocFile | null>(null);
  const [showCompressor, setShowCompressor] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    adService.setPro(isPro);
  }, [isPro]);

  const [adBannerHeight, setAdBannerHeight] = useState(0);

  useEffect(() => {
    const handleAdHeightChange = (e: Event) => {
      const height = (e as CustomEvent).detail;
      setAdBannerHeight(height);
    };
    window.addEventListener('admob-banner-height-changed', handleAdHeightChange);
    return () => {
      window.removeEventListener('admob-banner-height-changed', handleAdHeightChange);
    };
  }, []);

  useEffect(() => {
    const handleShowSimulatedAd = (e: Event) => {
      const customEvent = e as CustomEvent<{ onComplete: () => void }>;
      if (customEvent.detail && typeof customEvent.detail.onComplete === 'function') {
        setAdCallback({ run: customEvent.detail.onComplete });
      }
    };
    window.addEventListener('show-simulated-ad', handleShowSimulatedAd);
    return () => {
      window.removeEventListener('show-simulated-ad', handleShowSimulatedAd);
    };
  }, []);

  const [isPromoExpanded, setIsPromoExpanded] = useState(false);
  const [activeToolAction, setActiveToolAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activeSettingsModal, setActiveSettingsModal] = useState<'pro' | 'language' | 'feedback' | 'rate' | 'privacy' | 'payment' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [adCallback, setAdCallback] = useState<{ run: () => void } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('selected_language') || 'English US');
  const [isUpiExpanded, setIsUpiExpanded] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingCard, setIsProcessingCard] = useState(false);

  const handleCardPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvv) {
      alert("Please fill in all card details.");
      return;
    }
    setIsProcessingCard(true);
    setTimeout(() => {
      setIsProcessingCard(false);
      setIsPro(true);
      alert('Card Payment Successful!');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setIsCardExpanded(false);
      setActiveSettingsModal(null);
      setShowSettings(false);
    }, 2000);
  };

  const [upiId, setUpiId] = useState('');
  const [isProcessingUpiId, setIsProcessingUpiId] = useState(false);

  const handleUpiIdPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiId || !upiId.includes('@')) {
      alert("Please enter a valid UPI ID (e.g., username@bank).");
      return;
    }
    setIsProcessingUpiId(true);
    setTimeout(() => {
      setIsProcessingUpiId(false);
      setIsPro(true);
      alert('UPI ID Payment Successful!');
      setUpiId('');
      setIsUpiExpanded(false);
      setActiveSettingsModal(null);
      setShowSettings(false);
    }, 2000);
  };

  const mainRef = useRef<HTMLDivElement>(null);
  const isScanningRef = useRef(false);
  const handleAutoScanRef = useRef<() => void>(() => {});

  useEffect(() => {
    handleAutoScanRef.current = handleAutoScan;
  });

  // Tab history navigation tracking
  const tabHistoryRef = useRef<TabType[]>(['home']);
  const isNavigatingTabBackRef = useRef(false);

  useEffect(() => {
    if (isNavigatingTabBackRef.current) {
      isNavigatingTabBackRef.current = false;
      return;
    }
    const history = tabHistoryRef.current;
    if (history[history.length - 1] !== activeTab) {
      if (history.length >= 20) {
        history.shift();
      }
      history.push(activeTab);
    }
  }, [activeTab]);

  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab) {
      if (mainRef.current) {
        mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      setActiveTab(tab);
    }
  };

  // Back button handler
  const handleGoBack = () => {
    if (activeSettingsModal) {
      setActiveSettingsModal(null);
      return;
    }
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    if (viewingDoc) {
      setViewingDoc(null);
      return;
    }
    if (showCompressor) {
      setShowCompressor(false);
      return;
    }
    if (showMerge) {
      setShowMerge(false);
      return;
    }
    if (showSplit) {
      setShowSplit(false);
      return;
    }
    if (showQRScanner) {
      setShowQRScanner(false);
      return;
    }
    if (activeToolAction) {
      setActiveToolAction(null);
      return;
    }
    if (selectedFile) {
      setSelectedFile(null);
      return;
    }

    const history = tabHistoryRef.current;
    if (history.length > 1) {
      history.pop();
      const prevTab = history[history.length - 1];
      isNavigatingTabBackRef.current = true;
      setActiveTab(prevTab);
    } else {
      if (activeTab !== 'home') {
        isNavigatingTabBackRef.current = true;
        setActiveTab('home');
      } else {
        CapApp.exitApp();
      }
    }
  };

  const handleGoBackRef = useRef(handleGoBack);
  useEffect(() => {
    handleGoBackRef.current = handleGoBack;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapApp.addListener('backButton', () => {
      handleGoBackRef.current();
    });

    return () => {
      backButtonListener.then(h => h.remove());
    };
  }, []);

  const [feedbackWebhook, setFeedbackWebhook] = useState(() => {
    return localStorage.getItem('VITE_FEEDBACK_WEBHOOK_URL') || ((import.meta as any).env?.VITE_FEEDBACK_WEBHOOK_URL as string) || '';
  });
  const [ratingWebhook, setRatingWebhook] = useState(() => {
    return localStorage.getItem('VITE_RATING_WEBHOOK_URL') || ((import.meta as any).env?.VITE_RATING_WEBHOOK_URL as string) || '';
  });
  interface LocalFeedback {
    id: string;
    text: string;
    timestamp: string;
    language: string;
    synced: boolean;
  }

  interface LocalRating {
    id: string;
    rating: number;
    timestamp: string;
    language: string;
    synced: boolean;
  }

  const [localFeedbacks, setLocalFeedbacks] = useState<LocalFeedback[]>(() => {
    try {
      const stored = localStorage.getItem('local_feedbacks');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [localRatings, setLocalRatings] = useState<LocalRating[]>(() => {
    try {
      const stored = localStorage.getItem('local_ratings');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showFeedbackWebhookSetup, setShowFeedbackWebhookSetup] = useState(false);
  const [showRatingWebhookSetup, setShowRatingWebhookSetup] = useState(false);
  const [copiedFeedbackSetup, setCopiedFeedbackSetup] = useState(false);
  const [copiedRatingSetup, setCopiedRatingSetup] = useState(false);

  const syncPendingItems = async (type: 'feedback' | 'rating' | 'all') => {
    // Sync feedback
    if (type === 'feedback' || type === 'all') {
      const webhookUrl = feedbackWebhook.trim();
      if (webhookUrl) {
        let currentFeedbacks: LocalFeedback[] = [];
        try {
          const stored = localStorage.getItem('local_feedbacks');
          currentFeedbacks = stored ? JSON.parse(stored) : [];
        } catch { }

        const unsyncedFeedbacks = currentFeedbacks.filter(f => !f.synced);
        if (unsyncedFeedbacks.length > 0) {
          let updated = [...currentFeedbacks];
          for (const item of unsyncedFeedbacks) {
            try {
              const payload = {
                type: 'feedback',
                text: item.text,
                timestamp: item.timestamp,
                language: item.language
              };
              await fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              updated = updated.map(f => f.id === item.id ? { ...f, synced: true } : f);
            } catch (err) {
              console.error("Failed to sync feedback item:", item.id, err);
            }
          }
          setLocalFeedbacks(updated);
          localStorage.setItem('local_feedbacks', JSON.stringify(updated));
        }
      }
    }

    // Sync ratings
    if (type === 'rating' || type === 'all') {
      const webhookUrl = ratingWebhook.trim();
      if (webhookUrl) {
        let currentRatings: LocalRating[] = [];
        try {
          const stored = localStorage.getItem('local_ratings');
          currentRatings = stored ? JSON.parse(stored) : [];
        } catch { }

        const unsyncedRatings = currentRatings.filter(r => !r.synced);
        if (unsyncedRatings.length > 0) {
          let updated = [...currentRatings];
          for (const item of unsyncedRatings) {
            try {
              const payload = {
                type: 'rating',
                rating: item.rating,
                timestamp: item.timestamp,
                language: item.language
              };
              await fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              updated = updated.map(r => r.id === item.id ? { ...r, synced: true } : r);
            } catch (err) {
              console.error("Failed to sync rating item:", item.id, err);
            }
          }
          setLocalRatings(updated);
          localStorage.setItem('local_ratings', JSON.stringify(updated));
        }
      }
    }
  };

  useEffect(() => {
    syncPendingItems('all');
  }, [feedbackWebhook, ratingWebhook]);

  const t = getTranslator(selectedLanguage);

  const requirePremiumOrAd = (callback: () => void) => {
    adService.showInterstitial(callback);
  };

  const handlePayment = (app: 'phonepe' | 'gpay' | 'upi') => {
    const amount = selectedPlan === 'yearly' ? 49 : 7;
    const upiId = 'akshaykale07057@oksbi';
    const name = 'PDF Reader Pro';

    let url = '';
    const queryParams = `pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;

    if (app === 'phonepe') {
      url = `phonepe://pay?${queryParams}`;
    } else if (app === 'gpay') {
      url = `tez://upi/pay?${queryParams}`;
    } else {
      url = `upi://pay?${queryParams}`;
    }

    if (Capacitor.isNativePlatform()) {
      AppLauncher.openUrl({ url }).catch(err => {
        console.warn('Failed to launch native payment app via AppLauncher, falling back to href navigation:', err);
        try {
          window.location.href = url;
        } catch (e) {
          console.error('Href navigation failed:', e);
        }
      });
    } else {
      try {
        window.location.href = url;
      } catch (e) {
        console.log('Failed to open payment app', e);
      }
    }
  };

  const handleShare = async () => {
    const textToShare = 'Check out this offline PDF & Document Reader app! ' + window.location.origin;
    const w = window as any;
    if (w.AndroidInterface && w.AndroidInterface.shareText) {
      w.AndroidInterface.shareText(textToShare);
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PDF Reader Pro',
          text: 'Check out this offline PDF & Document Reader app!',
          url: window.location.origin,
        });
        return;
      } catch (err) {
        console.log('Error sharing', err);
      }
    }

    try {
      await navigator.clipboard.writeText(textToShare);
      if (!navigator.userAgent.toLowerCase().includes('android')) {
        alert('App link copied to your clipboard! Paste/share it directly in WhatsApp or messages to invite friends.');
      } else {
        alert('Text copied to clipboard!');
      }
    } catch (e) {
      alert('Share offline reader link: ' + window.location.origin);
    }
  };

  const loadFiles = async () => {
    try {
      const storedFiles = await storageService.getFiles();
      setFiles(storedFiles);
      setRecentFiles(storedFiles.slice(0, 5));

      // Auto-sync handle is no longer needed as we persist Blobs directly
      /*
      const handle = await storageService.getDirectoryHandle();
      if (handle) {
        syncFolder(handle);
      }
      */
    } catch (error) {
      console.error('Failed to load files', error);
    }
  };

  const handleSyncComplete = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    try {
      const existingFiles = await storageService.getFiles();
      const existingIds = new Set(existingFiles.map(f => f.id));

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const rawFileName = file.name || 'unnamed_document';
        const rawExt = rawFileName.split('.').pop()?.toLowerCase() || '';
        const mimeType = file.type?.toLowerCase() || '';

        // Comprehensive extensions mapping to correct DocFile type
        const extToType: Record<string, DocFile['type']> = {
          'pdf': 'pdf',
          'doc': 'doc',
          'docx': 'doc',
          'rtf': 'doc',
          'xls': 'xlsx',
          'xlsx': 'xlsx',
          'csv': 'xlsx',
          'ppt': 'ppt',
          'pptx': 'ppt',
          'epub': 'epub',
          'jpg': 'image',
          'jpeg': 'image',
          'png': 'image',
          'webp': 'image',
          'gif': 'image',
          'bmp': 'image',
          'svg': 'image'
        };

        // Comprehensive MIME-types mapping to correct DocFile type
        const mimeToType: Record<string, DocFile['type']> = {
          'application/pdf': 'pdf',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
          'application/vnd.ms-word': 'doc',
          'text/rtf': 'doc',
          'application/rtf': 'doc',
          'application/vnd.ms-excel': 'xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
          'text/csv': 'xlsx',
          'application/csv': 'xlsx',
          'application/vnd.ms-powerpoint': 'ppt',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
          'application/epub+zip': 'epub'
        };

        let detectedType: DocFile['type'] | null = null;

        // Try mapping by MIME type first
        if (mimeType && mimeToType[mimeType]) {
          detectedType = mimeToType[mimeType];
        }
        // Fallback for image MIME type prefix
        else if (mimeType && mimeType.startsWith('image/')) {
          detectedType = 'image';
        }
        // Fallback to extension matcher
        else if (rawExt && extToType[rawExt]) {
          detectedType = extToType[rawExt];
        }

        if (detectedType) {
          // Normalize file name: ensure the file has a suitable extension for its viewer and future downloads
          let normalizedName = rawFileName;
          const currentExtMatchesType = rawExt && extToType[rawExt] === detectedType;

          if (!currentExtMatchesType) {
            // Append corresponding default extension if it's missing or mismatching
            const defaultExts: Record<DocFile['type'], string> = {
              'pdf': 'pdf',
              'doc': 'docx',
              'xlsx': 'xlsx',
              'ppt': 'pptx',
              'epub': 'epub',
              'image': 'png'
            };
            normalizedName = `${rawFileName}.${defaultExts[detectedType]}`;
          }

          // Use a key properties-based robust identifier compatible with storage
          const cleanId = `fs-${normalizedName.replace(/[^a-zA-Z0-9.-]/g, '_')}-${file.size}-${file.lastModified || Date.now()}`;

          if (!existingIds.has(cleanId)) {
            const doc: DocFile = {
              id: cleanId,
              name: normalizedName,
              type: detectedType,
              size: file.size,
              createdAt: file.lastModified || Date.now(),
              lastOpenedAt: Date.now(), // Show on top immediately on import from storage
              url: '' // Will be resolved dynamically
            };

            await storageService.saveFile({ ...doc, data: file });
          }
        }
      }

      await loadFiles();
      // Switch to files tab to show they are successfully added
      if (activeTab === 'home') {
        setActiveTab('files');
      }
    } catch (error) {
      console.error('Sync failed', error);
    } finally {
      setIsScanning(false);
      isScanningRef.current = false;
    }
  };

  const handleAutoScan = (isRetry = false) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    const startTime = Date.now();
    
    (async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const scanned = await scanDeviceForDocuments();
          if (scanned && scanned.length > 0) {
            for (const file of scanned) {
              await storageService.saveFile(file);
            }
          } else if (!isRetry) {
            // If 0 files found on first scan (potentially due to OS storage mounting delay on resume),
            // schedule a retry in 1.5 seconds to check again.
            setTimeout(() => {
              handleAutoScan(true);
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Error auto scanning files:', error);
      } finally {
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, 1200 - elapsed);
        setTimeout(async () => {
          try {
            await loadFiles();
          } catch (e) {
            console.error("Error loading files in auto scan timeout:", e);
          } finally {
            setIsScanning(false);
            isScanningRef.current = false;
            // Switch to files tab to show scanned files immediately
            if (activeTab === 'home') {
              setActiveTab('files');
            }
          }
        }, remainingDelay);
      }
    })();
  };

  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!mainRef.current) return;
    // Only track if we are at the top of the scroll container
    if (mainRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = true;
    } else {
      isDragging.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !mainRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only handle pull-down gesture (deltaY > 0)
    if (deltaY > 0) {
      // Calculate pull resistance
      const pull = Math.min(deltaY * 0.4, 100);
      setPullY(pull);

      // Prevent browser default overscroll / bounce behavior while pulling down
      if (pull > 5 && e.cancelable) {
        e.preventDefault();
      }
    } else {
      // If user drags up, clear pull state immediately
      setPullY(0);
      isDragging.current = false;
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (pullY > 80 && !isScanning) {
      handleAutoScan();
    }
    setPullY(0);
  };

  const handlePickFolder = () => {
    handleAutoScan();
  };

  const filesTouchStartX = useRef<number | null>(null);
  const filesTouchStartY = useRef<number | null>(null);
  const filesSwipeTriggered = useRef<boolean>(false);
  const scrollPositionRef = useRef<number>(0);
  const windowScrollPositionRef = useRef<number>(0);

  useEffect(() => {
    if (!viewingDoc && !selectedFile && (scrollPositionRef.current > 0 || windowScrollPositionRef.current > 0)) {
      const savedMain = scrollPositionRef.current;
      const savedWin = windowScrollPositionRef.current;
      
      scrollPositionRef.current = 0; // Reset after reading so next click works correctly
      windowScrollPositionRef.current = 0;

      const restore = () => {
        if (mainRef.current) {
          mainRef.current.scrollTop = savedMain;
        }
        window.scrollTo(0, savedWin);
        document.documentElement.scrollTop = savedWin;
      };

      // Restore scroll at multiple intervals to handle asynchronous DOM updates and layout reflows
      const timer1 = setTimeout(restore, 30);
      const timer2 = setTimeout(restore, 100);
      const timer3 = setTimeout(restore, 250);
      const timer4 = setTimeout(restore, 500);
      const timer5 = setTimeout(restore, 800);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        clearTimeout(timer5);
      };
    }
  }, [viewingDoc, selectedFile]);

  const handleFilesTouchStart = (e: React.TouchEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.overflow-x-auto')) {
      return;
    }
    if (e.touches.length === 1) {
      filesTouchStartX.current = e.touches[0].clientX;
      filesTouchStartY.current = e.touches[0].clientY;
      filesSwipeTriggered.current = false;
    }
  };

  const handleFilesTouchMove = (e: React.TouchEvent) => {
    if (filesTouchStartX.current === null || filesTouchStartY.current === null || filesSwipeTriggered.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const diffX = currentX - filesTouchStartX.current;
    const diffY = currentY - filesTouchStartY.current;

    // Check if it's primarily horizontal swipe and meets threshold
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
      filesSwipeTriggered.current = true; // Prevent double trigger
      const categoriesList = ['All', 'PDF', 'EXCEL', 'DOC', 'PPT', 'EPUB', 'IMAGES'];
      const idx = categoriesList.indexOf(activeCategory);

      if (diffX > 0) {
        // Swiped right -> go to previous category
        if (idx > 0) {
          setActiveCategory(categoriesList[idx - 1]);
        }
      } else {
        // Swiped left -> go to next category
        if (idx < categoriesList.length - 1) {
          setActiveCategory(categoriesList[idx + 1]);
        }
      }
    }
  };

  const handleFilesTouchEnd = () => {
    filesTouchStartX.current = null;
    filesTouchStartY.current = null;
    filesSwipeTriggered.current = false;
  };

  // Startup storage permission and auto-scan check
  useEffect(() => {
    let hasPrompted = false;

    const scanIfGranted = async (retriesLeft = 4) => {
      try {
        if (Capacitor.isNativePlatform()) {
          const { Filesystem } = await import('@capacitor/filesystem');
          const permission = await Filesystem.checkPermissions();
          if (permission.publicStorage === 'granted') {
            const { AllFilesAccess } = await import('./folderscan/FileScanner');
            const { granted } = await AllFilesAccess.checkPermission();
            if (granted) {
              handleAutoScanRef.current();
              return;
            }
          }
          
          if (retriesLeft > 0) {
            console.log(`Permissions not yet fully granted. Retrying scanIfGranted in 500ms... (${retriesLeft} retries left)`);
            setTimeout(() => {
              scanIfGranted(retriesLeft - 1);
            }, 500);
          }
        }
      } catch (e) {
        console.warn("Scan if granted check failed", e);
      }
    };

    const promptPermissionsOnStartup = async () => {
      if (hasPrompted) return;
      hasPrompted = true;
      try {
        if (Capacitor.isNativePlatform()) {
          const { Filesystem } = await import('@capacitor/filesystem');
          const permission = await Filesystem.checkPermissions();
          if (permission.publicStorage !== 'granted') {
            const request = await Filesystem.requestPermissions();
            if (request.publicStorage === 'granted') {
              const { AllFilesAccess } = await import('./folderscan/FileScanner');
              const { granted } = await AllFilesAccess.checkPermission();
              if (!granted) {
                await AllFilesAccess.requestPermission();
              } else {
                handleAutoScanRef.current();
              }
            }
          } else {
            const { AllFilesAccess } = await import('./folderscan/FileScanner');
            const { granted } = await AllFilesAccess.checkPermission();
            if (!granted) {
              await AllFilesAccess.requestPermission();
            } else {
              handleAutoScanRef.current();
            }
          }
        }
      } catch (e) {
        console.warn("Startup permission check failed", e);
      }
    };

    const handleResume = () => {
      scanIfGranted();
    };

    // Use Capacitor App plugin for reliable resume events
    const stateListenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        handleResume();
        adService.showAppOpenAd();
      }
    });
    
    const handleFocus = () => {
      handleResume();
    };
    window.addEventListener('focus', handleFocus);
    
    // Slight delay on mount to ensure app is fully initialized first
    const timer = setTimeout(() => {
      promptPermissionsOnStartup();
    }, 300);

    return () => {
      stateListenerPromise.then(handle => handle.remove());
      window.removeEventListener('focus', handleFocus);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        const storedFiles = await storageService.getFiles();
        setFiles(storedFiles);
        setRecentFiles(storedFiles.slice(0, 5));
      } catch (error) {
        console.error('Failed to init app', error);
      } finally {
        // Initialize AdMob and show bottom banner ad
        await adService.initialize();
        await adService.showBanner();
      }
    };
    initApp();
  }, []);

  const handleRenameFile = async (id: string, newName: string) => {
    await storageService.renameFile(id, newName);
    const updatedFiles = await storageService.getFiles();
    setFiles(updatedFiles);
    setRecentFiles(updatedFiles.slice(0, 5));
  };

  const handleDeleteFile = async (id: string) => {
    await storageService.deleteFile(id);
    const updatedFiles = await storageService.getFiles();
    setFiles(updatedFiles);
    setRecentFiles(updatedFiles.slice(0, 5));
  };

  const handleDownloadFile = async (file: DocFile) => {
    try {
      const blob = await storageService.getFileData(file.id);
      if (!blob) {
        console.error("Could not load file data for download");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  };

  const handleShareFile = async (file: DocFile) => {
    try {
      await directShareFile(file);
    } catch (err: any) {
      console.error("Failed to share file natively:", err);
      alert(err.message || "Native share failed.");
    }
  };

  const handleShareMultipleFiles = async (filesToShare: DocFile[]) => {
    try {
      await directShareMultipleFiles(filesToShare);
    } catch (err: any) {
      console.error("Failed to share files natively:", err);
      alert(err.message || "Native share failed.");
    }
  };

  const handleScanComplete = async (newFile: DocFile) => {
    // If newFile comes from ScanView, it should already be saved or we save it here
    // But for consistency let's ensure it's in storage
    const storedFiles = await storageService.getFiles();
    setFiles(storedFiles);
    setRecentFiles(storedFiles.slice(0, 5));
    setActiveTab('home');
  };

  const handleFileClick = async (file: DocFile) => {
    if (mainRef.current) {
      scrollPositionRef.current = mainRef.current.scrollTop;
    }
    windowScrollPositionRef.current = window.pageYOffset || document.documentElement.scrollTop;
    setSelectedFile(file);
    // Mark as opened in local database to show on top of all lists immediately
    const updatedFile = { ...file, lastOpenedAt: Date.now() };
    await storageService.saveFile(updatedFile);
    await loadFiles();
  };

  const openDoc = async (file: DocFile) => {
    setSelectedFile(null);
    // Show interstitial ad before opening/viewing document
    adService.showInterstitial(async () => {
      setViewingDoc(file);
      await storageService.saveFile({ ...file, lastOpenedAt: Date.now() });
      await loadFiles();
    });
  };

  const handleViewingDocChange = async (newFile: DocFile) => {
    setViewingDoc(newFile);
    await storageService.saveFile({ ...newFile, lastOpenedAt: Date.now() });
    await loadFiles();
  };

  const getCurrentFilesList = (): DocFile[] => {
    if (activeTab === 'recent') {
      return recentFiles;
    }
    if (activeTab === 'files') {
      return files.filter(file => {
        if (activeCategory === 'All') return true;
        const mapping: Record<string, string> = {
          'PDF': 'pdf',
          'EXCEL': 'xlsx',
          'DOC': 'doc',
          'PPT': 'ppt',
          'EPUB': 'epub',
          'IMAGES': 'image'
        };
        return file.type === mapping[activeCategory];
      });
    }
    return files.length > 0 ? files : recentFiles;
  };

  const renderHome = () => (
    <div className="space-y-8 pb-32 pt-10">
      <header className="flex justify-between items-center px-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">{t('pdfReader')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 rounded-full bg-white border border-neutral-200/60 shadow-sm flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      <div className="px-6 relative z-50">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-red-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-200/60 shadow-sm rounded-full py-4 pl-14 pr-6 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all"
          />
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 shadow-xl rounded-2xl max-h-60 overflow-y-auto w-full z-50">
              {files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map(file => (
                  <button
                    key={file.id}
                    onClick={() => {
                      handleFileClick(file);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center shrink-0">
                      <Files size={18} className="text-neutral-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 truncate text-sm">{file.name}</p>
                      <p className="text-xs text-neutral-500 truncate">{formatFileSize(file.size)}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm font-medium text-neutral-500">
                  {t('noMatches')} "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 px-6">
        <button
          onClick={() => setShowQRScanner(true)}
          className="flex flex-col items-center gap-3 group"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-red-500 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-red-200 transition-all duration-300">
            <QrCode size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-tight uppercase whitespace-nowrap">{t('qrScanner')}</span>
        </button>

        <button
          onClick={() => requirePremiumOrAd(() => setShowCompressor(true))}
          className="flex flex-col items-center gap-3 group"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-neutral-900 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-neutral-300 transition-all duration-300">
            <Minimize2 size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-wide uppercase">{t('compress')}</span>
        </button>

        <button
          onClick={() => requirePremiumOrAd(() => setShowMerge(true))}
          className="flex flex-col items-center gap-3 group"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-indigo-200 transition-all duration-300">
            <Merge size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-wide uppercase">{t('merge')}</span>
        </button>

        <button
          onClick={() => requirePremiumOrAd(() => setShowSplit(true))}
          className="flex flex-col items-center gap-3 group"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-orange-500 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-orange-200 transition-all duration-300">
            <Scissors size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-wide uppercase">{t('split')}</span>
        </button>
      </div>

      {!isPro && (
        <div className="mx-6 mb-8 mt-4 relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-[28px] blur opacity-20"></div>
          <div className="w-full bg-gradient-to-br from-amber-50 via-white to-amber-50/50 rounded-[24px] border border-amber-200/50 p-5 flex flex-col relative overflow-hidden shadow-sm transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

            <button
              onClick={() => setIsPromoExpanded(!isPromoExpanded)}
              className="flex items-center justify-between w-full text-left z-10"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                  <Crown size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-neutral-900 leading-tight">PDF Reader Pro</h3>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">{isPromoExpanded ? 'Premium Plan' : 'Remove Ads & Unlock Tools'}</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-100/50 flex items-center justify-center text-amber-600">
                {isPromoExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            <AnimatePresence>
              {isPromoExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 pb-2 space-y-2 z-10 relative">
                    <div className="flex items-center gap-2 text-sm text-neutral-700">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="font-medium">{t('adFreeExperience')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-700">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="font-medium">{t('unlimitedPdfCompression')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-700">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="font-medium">{t('accessAllPremiumTools')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => { setActiveSettingsModal('pro'); setShowSettings(true); }}
                    className="w-full mt-4 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-xl font-bold hover:from-amber-500 hover:to-amber-600 transition-colors shadow-lg shadow-amber-500/30 active:scale-95 z-10 relative"
                  >
                    {t('upgradeForTenRs')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <FileList
        title={files.length > 0 ? "Your Documents" : "Recent Documents"}
        files={files.length > 0 ? files : recentFiles}
        onFileClick={handleFileClick}
        onRenameFile={handleRenameFile}
        onDeleteFile={handleDeleteFile}
        onShareFile={handleShareFile}
        onShareFiles={handleShareMultipleFiles}
        onDownloadFile={handleDownloadFile}
        language={selectedLanguage}
        onRefresh={handleAutoScan}
      />
    </div>
  );

  const renderFiles = () => {
    const filteredFiles = files.filter(file => {
      if (activeCategory === 'All') return true;
      const mapping: Record<string, string> = {
        'PDF': 'pdf',
        'EXCEL': 'xlsx',
        'DOC': 'doc',
        'PPT': 'ppt',
        'EPUB': 'epub',
        'IMAGES': 'image'
      };
      return file.type === mapping[activeCategory];
    });

    return (
      <div 
        className="space-y-6 pb-32 pt-10"
        onTouchStart={handleFilesTouchStart}
        onTouchMove={handleFilesTouchMove}
        onTouchEnd={handleFilesTouchEnd}
      >
        <div className="flex justify-between items-center px-6">
          <h2 className="text-3xl font-display font-bold tracking-tight">{t('allFiles')}</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 px-6 no-scrollbar">
          {['All', 'PDF', 'EXCEL', 'DOC', 'PPT', 'EPUB', 'IMAGES'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300",
                activeCategory === cat
                  ? "bg-neutral-900 text-white shadow-md"
                  : "bg-white border border-neutral-200/60 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <FileList
          files={filteredFiles}
          onFileClick={handleFileClick}
          onRenameFile={handleRenameFile}
          onDeleteFile={handleDeleteFile}
          onShareFile={handleShareFile}
          onShareFiles={handleShareMultipleFiles}
          onDownloadFile={handleDownloadFile}
          language={selectedLanguage}
          onRefresh={handleAutoScan}
        />
      </div>
    );
  };

  const renderRecent = () => (
    <div className="space-y-6 pb-32 pt-10">
      <h2 className="text-3xl font-display font-bold px-6 tracking-tight">{t('recentlyOpened')}</h2>
      <FileList
        files={recentFiles}
        onFileClick={handleFileClick}
        onRenameFile={handleRenameFile}
        onDeleteFile={handleDeleteFile}
        onShareFile={handleShareFile}
        onShareFiles={handleShareMultipleFiles}
        onDownloadFile={handleDownloadFile}
        language={selectedLanguage}
        onRefresh={handleAutoScan}
      />
    </div>
  );



  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-neutral-900 max-w-md mx-auto shadow-2xl relative overflow-hidden">
      <AnimatePresence>
        {(pullY > 20 || isSyncing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: isSyncing ? 60 : Math.min(pullY, 80), opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none"
          >
            <div className={cn(
              "w-10 h-10 rounded-full bg-white shadow-md border border-neutral-100 flex items-center justify-center text-blue-600 transition-transform",
              isSyncing && "animate-spin"
            )}>
              {isSyncing ? <Loader2 size={20} /> : <ArrowDown size={20} style={{ transform: `rotate(${Math.min(pullY * 2, 180)}deg)` }} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        ref={mainRef}
        className="h-screen overflow-y-auto no-scrollbar relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <input
          id="device-scanner"
          type="file"
          multiple
          className="hidden"
          accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.ppt,application/vnd.ms-powerpoint,.epub,application/epub+zip,image/*"
          onChange={handleSyncComplete}
        />
        <div>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'files' && renderFiles()}
          {activeTab === 'recent' && renderRecent()}
          {activeTab === 'tools' && <ToolsView language={selectedLanguage} onSelectAction={(action) => {
            requirePremiumOrAd(() => {
              if (action === 'merge-pdf') setShowMerge(true);
              else if (action === 'split-pdf') setShowSplit(true);
              else setActiveToolAction(action);
            });
          }} />}
          {activeTab === 'scan' && <ScanView onComplete={handleScanComplete} onCancel={() => setActiveTab('home')} requirePremiumOrAd={requirePremiumOrAd} adBannerHeight={adBannerHeight} />}
        </div>
      </main>

      {isScanning && (
        <div className="fixed inset-0 z-[60] bg-white/75 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center border border-neutral-100/80">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" strokeWidth={2.5} />
          </div>
          <h3 className="mt-6 text-lg font-display font-bold text-neutral-900 tracking-tight">Scanning Storage</h3>
          <p className="mt-2 text-xs text-neutral-500 font-medium max-w-[220px]">Searching internal memory for documents...</p>
        </div>
      )}

      {/* Bottom Navigation (shifted dynamically when AdMob banner is active) */}
      <div 
        className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[380px] z-40 transition-all duration-300 ease-out"
        style={{ bottom: adBannerHeight > 0 ? `${adBannerHeight + 16}px` : '1.5rem' }}
      >
        <nav className="bg-white/90 backdrop-blur-xl border border-neutral-200/60 rounded-[32px] px-6 py-4 flex justify-between items-center shadow-2xl shadow-neutral-200/50">
          <NavButton active={activeTab === 'home'} onClick={() => handleTabClick('home')} icon={<Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} label={t('home')} />
          <NavButton active={activeTab === 'files'} onClick={() => handleTabClick('files')} icon={<Files size={24} strokeWidth={activeTab === 'files' ? 2.5 : 2} />} label={t('files')} />

          <button
            onClick={() => handleTabClick('scan')}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 -mt-10 border-[6px] border-[#FAFAFA] active:scale-95 transition-all hover:bg-red-600"
          >
            <Camera size={26} strokeWidth={2.5} />
          </button>

          <NavButton active={activeTab === 'recent'} onClick={() => handleTabClick('recent')} icon={<Clock size={24} strokeWidth={activeTab === 'recent' ? 2.5 : 2} />} label={t('recent')} />
          <NavButton active={activeTab === 'tools'} onClick={() => handleTabClick('tools')} icon={<Wrench size={24} strokeWidth={activeTab === 'tools' ? 2.5 : 2} />} label={t('tools')} />
        </nav>
      </div>

      {/* File Viewer Modal */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-50 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold truncate max-w-[200px]">{selectedFile.name}</h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-32 h-32 bg-blue-50 rounded-[32px] shadow-xl shadow-blue-100/50 flex items-center justify-center text-blue-600 mb-8 border border-blue-100">
                <Files size={56} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-display font-bold mb-6 tracking-tight text-neutral-900">{selectedFile.name}</h2>

              <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-sm w-full max-w-xs mb-10 text-left space-y-3">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-neutral-500 font-medium">{t('format')}</span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md uppercase">{selectedFile.type}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-neutral-500 font-medium">{t('size')}</span>
                  <span className="font-bold text-neutral-900">{formatFileSize(selectedFile.size)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-neutral-500 font-medium">{t('date')}</span>
                  <span className="font-bold text-neutral-900">{new Date(selectedFile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => openDoc(selectedFile!)}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full py-4 rounded-full font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <FolderOpen size={20} />
                  {t('openDocument')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Viewer */}
      <AnimatePresence>
        {viewingDoc && (
          <DocumentViewerModal
            file={viewingDoc}
            onClose={() => { setViewingDoc(null); loadFiles(); }}
            language={selectedLanguage}
            files={getCurrentFilesList()}
            onFileChange={handleViewingDocChange}
          />
        )}
      </AnimatePresence>





      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showQRScanner && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-50 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => setShowQRScanner(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold">{t('qrScanner')}</h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar bg-[#FAFAFA]">
              <QRScannerView onClose={() => setShowQRScanner(false)} language={selectedLanguage} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Size Converter Modal */}
      <AnimatePresence>
        {showCompressor && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-50 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => { setShowCompressor(false); loadFiles(); }} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold">{t('sizeConverter')}</h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <CompressorView language={selectedLanguage} onComplete={() => { setShowCompressor(false); setActiveTab('home'); loadFiles(); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Merge Modal */}
      <AnimatePresence>
        {showMerge && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-50 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => { setShowMerge(false); loadFiles(); }} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold">{t('pdfMerge')}</h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <MergeView language={selectedLanguage} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split Modal */}
      <AnimatePresence>
        {showSplit && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-50 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => { setShowSplit(false); loadFiles(); }} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold">{t('splitPdf')}</h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <SplitView language={selectedLanguage} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generic Tool Modal */}
      <AnimatePresence>
        {activeToolAction && (
          <GenericToolFeature
            toolId={activeToolAction}
            language={selectedLanguage}
            onClose={() => {
              setActiveToolAction(null);
              loadFiles();
            }}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-50 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold">{t('settings')}</h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">

              <div className="bg-white rounded-[24px] border border-neutral-200/60 shadow-sm overflow-hidden">
                <SettingsOption icon={<Crown className="text-amber-500" />} label={t('pdfReaderPro')} onClick={() => setActiveSettingsModal('pro')} />
                <SettingsOption icon={<Globe className="text-blue-500" />} label={t('language')} value={LANGUAGE_DISPLAY_NAMES[selectedLanguage] || selectedLanguage} onClick={() => setActiveSettingsModal('language')} />
              </div>

              <div className="bg-white rounded-[24px] border border-neutral-200/60 shadow-sm overflow-hidden">
                <SettingsOption icon={<Share2 className="text-green-500" />} label={t('shareApp')} onClick={handleShare} />
                <SettingsOption icon={<Star className="text-yellow-500" />} label={t('rateApp')} onClick={() => setActiveSettingsModal('rate')} />
                <SettingsOption icon={<MessageSquare className="text-indigo-500" />} label={t('feedback')} onClick={() => setActiveSettingsModal('feedback')} />
              </div>

              <div className="bg-white rounded-[24px] border border-neutral-200/60 shadow-sm overflow-hidden">
                <SettingsOption icon={<Shield className="text-emerald-500" />} label={t('privacyPolicy')} onClick={() => setActiveSettingsModal('privacy')} />
              </div>

              <div className="flex flex-col items-center justify-center pt-4 pb-2 space-y-1">
                <p className="text-xs font-mono font-semibold text-neutral-400">Version 1.0.0</p>
                <p className="text-[10px] font-medium text-neutral-300">© 2026 PDF Reader Pro</p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-Settings Modals */}
      <AnimatePresence>
        {activeSettingsModal && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAFAFA] z-[60] flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-neutral-200/60 bg-white shadow-sm">
              <button onClick={() => setActiveSettingsModal(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-display font-bold">
                {activeSettingsModal === 'pro' && t('pdfReaderPro')}
                {activeSettingsModal === 'payment' && 'Payment'}
                {activeSettingsModal === 'language' && t('language')}
                {activeSettingsModal === 'feedback' && t('feedback')}
                {activeSettingsModal === 'rate' && t('rateUs')}
                {activeSettingsModal === 'privacy' && t('privacyPolicy')}
              </h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">

              {activeSettingsModal === 'pro' && (
                <div className="flex flex-col items-center text-center space-y-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center shadow-lg shadow-amber-200/50">
                    <Crown size={48} className="text-amber-600" />
                  </div>

                  <div className="space-y-4 w-full">
                    <div className="flex items-center justify-center gap-3 text-lg font-medium text-neutral-700">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><Check size={14} className="text-green-600" /></div>
                      {t('allDocumentsReader')}
                    </div>
                    <div className="flex items-center justify-center gap-3 text-lg font-medium text-neutral-700">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><Check size={14} className="text-green-600" /></div>
                      {t('removeAllAds')}
                    </div>
                    <div className="flex items-center justify-center gap-3 text-lg font-medium text-neutral-700">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><Check size={14} className="text-green-600" /></div>
                      {t('bestExperience')}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full pt-4">
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className={cn(
                        "p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-2",
                        selectedPlan === 'monthly' ? "border-amber-500 bg-amber-50 shadow-md" : "border-neutral-200 bg-white hover:border-amber-300"
                      )}
                    >
                      <div className="font-bold text-neutral-600">{t('monthly')}</div>
                      <div className="text-2xl font-display font-bold text-amber-600">7 Rs.</div>
                    </button>
                    <button
                      onClick={() => setSelectedPlan('yearly')}
                      className={cn(
                        "p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-2 relative",
                        selectedPlan === 'yearly' ? "border-amber-500 bg-amber-50 shadow-md" : "border-neutral-200 bg-white hover:border-amber-300"
                      )}
                    >
                      <div className="absolute -top-3 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">{t('bestValue')}</div>
                      <div className="font-bold text-neutral-600">{t('yearly')}</div>
                      <div className="text-2xl font-display font-bold text-amber-600">49 Rs.</div>
                    </button>
                  </div>

                  <button
                    onClick={() => setActiveSettingsModal('payment')}
                    className="w-full py-4 mt-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-lg shadow-xl shadow-amber-500/30 active:scale-[0.98] transition-all"
                  >
                    {t('continue')}
                  </button>
                </div>
              )}

              {activeSettingsModal === 'payment' && (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-center text-neutral-500 font-medium mb-6">Select your preferred payment method for the {selectedPlan} plan.</p>

                  {/* UPI Expandable Option */}
                  <div className="bg-white border border-neutral-200/60 rounded-[24px] overflow-hidden shadow-sm transition-all duration-300">
                    <button
                      onClick={() => {
                        setIsUpiExpanded(!isUpiExpanded);
                        setIsCardExpanded(false);
                      }}
                      className={cn(
                        "w-full p-5 flex items-center justify-between font-bold text-lg transition-all",
                        isUpiExpanded ? "bg-neutral-50 border-b border-neutral-100" : "hover:bg-neutral-50/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600"><Wallet size={24} /></div>
                        <span>UPI</span>
                      </div>
                      <ChevronDown size={20} className={cn("text-neutral-400 transition-transform duration-300", isUpiExpanded && "rotate-180")} />
                    </button>

                    {isUpiExpanded && (
                      <div className="p-4 bg-neutral-50/50 space-y-3 border-t border-neutral-100/60">
                        <p className="text-xs text-neutral-500 font-semibold px-2 mb-1">CHOOSE AN APP TO PAY via UPI</p>
                        <button
                          onClick={() => handlePayment('phonepe')}
                          className="w-full p-4 bg-white border border-neutral-200/50 rounded-2xl flex items-center gap-3.5 font-semibold text-base shadow-sm hover:border-indigo-500 active:scale-[0.99] transition-all"
                        >
                          <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><Smartphone size={18} /></div>
                          Phone Pay
                        </button>
                        <button
                          onClick={() => handlePayment('gpay')}
                          className="w-full p-4 bg-white border border-neutral-200/50 rounded-2xl flex items-center gap-3.5 font-semibold text-base shadow-sm hover:border-blue-500 active:scale-[0.99] transition-all"
                        >
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Globe size={18} /></div>
                          Google Pay
                        </button>

                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-neutral-200"></div>
                          <span className="flex-shrink mx-4 text-[10px] text-neutral-400 font-bold tracking-widest uppercase">Or Pay via UPI ID</span>
                          <div className="flex-grow border-t border-neutral-200"></div>
                        </div>

                        <form onSubmit={handleUpiIdPayment} className="space-y-3">
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="username@upi"
                              value={upiId}
                              onChange={(e) => setUpiId(e.target.value)}
                              className="w-full pl-4 pr-24 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-semibold outline-none focus:border-green-500 transition-all font-mono"
                            />
                            <button
                              type="submit"
                              disabled={isProcessingUpiId}
                              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-neutral-400 text-white text-xs font-bold rounded-lg transition-all active:scale-[0.97] flex items-center justify-center min-w-[70px]"
                            >
                              {isProcessingUpiId ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                "Pay Now"
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* Add Card Expandable Option */}
                  <div className="bg-white border border-neutral-200/60 rounded-[24px] overflow-hidden shadow-sm transition-all duration-300">
                    <button
                      onClick={() => {
                        setIsCardExpanded(!isCardExpanded);
                        setIsUpiExpanded(false);
                      }}
                      className={cn(
                        "w-full p-5 flex items-center justify-between font-bold text-lg transition-all",
                        isCardExpanded ? "bg-neutral-50 border-b border-neutral-100" : "hover:bg-neutral-50/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600"><CreditCard size={24} /></div>
                        <span>Add Card</span>
                      </div>
                      <ChevronDown size={20} className={cn("text-neutral-400 transition-transform duration-300", isCardExpanded && "rotate-180")} />
                    </button>

                    {isCardExpanded && (
                      <form onSubmit={handleCardPayment} className="p-5 bg-neutral-50/50 space-y-4 border-t border-neutral-100/60">
                        <p className="text-xs text-neutral-500 font-semibold px-2 mb-1">ENTER YOUR DEBIT/CREDIT CARD DETAILS</p>

                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1 px-1">Card Number</label>
                            <input
                              type="text"
                              required
                              maxLength={19}
                              placeholder="Enter Card Number"
                              value={cardNumber}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
                                setCardNumber(val);
                              }}
                              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-500 transition-all"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1 px-1">Expiry Date</label>
                              <input
                                type="text"
                                required
                                maxLength={5}
                                placeholder="MM/YY"
                                value={cardExpiry}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  let formattedVal = val;
                                  if (val.length === 1 && val !== '0' && val !== '1') {
                                    formattedVal = '0' + val;
                                  } else if (val.length >= 2) {
                                    const month = val.slice(0, 2);
                                    const monthNum = parseInt(month, 10);
                                    if (monthNum < 1 || monthNum > 12) {
                                      return;
                                    }
                                  }
                                  if (formattedVal.length <= 2) {
                                    setCardExpiry(formattedVal);
                                  } else {
                                    setCardExpiry(`${formattedVal.slice(0, 2)}/${formattedVal.slice(2, 4)}`);
                                  }
                                }}
                                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-500 transition-all"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1 px-1">CVV</label>
                              <input
                                type="password"
                                required
                                maxLength={3}
                                placeholder="***"
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-500 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isProcessingCard}
                          className="w-full py-3.5 bg-neutral-900 text-white font-bold rounded-xl text-sm shadow-md hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:bg-neutral-400 flex items-center justify-center gap-2"
                        >
                          {isProcessingCard ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Processing Payment...</span>
                            </>
                          ) : (
                            <span>Pay Rs. {selectedPlan === 'yearly' ? '49' : '7'} Now</span>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {activeSettingsModal === 'language' && (
                <div className="space-y-4">
                  <div className="bg-white border border-neutral-200/60 rounded-[24px] overflow-hidden shadow-sm">
                    {Object.keys(LANGUAGE_DISPLAY_NAMES).map((lang, i) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setSelectedLanguage(lang);
                          localStorage.setItem('selected_language', lang);
                          setActiveSettingsModal(null);
                        }}
                        className={cn(
                          "w-full p-4 text-left font-semibold transition-colors flex justify-between items-center",
                          selectedLanguage === lang ? "bg-amber-50 text-amber-600" : "text-neutral-700 hover:bg-neutral-50",
                          i !== 0 && "border-t border-neutral-100"
                        )}
                      >
                        {LANGUAGE_DISPLAY_NAMES[lang]}
                        {selectedLanguage === lang && <Check size={20} />}
                      </button>
                    ))}
                  </div>

                  {/* Language sync alert */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-3xl flex items-start gap-3 shadow-sm select-none">
                    <span className="p-1 px-2.5 rounded-xl bg-emerald-500 text-white font-extrabold text-[9px] uppercase tracking-wider mt-0.5 shadow-sm shadow-emerald-500/10">{t('active')}</span>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-neutral-800 leading-snug">{t('syncedReader')}</p>
                      <p className="text-[11px] font-medium text-neutral-500 leading-relaxed">
                        {t('languageSyncDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsModal === 'feedback' && (
                <div className="space-y-6">
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    className="w-full h-48 p-5 bg-white border border-neutral-200/60 rounded-[24px] resize-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                    placeholder={t('feedbackPlaceholder')}
                    disabled={isSubmittingFeedback}
                  />
                  <button
                    disabled={isSubmittingFeedback}
                    onClick={async () => {
                      if (!feedbackText.trim()) return alert(t('writeFeedbackAlert'));

                      setIsSubmittingFeedback(true);

                      const newFeedback: LocalFeedback = {
                        id: 'fb-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        text: feedbackText,
                        timestamp: new Date().toLocaleString(),
                        language: selectedLanguage,
                        synced: false
                      };

                      const updatedFeedbacks = [newFeedback, ...localFeedbacks];
                      setLocalFeedbacks(updatedFeedbacks);
                      localStorage.setItem('local_feedbacks', JSON.stringify(updatedFeedbacks));

                      const webhookUrl = feedbackWebhook.trim();
                      if (webhookUrl) {
                        try {
                          await fetch(webhookUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              type: 'feedback',
                              text: newFeedback.text,
                              timestamp: newFeedback.timestamp,
                              language: newFeedback.language
                            })
                          });

                          // Mark as synced
                          const syncedFeedbacks = updatedFeedbacks.map(f => f.id === newFeedback.id ? { ...f, synced: true } : f);
                          setLocalFeedbacks(syncedFeedbacks);
                          localStorage.setItem('local_feedbacks', JSON.stringify(syncedFeedbacks));

                          alert("Feedback sent & synchronized to Google Sheet successfully!");
                        } catch (err) {
                          console.error(err);
                          alert("Error sending to Google Sheet, but feedback has been saved locally!");
                        }
                      } else {
                        alert(t('feedbackSentAlert'));
                      }

                      setIsSubmittingFeedback(false);
                      setActiveSettingsModal(null);
                      setFeedbackText('');
                    }}
                    className="w-full py-4 rounded-full bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingFeedback && <Loader2 size={20} className="animate-spin" />}
                    {t('sendToOwner')}
                  </button>

                  {/* Google Sheets Webhook Configuration for Feedback */}
                  <div className="bg-white border border-neutral-200/60 rounded-[24px] p-5 space-y-4 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackWebhookSetup(!showFeedbackWebhookSetup)}
                      className="w-full flex items-center justify-between font-bold text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Database size={18} className="text-emerald-500" />
                        Google Sheets Sync Settings
                      </span>
                      {showFeedbackWebhookSetup ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        feedbackWebhook.trim() ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"
                      )} />
                      {feedbackWebhook.trim() ? "Google Sheet Connected (Feedback)" : "Google Sheet Sync Disconnected"}
                    </div>

                    {showFeedbackWebhookSetup && (
                      <div className="space-y-4 pt-2 border-t border-neutral-100">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-neutral-600">Google Apps Script Web App URL</label>
                          <input
                            type="text"
                            placeholder="https://script.google.com/macros/s/.../exec"
                            value={feedbackWebhook}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFeedbackWebhook(val);
                              localStorage.setItem('VITE_FEEDBACK_WEBHOOK_URL', val);
                            }}
                            className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>

                        <div className="p-4 bg-emerald-50/70 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800">Apps Script Setup Code</span>
                            <button
                              type="button"
                              onClick={() => {
                                const code = `function doPost(e) {\n  try {\n    var data = JSON.parse(e.postData.contents);\n    var ss = SpreadsheetApp.getActiveSpreadsheet();\n    var type = data.type || (data.rating !== undefined ? "rating" : "feedback");\n    var sheetName = type === "rating" ? "Ratings" : "Feedback";\n    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);\n    \n    if (sheet.getLastRow() === 0) {\n      if (type === "rating") {\n        sheet.appendRow(["Timestamp", "Rating (Stars)", "Language"]);\n      } else {\n        sheet.appendRow(["Timestamp", "Feedback Text", "Language"]);\n      }\n    }\n    \n    if (type === "rating") {\n      sheet.appendRow([\n        data.timestamp || new Date().toLocaleString(),\n        data.rating || 0,\n        data.language || "English"\n      ]);\n    } else {\n      sheet.appendRow([\n        data.timestamp || new Date().toLocaleString(),\n        data.text || "",\n        data.language || "English"\n      ]);\n    }\n    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))\n      .setMimeType(ContentService.MimeType.JSON);\n  } catch (error) {\n    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))\n      .setMimeType(ContentService.MimeType.JSON);\n  }\n}`;
                                navigator.clipboard.writeText(code);
                                setCopiedFeedbackSetup(true);
                                setTimeout(() => setCopiedFeedbackSetup(false), 2000);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white text-emerald-700 hover:bg-neutral-50 rounded-lg shadow-sm border border-emerald-100 flex items-center gap-1.5 transition-all"
                            >
                              <Copy size={12} />
                              {copiedFeedbackSetup ? "Copied!" : "Copy Code"}
                            </button>
                          </div>

                          <p className="text-[11px] text-emerald-700 leading-relaxed font-semibold">
                            Step 1: Open Google Sheets and click <strong className="font-extrabold text-emerald-900">Extensions &gt; Apps Script</strong>.<br />
                            Step 2: Paste the copied code and click Deploy &gt; New deployment &gt; Web app (Set Access to <strong className="font-extrabold text-emerald-900">"Anyone"</strong>).<br />
                            Step 3: Copy the Web App URL and paste it into the field above. That's it!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feedback History Log */}
                  {localFeedbacks.length > 0 && (
                    <div className="bg-white border border-neutral-200/60 rounded-[24px] p-5 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                        <span className="font-bold text-sm text-neutral-700 flex items-center gap-2">
                          <MessageSquare size={18} className="text-indigo-500" />
                          Feedback History Log ({localFeedbacks.length})
                        </span>
                        {localFeedbacks.some(f => !f.synced) && (
                          <button
                            onClick={() => syncPendingItems('feedback')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2 py-1.5 rounded-lg active:scale-95 transition-all"
                          >
                            Sync Pending
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {localFeedbacks.map(fb => (
                          <div key={fb.id} className="p-3 bg-neutral-50 rounded-xl space-y-1 text-xs border border-neutral-100 relative">
                            <div className="flex justify-between items-start">
                              <span className="text-neutral-400 font-mono font-medium">{fb.timestamp}</span>
                              <span className={cn(
                                "flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full",
                                fb.synced ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                              )}>
                                {fb.synced ? <Check size={10} /> : <Database size={10} />}
                                {fb.synced ? "Synced" : "Local Only"}
                              </span>
                            </div>
                            <p className="text-neutral-700 font-medium whitespace-pre-wrap">{fb.text}</p>
                            <div className="text-[10px] text-neutral-400">Language: {fb.language}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSettingsModal === 'rate' && (
                <div className="space-y-8">
                  <div className="flex flex-col items-center justify-center pt-6 space-y-6">
                    <p className="font-semibold text-neutral-500 text-sm">How would you rate your experience?</p>
                    <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110 active:scale-95">
                          <Star size={48} className={cn("transition-colors duration-300", star <= rating ? "text-amber-400 fill-amber-400 animate-pulse" : "text-neutral-200")} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={isSubmittingRating}
                    onClick={async () => {
                      if (rating === 0) return alert(t('selectRatingAlert'));

                      setIsSubmittingRating(true);

                      const newRating: LocalRating = {
                        id: 'rt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        rating: rating,
                        timestamp: new Date().toLocaleString(),
                        language: selectedLanguage,
                        synced: false
                      };

                      const updatedRatings = [newRating, ...localRatings];
                      setLocalRatings(updatedRatings);
                      localStorage.setItem('local_ratings', JSON.stringify(updatedRatings));

                      const webhookUrl = ratingWebhook.trim();
                      if (webhookUrl) {
                        try {
                          await fetch(webhookUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              type: 'rating',
                              rating: newRating.rating,
                              timestamp: newRating.timestamp,
                              language: newRating.language
                            })
                          });

                          // Mark as synced
                          const syncedRatings = updatedRatings.map(r => r.id === newRating.id ? { ...r, synced: true } : r);
                          setLocalRatings(syncedRatings);
                          localStorage.setItem('local_ratings', JSON.stringify(syncedRatings));

                          alert("Rating submitted & synchronized to Google Sheet successfully!");
                        } catch (err) {
                          console.error(err);
                          alert("Error sending to Google Sheet, but thank you for rating!");
                        }
                      } else {
                        alert(t('thankRatingAlert'));
                      }

                      setIsSubmittingRating(false);
                      setActiveSettingsModal(null);
                      setRating(0);
                    }}
                    className="w-full py-4 rounded-full bg-amber-500 text-white font-bold text-lg shadow-lg shadow-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingRating && <Loader2 size={20} className="animate-spin" />}
                    {t('submit')}
                  </button>

                  {/* Google Sheets Webhook Configuration for Rating */}
                  <div className="bg-white border border-neutral-200/60 rounded-[24px] p-5 space-y-4 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowRatingWebhookSetup(!showRatingWebhookSetup)}
                      className="w-full flex items-center justify-between font-bold text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Database size={18} className="text-amber-500" />
                        Google Sheets Sync Settings
                      </span>
                      {showRatingWebhookSetup ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        ratingWebhook.trim() ? "bg-amber-500 animate-pulse" : "bg-neutral-300"
                      )} />
                      {ratingWebhook.trim() ? "Google Sheet Connected (Rating)" : "Google Sheet Sync Disconnected"}
                    </div>

                    {showRatingWebhookSetup && (
                      <div className="space-y-4 pt-2 border-t border-neutral-100">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-neutral-600">Google Apps Script Web App URL</label>
                          <input
                            type="text"
                            placeholder="https://script.google.com/macros/s/.../exec"
                            value={ratingWebhook}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRatingWebhook(val);
                              localStorage.setItem('VITE_RATING_WEBHOOK_URL', val);
                            }}
                            className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>

                        <div className="p-4 bg-amber-50/70 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-800">Apps Script Setup Code</span>
                            <button
                              type="button"
                              onClick={() => {
                                const code = `function doPost(e) {\n  try {\n    var data = JSON.parse(e.postData.contents);\n    var ss = SpreadsheetApp.getActiveSpreadsheet();\n    var type = data.type || (data.rating !== undefined ? "rating" : "feedback");\n    var sheetName = type === "rating" ? "Ratings" : "Feedback";\n    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);\n    \n    if (sheet.getLastRow() === 0) {\n      if (type === "rating") {\n        sheet.appendRow(["Timestamp", "Rating (Stars)", "Language"]);\n      } else {\n        sheet.appendRow(["Timestamp", "Feedback Text", "Language"]);\n      }\n    }\n    \n    if (type === "rating") {\n      sheet.appendRow([\n        data.timestamp || new Date().toLocaleString(),\n        data.rating || 0,\n        data.language || "English"\n      ]);\n    } else {\n      sheet.appendRow([\n        data.timestamp || new Date().toLocaleString(),\n        data.text || "",\n        data.language || "English"\n      ]);\n    }\n    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))\n      .setMimeType(ContentService.MimeType.JSON);\n  } catch (error) {\n    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))\n      .setMimeType(ContentService.MimeType.JSON);\n  }\n}`;
                                navigator.clipboard.writeText(code);
                                setCopiedRatingSetup(true);
                                setTimeout(() => setCopiedRatingSetup(false), 2000);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white text-amber-700 hover:bg-neutral-50 rounded-lg shadow-sm border border-amber-100 flex items-center gap-1.5 transition-all"
                            >
                              <Copy size={12} />
                              {copiedRatingSetup ? "Copied!" : "Copy Code"}
                            </button>
                          </div>

                          <p className="text-[11px] text-amber-700 leading-relaxed font-semibold">
                            Step 1: Open Google Sheets and click <strong className="font-extrabold text-amber-900">Extensions &gt; Apps Script</strong>.<br />
                            Step 2: Paste the copied code and click Deploy &gt; New deployment &gt; Web app (Set Access to <strong className="font-extrabold text-amber-900">"Anyone"</strong>).<br />
                            Step 3: Copy the Web App URL and paste it into the field above. That's it!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rating History Log */}
                  {localRatings.length > 0 && (
                    <div className="bg-white border border-neutral-200/60 rounded-[24px] p-5 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                        <span className="font-bold text-sm text-neutral-700 flex items-center gap-2">
                          <Star size={18} className="text-amber-500 fill-amber-500" />
                          Ratings History Log ({localRatings.length})
                        </span>
                        {localRatings.some(r => !r.synced) && (
                          <button
                            onClick={() => syncPendingItems('rating')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2 py-1.5 rounded-lg active:scale-95 transition-all"
                          >
                            Sync Pending
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {localRatings.map(rt => (
                          <div key={rt.id} className="p-3 bg-neutral-50 rounded-xl space-y-1 text-xs border border-neutral-100 relative">
                            <div className="flex justify-between items-start">
                              <span className="text-neutral-400 font-mono font-medium">{rt.timestamp}</span>
                              <span className={cn(
                                "flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full",
                                rt.synced ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                              )}>
                                {rt.synced ? <Check size={10} /> : <Database size={10} />}
                                {rt.synced ? "Synced" : "Local Only"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-amber-400">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  size={14}
                                  className={star <= rt.rating ? "fill-amber-400 text-amber-400" : "text-neutral-200"}
                                />
                              ))}
                            </div>
                            <div className="text-[10px] text-neutral-400">Language: {rt.language}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSettingsModal === 'privacy' && (
                <div className="bg-white p-6 rounded-[24px] border border-neutral-200/60 shadow-sm space-y-4 text-neutral-600 leading-relaxed">
                  <p>{t('dataCollection')}</p>
                  <p>{t('fileSecurity')}</p>
                  <p>{t('thirdPartyServices')}</p>
                  <p>{t('userRights')}</p>
                  <p>{t('updatesPolicy')}</p>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adCallback && (
          <AdPlayerModal
            onComplete={() => {
              adCallback.run();
              setAdCallback(null);
            }}
            onGoPro={() => {
              setAdCallback(null);
              setShowSettings(true);
              setActiveSettingsModal('pro');
            }}
            onClose={() => {
              setAdCallback(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsOption({ icon, label, value, onClick }: { icon: React.ReactNode, label: string, value?: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center border border-neutral-100">
          {icon}
        </div>
        <span className="font-semibold text-neutral-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm font-medium text-neutral-500">{value}</span>}
        <ChevronRight size={20} className="text-neutral-400" />
      </div>
    </button>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-red-500" : "text-neutral-400"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
