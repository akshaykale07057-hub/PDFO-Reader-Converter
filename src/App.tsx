import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
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
  Globe,
  Share2,
  Star,
  MessageSquare,
  Shield,
  ChevronRight,
  Check,
  Loader2,
  Wrench,
  FilePlus,
  FolderOpen,
  ShieldCheck,
  Bell,
  ArrowDown,
  Download,
  QrCode,
  Database,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { DocFile, TabType } from './types';
import { storageService } from './services/storageService';
import { adService } from './services/adService';
import { FileList } from './components/FileList';
import { ToolsView } from './components/ToolsView';
import { scanDeviceForDocuments } from './folderscan/FileScanner';
import { directShareFile, directShareMultipleFiles, downloadDocumentFile } from './utils/shareUtils';
import { cn } from './utils/cn';
import { formatFileSize } from './utils/fileUtils';
import { getTranslator, LANGUAGE_DISPLAY_NAMES } from './utils/translator';

const DocumentViewerModal = React.lazy(() => import('./components/DocumentViewerModal').then(m => ({ default: m.DocumentViewerModal })));
const ScanView = React.lazy(() => import('./components/ScanView').then(m => ({ default: m.ScanView })));
const GenericToolFeature = React.lazy(() => import('./components/GenericToolFeature').then(m => ({ default: m.GenericToolFeature })));
const QRScannerView = React.lazy(() => import('./components/QRScannerView').then(m => ({ default: m.QRScannerView })));
const CompressorView = React.lazy(() => import('./components/CompressorView').then(m => ({ default: m.CompressorView })));
const MergeView = React.lazy(() => import('./components/MergeView').then(m => ({ default: m.MergeView })));
const SplitView = React.lazy(() => import('./components/SplitView').then(m => ({ default: m.SplitView })));
const AdPlayerModal = React.lazy(() => import('./components/AdPlayerModal').then(m => ({ default: m.AdPlayerModal })));

const ViewSuspenseFallback = () => (
  <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6">
    <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center border border-neutral-100">
      <Loader2 className="w-7 h-7 text-red-500 animate-spin" strokeWidth={2.5} />
    </div>
  </div>
);

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
  const [showAppSplash, setShowAppSplash] = useState(true);
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

  useEffect(() => {
    if (viewingDoc) {
      adService.hideBanner();
    } else {
      adService.showBanner();
    }
  }, [viewingDoc]);

  const [activeToolAction, setActiveToolAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activeSettingsModal, setActiveSettingsModal] = useState<'language' | 'feedback' | 'rate' | 'privacy' | null>(null);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [adCallback, setAdCallback] = useState<{ run: () => void } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('selected_language') || 'English US');

  const mainRef = useRef<HTMLDivElement>(null);
  const isScanningRef = useRef(false);
  const handleAutoScanRef = useRef<(isRetry?: boolean, isInitial?: boolean) => void>(() => {});

  // Keyboard visibility detection to prevent bottom nav bar from covering search inputs
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialHeight = window.innerHeight;

    const checkKeyboard = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const isInputFocused = Boolean(
        document.activeElement && 
        (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || (document.activeElement as HTMLElement).isContentEditable)
      );
      const isHeightShrunk = (initialHeight - vh) > 100 || (window.screen.height - vh) > 200;
      setIsKeyboardOpen(isInputFocused || isHeightShrunk);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement;
        if (!active || (!['INPUT', 'TEXTAREA'].includes(active.tagName) && !active.isContentEditable)) {
          const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
          if ((initialHeight - vh) <= 100) {
            setIsKeyboardOpen(false);
          }
        }
      }, 150);
    };

    window.visualViewport?.addEventListener('resize', checkKeyboard);
    window.visualViewport?.addEventListener('scroll', checkKeyboard);
    window.addEventListener('resize', checkKeyboard);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    let subs: any[] = [];
    try {
      subs.push(Keyboard.addListener('keyboardWillShow', () => setIsKeyboardOpen(true)));
      subs.push(Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true)));
      subs.push(Keyboard.addListener('keyboardWillHide', () => setIsKeyboardOpen(false)));
      subs.push(Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardOpen(false);
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
          (document.activeElement as HTMLElement)?.blur();
          setIsSearchFocused(false);
        }
      }));
    } catch (_) {}

    return () => {
      window.visualViewport?.removeEventListener('resize', checkKeyboard);
      window.visualViewport?.removeEventListener('scroll', checkKeyboard);
      window.removeEventListener('resize', checkKeyboard);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      subs.forEach(s => s?.remove?.());
    };
  }, []);

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

  // Tab containers for instant, butter-smooth tab switching (zero layout reflow & zero scroll jumping)
  const homeContainerRef = useRef<HTMLDivElement>(null);
  const filesContainerRef = useRef<HTMLDivElement>(null);
  const recentContainerRef = useRef<HTMLDivElement>(null);
  const toolsContainerRef = useRef<HTMLDivElement>(null);

  const activeTabRef = useRef<TabType>(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const getActiveScrollContainer = useCallback((tab: TabType = activeTabRef.current) => {
    switch (tab) {
      case 'home': return homeContainerRef.current;
      case 'files': return filesContainerRef.current;
      case 'recent': return recentContainerRef.current;
      case 'tools': return toolsContainerRef.current;
      default: return null;
    }
  }, []);

  const fileReturnScrollRef = useRef<{ tab: TabType; top: number } | null>(null);
  const isOpeningDocRef = useRef(false);

  const handleTabClick = useCallback((tab: TabType) => {
    if (activeTabRef.current === tab) {
      const container = getActiveScrollContainer(tab);
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      if (tab === 'recent' && recentContainerRef.current) {
        recentContainerRef.current.scrollTop = 0;
      }
      setActiveTab(tab);
    }
  }, [getActiveScrollContainer]);

  const handleCancelSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchFocused(false);
    setIsKeyboardOpen(false);
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName)) {
      activeEl.blur();
    }
    try {
      Keyboard.hide();
    } catch (_) {}
  }, []);

  // Back button handler
  const handleGoBack = () => {
    if (isSearchFocused || searchQuery.trim().length > 0) {
      handleCancelSearch();
      return;
    }
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
    if (activeTab === 'scan') {
      setActiveTab('home');
      return;
    }
    if (activeTab === 'tools') {
      setActiveTab('home');
      return;
    }

    const history = tabHistoryRef.current;
    if (history.length > 1) {
      history.pop();
      const prevTab = history[history.length - 1];
      if (prevTab === 'recent' && recentContainerRef.current) {
        recentContainerRef.current.scrollTop = 0;
      }
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

  const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwKygSiBDpLOp_uwRu6Cq0nqLTU5hEbX5e7BlYMOBuZzILnmmepW-qBhFX8hOQSYfj-Hg/exec';

  const [feedbackWebhook, setFeedbackWebhook] = useState(() => {
    return localStorage.getItem('VITE_FEEDBACK_WEBHOOK_URL') || ((import.meta as any).env?.VITE_FEEDBACK_WEBHOOK_URL as string) || DEFAULT_WEBHOOK_URL;
  });
  const [ratingWebhook, setRatingWebhook] = useState(() => {
    return localStorage.getItem('VITE_RATING_WEBHOOK_URL') || ((import.meta as any).env?.VITE_RATING_WEBHOOK_URL as string) || DEFAULT_WEBHOOK_URL;
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

  const requirePremiumOrAd = useCallback((callback: () => void) => {
    adService.showInterstitial(callback);
  }, []);

  const handleShare = async () => {
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.pdforeader.app';
    const textToShare = `Check out PDFO Reader & Converter! Download the app from Google Play Store: ${playStoreUrl}`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: 'PDFO Reader & Converter',
          text: 'Check out PDFO Reader & Converter — read, convert, compress, and scan documents offline!',
          url: playStoreUrl,
          dialogTitle: 'Share PDFO Reader & Converter',
        });
        return;
      } catch (err) {
        console.log('Error native sharing', err);
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PDFO Reader & Converter',
          text: 'Check out PDFO Reader & Converter — read, convert, compress, and scan documents offline!',
          url: playStoreUrl,
        });
        return;
      } catch (err) {
        console.log('Error web sharing', err);
      }
    }

    try {
      await navigator.clipboard.writeText(textToShare);
      alert('Play Store link copied to your clipboard! Paste and share it with your friends.');
    } catch (e) {
      alert(`Download PDFO Reader & Converter: ${playStoreUrl}`);
    }
  };

  const loadFiles = useCallback(async () => {
    try {
      const storedFiles = await storageService.getFiles();
      setFiles(storedFiles);
      const recent = [...storedFiles]
        .filter(f => f.lastOpenedAt && f.lastOpenedAt > 0)
        .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
      setRecentFiles(recent.length > 0 ? recent.slice(0, 10) : storedFiles.slice(0, 5));

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
  }, []);

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

  const handleAutoScan = (isRetry = false, isInitial = false) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    const startTime = Date.now();
    
    (async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const scanned = await scanDeviceForDocuments();
          if (scanned && scanned.length > 0) {
            await storageService.saveFilesBatch(scanned);
          } else if (!isRetry) {
            // If 0 files found on first scan (potentially due to OS storage mounting delay on resume),
            // schedule a retry in 1.5 seconds to check again.
            setTimeout(() => {
              handleAutoScan(true, isInitial);
            }, 1500);
            return;
          }
          // Mark initial storage scan as completed
          localStorage.setItem('initial_storage_scan_done', 'true');
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
            // Ensure user stays on the Home page after scanning
            if (isInitial) {
              setActiveTab('home');
            }
          }
        }, remainingDelay);
      }
    })();
  };

  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const pullYRef = useRef(0);
  const rafId = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = getActiveScrollContainer();
    if (!container) return;
    // Only track if we are at the top of the scroll container
    if (container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = true;
    } else {
      isDragging.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = getActiveScrollContainer();
    if (!isDragging.current || !container) return;
    if (container.scrollTop > 0) {
      isDragging.current = false;
      if (pullYRef.current !== 0) {
        pullYRef.current = 0;
        setPullY(0);
      }
      return;
    }
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only handle pull-down gesture (deltaY > 0)
    if (deltaY > 0) {
      // Calculate pull resistance
      const pull = Math.min(deltaY * 0.4, 100);
      pullYRef.current = pull;
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          setPullY(pullYRef.current);
          rafId.current = null;
        });
      }

      // Prevent browser default overscroll / bounce behavior while pulling down
      if (pull > 5 && e.cancelable) {
        e.preventDefault();
      }
    } else {
      // If user drags up, clear pull state immediately
      pullYRef.current = 0;
      setPullY(0);
      isDragging.current = false;
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    const finalPull = pullYRef.current;
    pullYRef.current = 0;
    setPullY(0);
    if (finalPull > 80 && !isScanning) {
      handleAutoScan();
    }
  };

  const handlePickFolder = () => {
    handleAutoScan();
  };

  const filesTouchStartX = useRef<number | null>(null);
  const filesTouchStartY = useRef<number | null>(null);
  const filesSwipeTriggered = useRef<boolean>(false);

  // File return scroll restoration effect (restores position after closing file preview or doc viewer)
  useEffect(() => {
    if (!viewingDoc && !selectedFile && !isOpeningDocRef.current && fileReturnScrollRef.current) {
      const savedInfo = fileReturnScrollRef.current;
      fileReturnScrollRef.current = null; // Clear so it only restores once

      const container = getActiveScrollContainer(savedInfo.tab);
      if (container) {
        container.scrollTop = savedInfo.top;
      }
    }
  }, [viewingDoc, selectedFile]);

  const handleCategorySelect = useCallback((cat: string) => {
    setActiveCategory(cat);
    if (filesContainerRef.current) {
      filesContainerRef.current.scrollTop = 0;
    }
  }, []);

  const handleFilesTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.overflow-x-auto')) {
      return;
    }
    if (e.touches.length === 1) {
      filesTouchStartX.current = e.touches[0].clientX;
      filesTouchStartY.current = e.touches[0].clientY;
      filesSwipeTriggered.current = false;
    }
  }, []);

  const handleFilesTouchMove = useCallback((e: React.TouchEvent) => {
    if (filesTouchStartX.current === null || filesTouchStartY.current === null || filesSwipeTriggered.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const diffX = currentX - filesTouchStartX.current;
    const diffY = currentY - filesTouchStartY.current;

    // If there is any significant vertical motion, lock out category swipe so scrolling documents is butter-smooth
    if (Math.abs(diffY) > 20) {
      filesSwipeTriggered.current = true;
      return;
    }

    // Check if it's primarily horizontal swipe and meets threshold
    if (!filesSwipeTriggered.current && Math.abs(diffX) > 75 && Math.abs(diffY) <= 20) {
      filesSwipeTriggered.current = true; // Prevent double trigger
      const categoriesList = ['All', 'PDF', 'EXCEL', 'DOC', 'PPT', 'EPUB', 'IMAGES'];
      const idx = categoriesList.indexOf(activeCategory);

      if (diffX > 0) {
        // Swiped right -> go to previous category
        if (idx > 0) {
          handleCategorySelect(categoriesList[idx - 1]);
        }
      } else {
        // Swiped left -> go to next category
        if (idx < categoriesList.length - 1) {
          handleCategorySelect(categoriesList[idx + 1]);
        }
      }
    }
  }, [activeCategory, handleCategorySelect]);

  const handleFilesTouchEnd = useCallback(() => {
    filesTouchStartX.current = null;
    filesTouchStartY.current = null;
    filesSwipeTriggered.current = false;
  }, []);

  // Startup storage permission and first-time initial scan check
  useEffect(() => {
    let hasPrompted = false;

    const checkStartupScan = async () => {
      // If initial scan was already done previously, do NOT show scanning storage on app reopen
      const hasInitialScanned = localStorage.getItem('initial_storage_scan_done') === 'true';
      if (hasInitialScanned) {
        loadFiles();
        return;
      }

      if (hasPrompted) return;
      hasPrompted = true;

      try {
        if (Capacitor.isNativePlatform()) {
          const { Filesystem } = await import('@capacitor/filesystem');
          const permission = await Filesystem.checkPermissions();
          if (permission.publicStorage !== 'granted') {
            const request = await Filesystem.requestPermissions();
            if (request.publicStorage === 'granted') {
              handleAutoScanRef.current(false, true);
            }
          } else {
            handleAutoScanRef.current(false, true);
          }
        }
      } catch (e) {
        console.warn("Startup permission check failed", e);
      }
    };

    // When app resumes or gets focus, just refresh files from local database without showing scanning storage modal
    const handleResume = () => {
      loadFiles();
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
      checkStartupScan();
    }, 400);

    return () => {
      stateListenerPromise.then(handle => handle.remove());
      window.removeEventListener('focus', handleFocus);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // Hide native OS splash immediately so the app shows only the unified custom animated splash
    SplashScreen.hide().catch(() => {});

    const initApp = async () => {
      // Quick fast startup: show the 3-dot animated splash briefly (~350ms) while loading documents, then quickly show interface
      const minDisplayDuration = new Promise(resolve => setTimeout(resolve, 350));
      try {
        await Promise.all([loadFiles(), minDisplayDuration]);
      } catch (error) {
        console.error('Failed to init app', error);
      } finally {
        // Smoothly reveal main interface
        setShowAppSplash(false);

        // Initialize AdMob and show bottom banner ad
        try {
          await adService.initialize();
          await adService.showBanner();
        } catch (adErr) {
          console.warn('Ad initialization error', adErr);
        }
      }
    };
    initApp();
  }, []);

  const handleRenameFile = useCallback(async (id: string, newName: string) => {
    await storageService.renameFile(id, newName);
    await loadFiles();
  }, [loadFiles]);

  const handleDeleteFile = useCallback(async (id: string) => {
    await storageService.deleteFile(id);
    await loadFiles();
  }, [loadFiles]);

  const handleDownloadFile = useCallback(async (file: DocFile) => {
    await downloadDocumentFile(file);
  }, []);

  const handleShareFile = useCallback(async (file: DocFile) => {
    try {
      await directShareFile(file);
    } catch (err: any) {
      console.error("Failed to share file natively:", err);
      alert(err.message || "Native share failed.");
    }
  }, []);

  const handleShareMultipleFiles = useCallback(async (filesToShare: DocFile[]) => {
    try {
      await directShareMultipleFiles(filesToShare);
    } catch (err: any) {
      console.error("Failed to share files natively:", err);
      alert(err.message || "Native share failed.");
    }
  }, []);

  const handleScanComplete = useCallback(async (newFile: DocFile) => {
    await loadFiles();
    if (homeContainerRef.current) {
      homeContainerRef.current.scrollTop = 0;
    }
    setActiveTab('home');
  }, [loadFiles]);

  const handleFileClick = useCallback((file: DocFile) => {
    const currentTab = activeTabRef.current;
    const container = getActiveScrollContainer(currentTab);
    const currentScroll = container ? container.scrollTop : 0;
    fileReturnScrollRef.current = { tab: currentTab, top: currentScroll };
    setSelectedFile(file);
  }, [getActiveScrollContainer]);

  const openDoc = (file: DocFile) => {
    isOpeningDocRef.current = true;
    setSelectedFile(null);
    // Show interstitial ad before opening/viewing document
    adService.showInterstitial(async () => {
      setViewingDoc(file);
      isOpeningDocRef.current = false;
      const updatedFile = { ...file, lastOpenedAt: Date.now() };
      await storageService.saveFile(updatedFile);
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

  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleOpenQRScanner = useCallback(() => setShowQRScanner(true), []);
  const handleOpenCompressor = useCallback(() => requirePremiumOrAd(() => setShowCompressor(true)), [requirePremiumOrAd]);
  const handleOpenMerge = useCallback(() => requirePremiumOrAd(() => setShowMerge(true)), [requirePremiumOrAd]);
  const handleOpenSplit = useCallback(() => requirePremiumOrAd(() => setShowSplit(true)), [requirePremiumOrAd]);
  const handleToolActionSelect = useCallback((action: string) => {
    requirePremiumOrAd(() => {
      if (action === 'merge-pdf') setShowMerge(true);
      else if (action === 'split-pdf') setShowSplit(true);
      else setActiveToolAction(action);
    });
  }, [requirePremiumOrAd]);
  const handleRefresh = useCallback(() => {
    handleAutoScan();
  }, []);
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredFiles = useMemo(() => {
    if (activeCategory === 'All') return files;
    const mapping: Record<string, string> = {
      'PDF': 'pdf',
      'EXCEL': 'xlsx',
      'DOC': 'doc',
      'PPT': 'ppt',
      'EPUB': 'epub',
      'IMAGES': 'image'
    };
    return files.filter(file => file.type === mapping[activeCategory]);
  }, [files, activeCategory]);



  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-neutral-900 max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* App Opening Startup Splash Screen */}
      <AnimatePresence>
        {showAppSplash && (
          <motion.div
            key="startup-splash-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 select-none"
          >
            {/* Center Content: Logo + App Name */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative">
                <img
                  src="./app_logo.png"
                  alt="PDFO Reader & Converter"
                  className="w-28 h-28 object-contain"
                />
              </div>

              <div className="mt-6 flex flex-col items-center text-center">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 font-display">
                  <span className="text-red-600">PDFO</span>{' '}
                  <span className="text-neutral-900">Reader &amp; Converter</span>
                </h1>
                <p className="text-xs sm:text-sm font-medium text-neutral-400 mt-2 tracking-wide">
                  All-in-One Document Reader &amp; Tools
                </p>
                {/* Three Dots Loading Animation */}
                <div className="splash-dots mt-6">
                  <span className="splash-dot" />
                  <span className="splash-dot" />
                  <span className="splash-dot" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        className="h-[100dvh] min-h-[100dvh] w-full relative overflow-hidden"
      >
        <input
          id="device-scanner"
          type="file"
          multiple
          className="hidden"
          accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.ppt,application/vnd.ms-powerpoint,.epub,application/epub+zip,image/*"
          onChange={handleSyncComplete}
        />
        
        {/* Home Tab Panel */}
        <div
          ref={homeContainerRef}
          className={cn(
            "absolute inset-0 h-full w-full overflow-y-auto no-scrollbar",
            activeTab === 'home'
              ? "z-10 visible pointer-events-auto"
              : "-z-10 invisible pointer-events-none"
          )}
          style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <HomeTab
            files={files}
            recentFiles={recentFiles}
            searchQuery={searchQuery}
            isSearchFocused={isSearchFocused}
            onSearchChange={handleSearchChange}
            onSearchFocusChange={setIsSearchFocused}
            onCancelSearch={handleCancelSearch}
            onOpenSettings={handleOpenSettings}
            onOpenQRScanner={handleOpenQRScanner}
            onOpenCompressor={handleOpenCompressor}
            onOpenMerge={handleOpenMerge}
            onOpenSplit={handleOpenSplit}
            onFileClick={handleFileClick}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onShareFile={handleShareFile}
            onShareFiles={handleShareMultipleFiles}
            onDownloadFile={handleDownloadFile}
            language={selectedLanguage}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Files Tab Panel */}
        <div
          ref={filesContainerRef}
          className={cn(
            "absolute inset-0 h-full w-full overflow-y-auto no-scrollbar",
            activeTab === 'files'
              ? "z-10 visible pointer-events-auto"
              : "-z-10 invisible pointer-events-none"
          )}
          style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <FilesTab
            files={filteredFiles}
            activeCategory={activeCategory}
            onSelectCategory={handleCategorySelect}
            onFileClick={handleFileClick}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onShareFile={handleShareFile}
            onShareFiles={handleShareMultipleFiles}
            onDownloadFile={handleDownloadFile}
            language={selectedLanguage}
            onRefresh={handleRefresh}
            onTouchStart={handleFilesTouchStart}
            onTouchMove={handleFilesTouchMove}
            onTouchEnd={handleFilesTouchEnd}
          />
        </div>

        {/* Recent Tab Panel */}
        <div
          ref={recentContainerRef}
          className={cn(
            "absolute inset-0 h-full w-full overflow-y-auto no-scrollbar",
            activeTab === 'recent'
              ? "z-10 visible pointer-events-auto"
              : "-z-10 invisible pointer-events-none"
          )}
          style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <RecentTab
            files={recentFiles}
            onFileClick={handleFileClick}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onShareFile={handleShareFile}
            onShareFiles={handleShareMultipleFiles}
            onDownloadFile={handleDownloadFile}
            language={selectedLanguage}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Tools Tab Panel */}
        <div
          ref={toolsContainerRef}
          className={cn(
            "absolute inset-0 h-full w-full overflow-y-auto no-scrollbar",
            activeTab === 'tools'
              ? "z-10 visible pointer-events-auto"
              : "-z-10 invisible pointer-events-none"
          )}
          style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
        >
          <ToolsView
            language={selectedLanguage}
            onSelectAction={handleToolActionSelect}
            onBack={() => setActiveTab('home')}
          />
        </div>
      </main>

      {/* Scan View / Camera Fullscreen (hidden navigation, clean full viewport) */}
      {activeTab === 'scan' && (
        <Suspense fallback={<ViewSuspenseFallback />}>
          <div className="fixed inset-0 z-50">
            <ScanView onComplete={handleScanComplete} onCancel={() => setActiveTab('home')} requirePremiumOrAd={requirePremiumOrAd} adBannerHeight={adBannerHeight} />
          </div>
        </Suspense>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[60] bg-white/75 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center border border-neutral-100/80">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" strokeWidth={2.5} />
          </div>
          <h3 className="mt-6 text-lg font-display font-bold text-neutral-900 tracking-tight">Scanning Storage</h3>
          <p className="mt-2 text-xs text-neutral-500 font-medium max-w-[220px]">Searching internal memory for documents...</p>
        </div>
      )}

      {/* Bottom Navigation (shifted dynamically when AdMob banner is active) - Hidden when in tools, camera/scan view, active tools, search active, or keyboard is open */}
      {activeTab !== 'scan' && activeTab !== 'tools' && !activeToolAction && !showCompressor && !showMerge && !showSplit && !isKeyboardOpen && !isSearchFocused && !searchQuery.trim() && (
        <div 
          className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[380px] z-40 transition-all duration-300 ease-out"
          style={{ bottom: adBannerHeight > 0 ? `${adBannerHeight + 16}px` : '1.5rem' }}
        >
          <nav className="bg-white/90 backdrop-blur-xl border border-neutral-200/60 rounded-[32px] px-6 py-4 flex justify-between items-center shadow-2xl shadow-neutral-200/50">
            <NavButton tab="home" active={activeTab === 'home'} onSelect={handleTabClick} icon={<Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} label={t('home')} />
            <NavButton tab="files" active={activeTab === 'files'} onSelect={handleTabClick} icon={<Files size={24} strokeWidth={activeTab === 'files' ? 2.5 : 2} />} label={t('files')} />

            <button
              onClick={() => handleTabClick('scan')}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 -mt-10 border-[6px] border-[#FAFAFA] active:scale-90 transition-all hover:bg-red-600"
            >
              <Camera size={26} strokeWidth={2.5} />
            </button>

            <NavButton tab="recent" active={activeTab === 'recent'} onSelect={handleTabClick} icon={<Clock size={24} strokeWidth={activeTab === 'recent' ? 2.5 : 2} />} label={t('recent')} />
            <NavButton tab="tools" active={activeTab === 'tools'} onSelect={handleTabClick} icon={<Wrench size={24} strokeWidth={activeTab === 'tools' ? 2.5 : 2} />} label={t('tools')} />
          </nav>
        </div>
      )}

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
          <Suspense fallback={<ViewSuspenseFallback />}>
            <DocumentViewerModal
              file={viewingDoc}
              onClose={() => { setViewingDoc(null); }}
              language={selectedLanguage}
              files={getCurrentFilesList()}
              onFileChange={handleViewingDocChange}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showQRScanner && (
          <Suspense fallback={<ViewSuspenseFallback />}>
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
          </Suspense>
        )}
      </AnimatePresence>

      {/* Size Converter Modal */}
      <AnimatePresence>
        {showCompressor && (
          <Suspense fallback={<ViewSuspenseFallback />}>
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
          </Suspense>
        )}
      </AnimatePresence>

      {/* Merge Modal */}
      <AnimatePresence>
        {showMerge && (
          <Suspense fallback={<ViewSuspenseFallback />}>
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
          </Suspense>
        )}
      </AnimatePresence>

      {/* Split Modal */}
      <AnimatePresence>
        {showSplit && (
          <Suspense fallback={<ViewSuspenseFallback />}>
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
          </Suspense>
        )}
      </AnimatePresence>

      {/* Generic Tool Modal */}
      <AnimatePresence>
        {activeToolAction && (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <GenericToolFeature
              toolId={activeToolAction}
              language={selectedLanguage}
              onClose={() => {
                setActiveToolAction(null);
                loadFiles();
              }}
            />
          </Suspense>
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
                <p className="text-[10px] font-medium text-neutral-300">© 2026 PDFO Reader &amp; Converter</p>
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
                {activeSettingsModal === 'language' && t('language')}
                {activeSettingsModal === 'feedback' && t('feedback')}
                {activeSettingsModal === 'rate' && t('rateUs')}
                {activeSettingsModal === 'privacy' && t('privacyPolicy')}
              </h3>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">

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
                </div>
              )}

              {activeSettingsModal === 'privacy' && (
                <div className="bg-white p-6 rounded-[24px] border border-neutral-200/60 shadow-sm space-y-4 text-neutral-600 leading-relaxed">
                  <p>{t('dataCollection')}</p>
                  <p>{t('fileSecurity')}</p>
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
          <Suspense fallback={<ViewSuspenseFallback />}>
            <AdPlayerModal
              onComplete={() => {
                adCallback.run();
                setAdCallback(null);
              }}
              onClose={() => {
                isOpeningDocRef.current = false;
                setAdCallback(null);
              }}
            />
          </Suspense>
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

const NavButton = React.memo(function NavButton({ tab, active, onSelect, icon, label }: { tab: TabType, active: boolean, onSelect: (tab: TabType) => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={() => onSelect(tab)}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-150 select-none active:scale-90",
        active ? "text-red-500 scale-105" : "text-neutral-400 hover:text-neutral-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
});

interface HomeTabProps {
  files: DocFile[];
  recentFiles: DocFile[];
  searchQuery: string;
  isSearchFocused?: boolean;
  onSearchChange: (query: string) => void;
  onSearchFocusChange?: (focused: boolean) => void;
  onCancelSearch?: () => void;
  onOpenSettings: () => void;
  onOpenQRScanner: () => void;
  onOpenCompressor: () => void;
  onOpenMerge: () => void;
  onOpenSplit: () => void;
  onFileClick: (file: DocFile) => void;
  onRenameFile: (id: string, newName: string) => void;
  onDeleteFile: (id: string) => void;
  onShareFile: (file: DocFile) => void;
  onShareFiles: (files: DocFile[]) => void;
  onDownloadFile: (file: DocFile) => void;
  language: string;
  onRefresh: () => void;
}

const HomeTab = React.memo(function HomeTab({
  files,
  recentFiles,
  searchQuery,
  isSearchFocused,
  onSearchChange,
  onSearchFocusChange,
  onCancelSearch,
  onOpenSettings,
  onOpenQRScanner,
  onOpenCompressor,
  onOpenMerge,
  onOpenSplit,
  onFileClick,
  onRenameFile,
  onDeleteFile,
  onShareFile,
  onShareFiles,
  onDownloadFile,
  language,
  onRefresh
}: HomeTabProps) {
  const t = getTranslator(language);
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  return (
    <div className="space-y-8 pb-32 pt-10">
      <header className="flex justify-between items-center px-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">{t('pdfReader')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenSettings}
            className="w-12 h-12 rounded-full bg-white border border-neutral-200/60 shadow-sm flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors active:scale-95"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      <div className="px-6 relative z-50">
        <div className="relative group w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => onSearchFocusChange?.(true)}
            onBlur={() => {
              if (!searchQuery.trim()) {
                onSearchFocusChange?.(false);
              }
            }}
            className="w-full bg-white border border-neutral-200/60 shadow-sm rounded-full py-4 pl-14 pr-12 text-sm font-medium focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onCancelSearch?.();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {searchQuery && (
          <div className="absolute top-full left-6 right-6 mt-2 bg-white border border-neutral-200 shadow-xl rounded-2xl max-h-60 overflow-y-auto z-50">
            {searchResults.length > 0 ? (
              searchResults.map(file => (
                <button
                  key={file.id}
                  onClick={() => {
                    onFileClick(file);
                    onCancelSearch?.();
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

      <div className="grid grid-cols-4 gap-4 px-6">
        <button
          onClick={onOpenQRScanner}
          className="flex flex-col items-center gap-3 group active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-red-500 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-red-200 transition-all duration-300">
            <QrCode size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-tight uppercase whitespace-nowrap">{t('qrScanner')}</span>
        </button>

        <button
          onClick={onOpenCompressor}
          className="flex flex-col items-center gap-3 group active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-neutral-900 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-neutral-300 transition-all duration-300">
            <Minimize2 size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-wide uppercase">{t('compress')}</span>
        </button>

        <button
          onClick={onOpenMerge}
          className="flex flex-col items-center gap-3 group active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-indigo-200 transition-all duration-300">
            <Merge size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-wide uppercase">{t('merge')}</span>
        </button>

        <button
          onClick={onOpenSplit}
          className="flex flex-col items-center gap-3 group active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 bg-white border border-neutral-200/60 rounded-[24px] flex items-center justify-center text-orange-500 shadow-sm group-hover:scale-105 group-hover:shadow-md group-hover:border-orange-200 transition-all duration-300">
            <Scissors size={28} strokeWidth={1.5} />
          </div>
          <span className="text-[11px] font-bold text-neutral-600 tracking-wide uppercase">{t('split')}</span>
        </button>
      </div>

      <FileList
        title={files.length > 0 ? "Your Documents" : "Recent Documents"}
        files={files.length > 0 ? files : recentFiles}
        onFileClick={onFileClick}
        onRenameFile={onRenameFile}
        onDeleteFile={onDeleteFile}
        onShareFile={onShareFile}
        onShareFiles={onShareFiles}
        onDownloadFile={onDownloadFile}
        language={language}
        onRefresh={onRefresh}
      />
    </div>
  );
});

interface FilesTabProps {
  files: DocFile[];
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  onFileClick: (file: DocFile) => void;
  onRenameFile: (id: string, newName: string) => void;
  onDeleteFile: (id: string) => void;
  onShareFile: (file: DocFile) => void;
  onShareFiles: (files: DocFile[]) => void;
  onDownloadFile: (file: DocFile) => void;
  language: string;
  onRefresh: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
}

const FilesTab = React.memo(function FilesTab({
  files,
  activeCategory,
  onSelectCategory,
  onFileClick,
  onRenameFile,
  onDeleteFile,
  onShareFile,
  onShareFiles,
  onDownloadFile,
  language,
  onRefresh,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}: FilesTabProps) {
  const t = getTranslator(language);

  return (
    <div 
      className="space-y-6 pb-32 pt-10"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex justify-between items-center px-6">
        <h2 className="text-3xl font-display font-bold tracking-tight">{t('allFiles')}</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 px-6 no-scrollbar">
        {['All', 'PDF', 'EXCEL', 'DOC', 'PPT', 'EPUB', 'IMAGES'].map(cat => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 active:scale-95",
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
        files={files}
        onFileClick={onFileClick}
        onRenameFile={onRenameFile}
        onDeleteFile={onDeleteFile}
        onShareFile={onShareFile}
        onShareFiles={onShareFiles}
        onDownloadFile={onDownloadFile}
        language={language}
        onRefresh={onRefresh}
      />
    </div>
  );
});

interface RecentTabProps {
  files: DocFile[];
  onFileClick: (file: DocFile) => void;
  onRenameFile: (id: string, newName: string) => void;
  onDeleteFile: (id: string) => void;
  onShareFile: (file: DocFile) => void;
  onShareFiles: (files: DocFile[]) => void;
  onDownloadFile: (file: DocFile) => void;
  language: string;
  onRefresh: () => void;
}

const RecentTab = React.memo(function RecentTab({
  files,
  onFileClick,
  onRenameFile,
  onDeleteFile,
  onShareFile,
  onShareFiles,
  onDownloadFile,
  language,
  onRefresh
}: RecentTabProps) {
  const t = getTranslator(language);

  return (
    <div className="space-y-6 pb-32 pt-10">
      <h2 className="text-3xl font-display font-bold px-6 tracking-tight">{t('recentlyOpened')}</h2>
      <FileList
        files={files}
        onFileClick={onFileClick}
        onRenameFile={onRenameFile}
        onDeleteFile={onDeleteFile}
        onShareFile={onShareFile}
        onShareFiles={onShareFiles}
        onDownloadFile={onDownloadFile}
        language={language}
        onRefresh={onRefresh}
      />
    </div>
  );
});
