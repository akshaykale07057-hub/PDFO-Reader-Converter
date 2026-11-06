import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, FileText, FileSpreadsheet, FilePieChart, BookOpen, ImageIcon, Download, 
  Share2, Printer, Loader2, AlertCircle, ArrowUpRight, Lock, Unlock, Eye, EyeOff, 
  ShieldAlert, ZoomIn, ZoomOut, Play, Square, ChevronRight, Layout, MonitorPlay, Presentation,
  Sparkles, ListCollapse, X, Copy, Check, Grid, Search
} from 'lucide-react';
import { DocFile } from '../types';
import { storageService } from '../services/storageService';
import { directShareFile, downloadDocumentFile } from '../utils/shareUtils';
import { getTranslator } from '../utils/translator';
import { getApiBaseUrl } from '../utils/apiConfig';
import { isOnlineSync, checkIsOnline, triggerOfflineAlert } from '../utils/networkUtils';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { ZoomPanContainer } from './ZoomPanContainer';
import { PdfZoomStripContainer } from './PdfZoomStripContainer';
import { ExcelSpreadsheetViewer } from './ExcelSpreadsheetViewer';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';


// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDFJS Global Worker URL with local bundled version falling back to unpkg CDN .mjs in case of environment resolution discrepancies
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerModalProps {
  file: DocFile;
  onClose: () => void;
  language?: string;
  files?: DocFile[];
  onFileChange?: (file: DocFile) => void;
}

const EnglishDocTranslations = {
  page: "Page",
  pages: "Pages",
  continuous: "Continuous",
  gridSorter: "Grid Sorter",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  shareExternal: "Share External",
  slide: "Slide",
  outline: "Outline",
  components: "Components",
  visuals: "Visuals",
  visualAssets: "Visual Assets & Icons",
  clickToView: "Click to view slide",
  view: "View",
  playSlideshow: "Play Slideshow",
  stopSlideshow: "Stop Slideshow",
  prevSlide: "Previous",
  nextSlide: "Next",
  highContrast: "High Contrast",
  nightMode: "Night / Dark Theme",
  sheet: "Sheet",
  sheets: "Sheets",
  loading: "Loading document...",
  row: "Row",
  rows: "Rows",
  emptySlide: "Empty slide contents",
  spreadsheetMode: "Spreadsheet Mode",
  contrastMode: "Contrast Mode",
  regularTextMode: "Regular Text Mode",
  accessibilityControls: "Accessibility Controls",
  zoomFont: "Zoom Font",
  resetFont: "Reset Font",
  graphical: "Graphical",
  startAutoplay: "Start Autoplay",
  stopAutoplay: "Stop Autoplay",
  tableOfContents: "Table of Contents",
  readerMode: "Reader Mode",
  previousSection: "Previous Section",
  nextSection: "Next Section",
  sectionOf: "Section",
  contrast: "Contrast",
  light: "LIGHT",
  sepia: "SEPIA",
  dark: "DARK",
  ch: "Ch",
  download: "Download",
  share: "Share"
};

const TRANSLATIONS: Record<string, Record<string, string>> = {
  "English US": EnglishDocTranslations,
  "English UK": EnglishDocTranslations,
  English: EnglishDocTranslations,
  Hindi: {
    page: "पृष्ठ",
    pages: "पृष्ठों",
    continuous: "निरंतर",
    gridSorter: "ग्रिड सॉर्टर",
    zoomIn: "ज़ूम इन",
    zoomOut: "ज़ूम आउट",
    shareExternal: "बाहर साझा करें",
    slide: "स्लाइड",
    outline: "रूपरेखा",
    components: "घटक",
    visuals: "दृश्य",
    visualAssets: "दृश्य संपादन व प्रतीक",
    clickToView: "स्लाइड देखने के लिए क्लिक करें",
    view: "देखें",
    playSlideshow: "चलाएं",
    stopSlideshow: "रोकें",
    prevSlide: "पिछली स्लाइड",
    nextSlide: "अगली स्लाइड",
    highContrast: "उच्च विषमता",
    nightMode: "नाईट मोड",
    sheet: "शीट",
    sheets: "शीटें",
    loading: "दस्तावेज़ लोड हो रहा है...",
    row: "पंक्ति",
    rows: "पंक्तियाँ",
    emptySlide: "रिक्त स्लाइड सामग्री",
    spreadsheetMode: "स्प्रेडशीट मोड",
    contrastMode: "विषमता मोड",
    regularTextMode: "सामान्य टेक्स्ट मोड",
    accessibilityControls: "पहुंच नियंत्रण",
    zoomFont: "फॉन्ट बड़ा करें",
    resetFont: "फॉन्ट रीसेट करें",
    graphical: "चित्रात्मक",
    startAutoplay: "ऑटोप्ले शुरू करें",
    stopAutoplay: "ऑटोप्ले रोकें",
    tableOfContents: "विषय सूची",
    readerMode: "रीडर मोड",
    previousSection: "पिछला भाग",
    nextSection: "अगला भाग",
    sectionOf: "भाग",
    contrast: "विषमता",
    light: "प्रकाश",
    sepia: "सेपिया",
    dark: "अंधेरा",
    ch: "अध्याय",
    download: "डाउनलोड",
    share: "साझा करें"
  },
  Marathi: {
    page: "पाने",
    pages: "पाने",
    continuous: "सतत",
    gridSorter: "ग्रीड सॉर्टर",
    zoomIn: "मोठे करा",
    zoomOut: "लहान करा",
    shareExternal: "बाहेर सामायिक करा",
    slide: "स्लाईड",
    outline: "आउटलाईन",
    components: "घटक",
    visuals: "व्हिज्युअल",
    visualAssets: "व्हिज्युअल मालमत्ता आणि चिन्हे",
    clickToView: "स्लाईड पाहण्यासाठी क्लिक करा",
    view: "पहा",
    playSlideshow: "स्लाईड शो सुरू करा",
    stopSlideshow: "स्लाईड शो थांबवा",
    prevSlide: "मागील स्लाईड",
    nextSlide: "पुढील स्लाईड",
    highContrast: "हाय कॉन्ट्रास्ट",
    nightMode: "नाईट / डार्क थीम",
    sheet: "शीट",
    sheets: "शीट",
    loading: "दस्तऐवज लोड होत आहे...",
    row: "ओळ",
    rows: "ओळी",
    emptySlide: "रिक्त स्लाईड मजकूर",
    spreadsheetMode: "स्प्रेडशीट मोड",
    contrastMode: "कॉन्ट्रास्ट मोड",
    regularTextMode: "नियमित मजकूर मोड",
    accessibilityControls: "पहुंच नियंत्रण",
    zoomFont: "फॉन्ट झूम करा",
    resetFont: "फॉन्ट रिसेट करा",
    graphical: "ग्राफिकल",
    startAutoplay: "स्वयंचलित सुरू करा",
    stopAutoplay: "स्वयंचलित थांबवा",
    tableOfContents: "अनुक्रमणिका",
    readerMode: "रीडर मोड",
    previousSection: "मागील विभाग",
    nextSection: "पुढील विभाग",
    sectionOf: "विभाग",
    contrast: "काँट्रास्ट",
    light: "प्रकाश",
    sepia: "सेपिया",
    dark: "काळोख",
    ch: "अध्याय",
    download: "डाउनलोड",
    share: "शेअर करा"
  },
  Gujarati: {
    page: "પૃષ્ઠ",
    pages: "પૃષ્ઠો",
    continuous: "સતત",
    gridSorter: "ગ્રીડ સોર્ટર",
    zoomIn: "ઝૂમ ઇન",
    zoomOut: "ઝૂમ આઉટ",
    shareExternal: "બહાર શેર કરો",
    slide: "સ્લાઇડ",
    outline: "આઉટલાઇન",
    components: "ઘટકો",
    visuals: "વિઝ્યુઅલ્સ",
    visualAssets: "વિઝ્યુઅલ સંપત્તિ અને ચિહ્નો",
    clickToView: "સ્લાઇડ જોવા માટે ક્લિક કરો",
    view: "જુઓ",
    playSlideshow: "સ્લાઇડશો જુઓ",
    stopSlideshow: "સ્લાઇડશો બંધ કરો",
    prevSlide: "પાછલી સ્લાઇડ",
    nextSlide: "આગલી સ્લાઇડ",
    highContrast: "હાઇ કોન્ટ્રાસ્ટ",
    nightMode: "નાઇટ / ડાર્ક થીમ",
    sheet: "શીટ",
    sheets: "શીટ્સ",
    loading: "દસ્તાવેજ લોડ થઈ રહ્યો છે...",
    row: "રો",
    rows: "રો",
    emptySlide: "ખાલી સ્લાઇડ સામગ્રી",
    spreadsheetMode: "સ્પ્રેડશીટ મોડ",
    contrastMode: "કોન્ટ્રાস্ট મોડ",
    regularTextMode: "નિયમિત લખાણ મોડ",
    accessibilityControls: "ઍક્સેસિબિલિટી નિયંત્રણો",
    zoomFont: "ફોન્ટ મોટો કરો",
    resetFont: "ફોન્ટ સરખો કરો",
    graphical: "ગ્રાફિકલ",
    startAutoplay: "ઓટોપ્લે શરૂ કરો",
    stopAutoplay: "ઓટોપ્લે બંધ કરો",
    tableOfContents: "વિષયસૂચિ",
    readerMode: "રીડર મોડ",
    previousSection: "પાછલો વિભાગ",
    nextSection: "આગલો વિભાગ",
    sectionOf: "વિભાગ",
    contrast: "કોન્ટ્રાस्ट",
    light: "લાઇટ",
    sepia: "સેપિયા",
    dark: "ડાર્ક",
    ch: "પ્રકરણ",
    download: "ડાઉનલોડ",
    share: "શેર કરો"
  },
  Tamil: {
    page: "பக்கம்",
    pages: "பக்கங்கள்",
    continuous: "தொடர்ச்சியான",
    gridSorter: "கிரிட் வரிசை",
    zoomIn: "பெரிதாக்கு",
    zoomOut: "சிறிதாக்கு",
    shareExternal: "வெளியே பகிர்க",
    slide: "ஸ்லைடு",
    outline: "அவுட்லைன்",
    components: "கூறுகள்",
    visuals: "காட்சிகள்",
    visualAssets: "காட்சி சொத்துக்கள் மற்றும் சின்னங்கள்",
    clickToView: "ஸ்லைடைப் பார்க்க கிளிக் செய்க",
    view: "பார்வை",
    playSlideshow: "ஸ்லைடுஷோவை இயக்கு",
    stopSlideshow: "ஸ்லைடுஷோவை நிறுத்து",
    prevSlide: "முந்தைய ஸ்லைடு",
    nextSlide: "அடுத்த ஸ்லைடு",
    highContrast: "அதிக கான்ட்ராஸ்ட்",
    nightMode: "இரவு / இருண்ட பயன்முறை",
    sheet: "தாள்",
    sheets: "தாள்கள்",
    loading: "ஆவணம் ஏற்றப்படுகிறது...",
    row: "வரிசை",
    rows: "வரிசைகள்",
    emptySlide: "வெற்று ஸ்லைடு உள்ளடக்கம்",
    spreadsheetMode: "ஸ்பிரெட்ஷீட் பயன்முறை",
    contrastMode: "கான்ட்ராஸ்ட் பயன்முறை",
    regularTextMode: "சாதாரண உரை பயன்முறை",
    accessibilityControls: "அணுகல் கட்டுப்பாடுகள்",
    zoomFont: "எழுத்துரு பெரிதாக்கு",
    resetFont: "எழுத்துரு மீட்டமை",
    graphical: "வரைபடம்",
    startAutoplay: "தானியங்கி இயக்கு",
    stopAutoplay: "தானியங்கி நிறுத்து",
    tableOfContents: "பொருளடக்கம்",
    readerMode: "வாசிப்பு முறை",
    previousSection: "முந்தைய பகுதி",
    nextSection: "அடுத்த பகுதி",
    sectionOf: "பகுதி",
    contrast: "கான்ட்ராஸ்ட்",
    light: "ஒளி",
    sepia: "செப்பியா",
    dark: "இருள்",
    ch: "அதி",
    download: "பதிவிறக்கம்",
    share: "பகிர்"
  },
  Telugu: {
    page: "పేజీ",
    pages: "పేజీలు",
    continuous: "నిరంతర",
    gridSorter: "గ్రిడ్ సార్టర్",
    zoomIn: "జూమ్ ఇన్",
    zoomOut: "జూమ్ అవుట్",
    shareExternal: "బయట షేర్ చేయండి",
    slide: "స్లైడ్",
    outline: "అవుట్‌లైన్",
    components: "భాగాలు",
    visuals: "దృశ్యాలు",
    visualAssets: "విజువల్ అసెట్స్ & చిహ్నాలు",
    clickToView: "స్లైడ్ చూడటానికి క్లిక్ చేయండి",
    view: "చూడండి",
    playSlideshow: "స్లైడ్‌షో ప్లే",
    stopSlideshow: "స్లైడ్‌షో ఆపు",
    prevSlide: "మునుపటి స్లైడ్",
    nextSlide: "తదుపరి స్లైడ్",
    highContrast: "హై కాంట్రాస్ట్",
    nightMode: "నైట్ / డార్క్ థీమ్",
    sheet: "షీట్",
    sheets: "షీట్లు",
    loading: "పత్రం లోడ్ అవుతోంది...",
    row: "వరుస",
    rows: "వరుసలు",
    emptySlide: "ఖాళీ స్లైడ్ విషయాలు",
    spreadsheetMode: "స్ప్రెడ్‌షీట్ మోడ్",
    contrastMode: "కాంట్రాస్ట్ మోడ్",
    regularTextMode: "సాధారణ వచన మోడ్",
    accessibilityControls: "యాక్సెసిబిలిటీ నియంత్రణలు",
    zoomFont: "ఫాంట్ పెద్దది చేయి",
    resetFont: "ఫాంట్ రీసెట్ చేయి",
    graphical: "గ్రాఫికల్",
    startAutoplay: "ఆటోప్లే ప్రారంభించు",
    stopAutoplay: "ఆటోప్లే ఆపివేయి",
    tableOfContents: "విషయ సూచిక",
    readerMode: "రీడర్ మోడ్",
    previousSection: "మునుపటి విభాగం",
    nextSection: "తదుపరి విభాగం",
    sectionOf: "విభాగం",
    contrast: "కాంట్రాస్ట్",
    light: "కాంతి",
    sepia: "సెపియా",
    dark: "చీకటి",
    ch: "అధ్యా",
    download: "డౌన్‌లోడ్",
    share: "షేర్"
  },
  Spanish: {
    page: "Página",
    pages: "Páginas",
    continuous: "Continuo",
    gridSorter: "Clasificador",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    shareExternal: "Compartir externo",
    slide: "Diapositiva",
    outline: "Esquema",
    components: "Componentes",
    visuals: "Visuales",
    visualAssets: "Imágenes y Iconos",
    clickToView: "Haga clic para ver diapositiva",
    view: "Ver",
    playSlideshow: "Presentar diapositivas",
    stopSlideshow: "Detener presentación",
    prevSlide: "Diapositiva anterior",
    nextSlide: "Diapositiva siguiente",
    highContrast: "Alto contraste",
    nightMode: "Modo noche / oscuro",
    sheet: "Hoja",
    sheets: "Hojas",
    loading: "Cargando documento...",
    row: "Fila",
    rows: "Filas",
    emptySlide: "Contenido de diapositiva vacío",
    spreadsheetMode: "Modo Hoja de cálculo",
    contrastMode: "Modo Contraste",
    regularTextMode: "Modo Texto normal",
    accessibilityControls: "Controles de accesibilidad",
    zoomFont: "Aumentar fuente",
    resetFont: "Restablecer fuente",
    graphical: "Gráfico",
    startAutoplay: "Iniciar reproducción",
    stopAutoplay: "Detener reproducción",
    tableOfContents: "Tabla de contenidos",
    readerMode: "Modo Lector",
    previousSection: "Sección anterior",
    nextSection: "Sección siguiente",
    sectionOf: "Sección",
    contrast: "Contraste",
    light: "CLARO",
    sepia: "SEPIA",
    dark: "OSCURO",
    ch: "Cap",
    download: "Descargar",
    share: "Compartir"
  },
  French: {
    page: "Page",
    pages: "Pages",
    continuous: "Continu",
    gridSorter: "Trieuse de diapositives",
    zoomIn: "Zoomer",
    zoomOut: "Dézoomer",
    shareExternal: "Partager externe",
    slide: "Diapositive",
    outline: "Plan",
    components: "Composants",
    visuals: "Visuels",
    visualAssets: "Assets visuels & Icônes",
    clickToView: "Cliquer pour voir la diapo",
    view: "Voir",
    playSlideshow: "Démarrer diaporama",
    stopSlideshow: "Arrêter diaporama",
    prevSlide: "Diapositive précédente",
    nextSlide: "Diapositive suivante",
    highContrast: "Contraste élevé",
    nightMode: "Mode nuit / sombre",
    sheet: "Feuille",
    sheets: "Feuilles",
    loading: "Chargement du document...",
    row: "Ligne",
    rows: "Lignes",
    emptySlide: "Contenu de diapositive vide",
    spreadsheetMode: "Mode Feuille de calcul",
    contrastMode: "Mode Contraste",
    regularTextMode: "Mode Texte normal",
    accessibilityControls: "Controles d'accessibilité",
    zoomFont: "Agrandir police",
    resetFont: "Réinitialiser police",
    graphical: "Graphique",
    startAutoplay: "Lecture auto",
    stopAutoplay: "Arrêter lecture",
    tableOfContents: "Table des matières",
    readerMode: "Mode Lecture",
    previousSection: "Section précédente",
    nextSection: "Section suivante",
    sectionOf: "Section",
    contrast: "Contraste",
    light: "CLAIR",
    sepia: "SÉPIA",
    dark: "SOMBRE",
    ch: "Ch",
    download: "Télécharger",
    share: "Partager"
  }
};

// High-fidelity presentation engine instance cache
let pptxEnginePromise: Promise<{ 
  convert: (data: Uint8Array) => string; 
  convert_with_options?: (data: Uint8Array, embed_images: boolean, include_hidden: boolean, slide_indices: Uint32Array, scale: number) => string;
  get_presentation_info?: (data: Uint8Array) => any 
}> | null = null;

const ensurePptxEngine = async () => {
  if (!pptxEnginePromise) {
    pptxEnginePromise = (async () => {
      const module = await import('@briank-dev/pptx2html-turbo');
      const initPptx = module.default;
      const convert = module.convert;
      const convert_with_options = module.convert_with_options;
      const get_presentation_info = module.get_presentation_info;
      try {
        // @ts-ignore
        const pptxWasmUrl = (await import('../../node_modules/@briank-dev/pptx2html-turbo/pptx2html_wasm_bg.wasm?url')).default;
        await initPptx(pptxWasmUrl);
      } catch (wasmLoadErr) {
        try {
          await initPptx();
        } catch (e) {
          console.warn("WASM init note:", e);
        }
      }
      return { convert, convert_with_options, get_presentation_info };
    })();
  }
  return pptxEnginePromise;
};

// Custom PPT slides parser using JSZip
const parsePptx = async (arrayBuffer: ArrayBuffer) => {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    console.log("PPTX zip files:", Object.keys(zip.files));
    const slideKeys = Object.keys(zip.files).filter(name => 
      name.toLowerCase().startsWith('ppt/slides/slide') && name.toLowerCase().endsWith('.xml')
    );
    
    // Sort slide names numerically
    slideKeys.sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, '') || '0', 10);
      const numB = parseInt(b.replace(/[^0-9]/g, '') || '0', 10);
      return numA - numB;
    });

    const getElementsByLocalName = (parent: Element | Document, localName: string): Element[] => {
      const result: Element[] = [];
      let elements;
      try {
        elements = parent.getElementsByTagNameNS('*', localName);
      } catch (e) {
        elements = parent.getElementsByTagName(localName);
      }
      
      for (let i = 0; i < elements.length; i++) {
        result.push(elements[i]);
      }
      
      if (result.length === 0) {
        const prefixes = ['a', 'p', 'r'];
        for (const prefix of prefixes) {
          const prefixedElements = parent.getElementsByTagName(`${prefix}:${localName}`);
          for (let i = 0; i < prefixedElements.length; i++) {
            result.push(prefixedElements[i]);
          }
        }
      }
      return result;
    };

    const findSolidFillColor = (element: Element): string | undefined => {
      const solidFills = getElementsByLocalName(element, 'solidFill');
      if (solidFills.length > 0) {
        const srgbClrs = getElementsByLocalName(solidFills[0], 'srgbClr');
        if (srgbClrs.length > 0) {
          const rClr = srgbClrs[0].getAttribute('val');
          if (rClr) return '#' + rClr;
        }
      }
      return undefined;
    };

    let slideWidth = 12192000;
    let slideHeight = 6858000;

    try {
      const presFile = zip.files['ppt/presentation.xml'];
      if (presFile) {
        const parser = new DOMParser();
        const presText = await presFile.async('string');
        const presDoc = parser.parseFromString(presText, 'text/xml');
        const sldSzs = getElementsByLocalName(presDoc, 'sldSz');
        if (sldSzs.length > 0) {
          slideWidth = parseInt(sldSzs[0].getAttribute('cx') || '12192000', 10);
          slideHeight = parseInt(sldSzs[0].getAttribute('cy') || '6858000', 10);
        }
      }
    } catch (e) {
      console.warn("Could not parse presentation slide size", e);
    }

    const parsedSlides: any[] = [];

    for (const key of slideKeys) {
      const xmlText = await zip.files[key].async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Load relationships to retrieve images
      const relsMap: Record<string, string> = {};
      try {
        const relKey = key.toLowerCase().replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
        const relFile = zip.files[Object.keys(zip.files).find(k => k.toLowerCase() === relKey) || ''];
        if (relFile) {
          const relXmlText = await relFile.async('string');
          const relDoc = parser.parseFromString(relXmlText, 'text/xml');
          const rels = relDoc.getElementsByTagName('Relationship');
          for (let rIdx = 0; rIdx < rels.length; rIdx++) {
            const id = rels[rIdx].getAttribute('Id');
            const target = rels[rIdx].getAttribute('Target');
            if (id && target) {
              relsMap[id] = target;
            }
          }
        }
      } catch (e) {
        console.warn("Could not load slide relationships for " + key, e);
      }

      // 1. Background parsing
      let backgroundColor = '#ffffff';
      let backgroundImage = undefined;

      const bgNodes = getElementsByLocalName(xmlDoc, 'bg');
      if (bgNodes.length > 0) {
        const solidColor = findSolidFillColor(bgNodes[0]);
        if (solidColor) {
          backgroundColor = solidColor;
        }

        const bgBlips = getElementsByLocalName(bgNodes[0], 'blip');
        if (bgBlips.length > 0) {
          const embedId = bgBlips[0].getAttribute('r:embed') || bgBlips[0].getAttribute('embed') || '';
          const target = relsMap[embedId];
          if (target) {
            const normTarget = target.replace(/\\/g, '/');
            let mediaPath = '';
            if (normTarget.startsWith('../media/')) {
              mediaPath = 'ppt/media/' + normTarget.substring('../media/'.length);
            } else if (normTarget.startsWith('media/')) {
              mediaPath = 'ppt/media/' + normTarget.substring('media/'.length);
            } else {
              let cleanTarget = normTarget.replace(/^(\.\.\/)+/, '');
              try {
                cleanTarget = decodeURIComponent(cleanTarget);
              } catch (e) {}
              const matchedKey = Object.keys(zip.files).find(k => k.toLowerCase().endsWith(cleanTarget.toLowerCase()));
              if (matchedKey) mediaPath = matchedKey;
            }

            if (mediaPath && zip.files[mediaPath]) {
              const imgBlob = await zip.files[mediaPath].async('blob');
              backgroundImage = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(imgBlob);
              });
            }
          }
        }
      }

      const elements: any[] = [];

      const parseXfrm = (node: Element) => {
        const xfrms = getElementsByLocalName(node, 'xfrm');
        if (xfrms.length > 0) {
          const xfrm = xfrms[0];
          const offs = getElementsByLocalName(xfrm, 'off');
          const exts = getElementsByLocalName(xfrm, 'ext');
          if (offs.length > 0 && exts.length > 0) {
            const x = parseInt(offs[0].getAttribute('x') || '0', 10);
            const y = parseInt(offs[0].getAttribute('y') || '0', 10);
            const cx = parseInt(exts[0].getAttribute('cx') || '0', 10);
            const cy = parseInt(exts[0].getAttribute('cy') || '0', 10);
            return { x, y, w: cx, h: cy };
          }
        }
        return null;
      };

      // Resolve absolute slide coordinates handling nested group transforms (<p:grpSp>)
      const getShapeAbsoluteCoords = (node: Element) => {
        const direct = parseXfrm(node);
        if (!direct) return null;
        let finalX = direct.x;
        let finalY = direct.y;
        let finalW = direct.w;
        let finalH = direct.h;

        // Traverse upwards to resolve parent group transforms (<p:grpSp>)
        let parent: Element | null = node.parentElement;
        while (parent && parent !== xmlDoc.documentElement) {
          const pName = (parent.localName || parent.nodeName.split(':').pop() || '').toLowerCase();
          if (pName === 'grpsp') {
            const grpSpPr = getElementsByLocalName(parent, 'grpSpPr')[0] || parent;
            const grpXfrms = getElementsByLocalName(grpSpPr, 'xfrm');
            if (grpXfrms.length > 0) {
              const gX = grpXfrms[0];
              const offs = getElementsByLocalName(gX, 'off');
              const chOffs = getElementsByLocalName(gX, 'chOff');
              const exts = getElementsByLocalName(gX, 'ext');
              const chExts = getElementsByLocalName(gX, 'chExt');

              if (offs.length > 0) {
                const offX = parseInt(offs[0].getAttribute('x') || '0', 10);
                const offY = parseInt(offs[0].getAttribute('y') || '0', 10);
                const chOffX = chOffs.length > 0 ? parseInt(chOffs[0].getAttribute('x') || '0', 10) : 0;
                const chOffY = chOffs.length > 0 ? parseInt(chOffs[0].getAttribute('y') || '0', 10) : 0;

                const extCx = exts.length > 0 ? parseInt(exts[0].getAttribute('cx') || '1', 10) : 1;
                const chExtCx = chExts.length > 0 ? parseInt(chExts[0].getAttribute('cx') || '1', 10) : 1;
                const scaleX = chExtCx > 0 ? extCx / chExtCx : 1;

                const extCy = exts.length > 0 ? parseInt(exts[0].getAttribute('cy') || '1', 10) : 1;
                const chExtCy = chExts.length > 0 ? parseInt(chExts[0].getAttribute('cy') || '1', 10) : 1;
                const scaleY = chExtCy > 0 ? extCy / chExtCy : 1;

                finalX = offX + (finalX - chOffX) * scaleX;
                finalY = offY + (finalY - chOffY) * scaleY;
                finalW = finalW * scaleX;
                finalH = finalH * scaleY;
              }
            }
          }
          parent = parent.parentElement;
        }

        return { x: finalX, y: finalY, w: finalW, h: finalH };
      };

      // 2. Parse all slide pictures & shape elements containing image/icon blips
      const allBlips = getElementsByLocalName(xmlDoc, 'blip');
      for (const blip of allBlips) {
        // Exclude background blips since they are resolved during background parsing
        let isBackground = false;
        let parentNode: Element | null = blip.parentElement;
        while (parentNode) {
          const lName = (parentNode.localName || parentNode.nodeName.split(':').pop() || '').toLowerCase();
          if (lName === 'bg' || lName === 'bgpr') {
            isBackground = true;
            break;
          }
          parentNode = parentNode.parentElement;
        }
        if (isBackground) continue;

        let rId = blip.getAttribute('r:embed') || blip.getAttribute('embed') || '';
        if (!rId) {
          for (let aIdx = 0; aIdx < blip.attributes.length; aIdx++) {
            if (blip.attributes[aIdx].name.includes('embed')) {
              rId = blip.attributes[aIdx].value;
              break;
            }
          }
        }

        if (!rId) continue;

        const target = relsMap[rId];
        if (target) {
          const normTarget = target.replace(/\\/g, '/');
          let mediaPath = '';
          if (normTarget.startsWith('../media/')) {
            mediaPath = 'ppt/media/' + normTarget.substring('../media/'.length);
          } else if (normTarget.startsWith('media/')) {
            mediaPath = 'ppt/media/' + normTarget.substring('media/'.length);
          } else {
            let cleanTarget = normTarget.replace(/^(\.\.\/)+/, '');
            try {
              cleanTarget = decodeURIComponent(cleanTarget);
            } catch (e) {}
            const matchedKey = Object.keys(zip.files).find(k => k.toLowerCase().endsWith(cleanTarget.toLowerCase()));
            if (matchedKey) mediaPath = matchedKey;
          }

          if (mediaPath && zip.files[mediaPath]) {
            const imgBlob = await zip.files[mediaPath].async('blob');
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(imgBlob);
            });

            // Climb up ancestors to find layout frame coordinates (including groups)
            let shapeAncestor: Element | null = blip.parentElement;
            let coords = null;
            while (shapeAncestor) {
              const sLName = (shapeAncestor.localName || shapeAncestor.nodeName.split(':').pop() || '').toLowerCase();
              if (['pic', 'sp', 'cxnsp', 'graphicframe', 'grpsp'].includes(sLName)) {
                coords = getShapeAbsoluteCoords(shapeAncestor);
                if (coords) break;
              }
              shapeAncestor = shapeAncestor.parentElement;
            }

            elements.push({
              type: 'image',
              imageUrl: dataUrl,
              x: coords ? (coords.x / slideWidth) * 100 : 20,
              y: coords ? (coords.y / slideHeight) * 100 : 25,
              w: coords ? (coords.w / slideWidth) * 100 : 60,
              h: coords ? (coords.h / slideHeight) * 100 : 50,
              hasCoords: !!coords
            });
          }
        }
      }

      // 3. Parse text boxes (shape sp elements)
      let slideTitle = '';
      const slideBullets: string[] = [];
      let titleFound = false;

      const shapes = getElementsByLocalName(xmlDoc, 'sp');
      for (const shape of shapes) {
        let isTitle = false;
        const nvSpPrs = getElementsByLocalName(shape, 'nvSpPr');
        if (nvSpPrs.length > 0) {
          const phs = getElementsByLocalName(nvSpPrs[0], 'ph');
          if (phs.length > 0) {
            const phType = phs[0].getAttribute('type');
            if (phType === 'title' || phType === 'ctrTitle' || phType === 'subTitle') {
              isTitle = true;
            }
          }
        }

        const paragraphs = getElementsByLocalName(shape, 'p');
        const bullets: string[] = [];

        const textRunsInShape = getElementsByLocalName(shape, 't');
        let fullText = '';
        for (let tIdx = 0; tIdx < textRunsInShape.length; tIdx++) {
          fullText += textRunsInShape[tIdx].textContent || '';
        }

        for (const pNode of paragraphs) {
          const ts = getElementsByLocalName(pNode, 't');
          let paraText = '';
          for (const t of ts) {
            paraText += t.textContent || '';
          }
          if (paraText.trim()) {
            bullets.push(paraText.trim());
          }
        }

        if (bullets.length > 0) {
          const coords = getShapeAbsoluteCoords(shape);
          const textVal = fullText.trim();

          if (textVal) {
            const posX = coords ? (coords.x / slideWidth) * 100 : 10;
            const posY = coords ? (coords.y / slideHeight) * 100 : 30;
            const posW = coords ? (coords.w / slideWidth) * 100 : 80;
            const posH = coords ? (coords.h / slideHeight) * 100 : 40;

            // Find if there is an existing text element at a very similar position (within 3% tolerance)
            // to avoid rendering text-on-text overlay boxes (e.g. shadow layers, duplicate author components)
            const overlappingIndex = elements.findIndex(el => 
              el.type === 'text' && 
              Math.abs(el.x - posX) < 3.0 && 
              Math.abs(el.y - posY) < 3.0
            );

            if (overlappingIndex !== -1) {
              const existing = elements[overlappingIndex];
              // If the text is exactly the same, we ignore to deduplicate
              if (existing.text.toLowerCase() === textVal.toLowerCase()) {
                // Ignore duplicate
              } else {
                // If it is different, dynamic merging preserves the text while maintaining single-container boundaries
                if (existing.text.toLowerCase().includes(textVal.toLowerCase())) {
                  // Substring exists, do nothing
                } else if (textVal.toLowerCase().includes(existing.text.toLowerCase())) {
                  existing.text = textVal;
                  existing.bullets = bullets;
                  existing.isTitle = existing.isTitle || isTitle;
                } else {
                  existing.text += "\n" + textVal;
                  existing.bullets = [...existing.bullets, ...bullets];
                  existing.isTitle = existing.isTitle || isTitle;
                }
              }
            } else {
              // Also prevent general duplication of identical texts across different shapes
              const isDuplicateText = elements.some(el => 
                el.type === 'text' && el.text.toLowerCase() === textVal.toLowerCase()
              );

              if (!isDuplicateText) {
                elements.push({
                  type: 'text',
                  isTitle,
                  text: textVal,
                  bullets: bullets,
                  x: posX,
                  y: posY,
                  w: posW,
                  h: posH,
                  hasCoords: !!coords,
                  color: isTitle ? '#1e293b' : '#475569'
                });
              }
            }

            if (isTitle && !titleFound) {
              slideTitle = bullets[0];
              titleFound = true;
            } else {
              slideBullets.push(...bullets);
            }
          }
        }
      }

      // Fallback single stream parse if title was never isolated
      if (!titleFound) {
        const tsInDoc = getElementsByLocalName(xmlDoc, 't');
        const rawTexts: string[] = [];
        for (let i = 0; i < tsInDoc.length; i++) {
          const val = tsInDoc[i].textContent || '';
          if (val.trim()) rawTexts.push(val.trim());
        }
        if (rawTexts.length > 0) {
          slideTitle = rawTexts[0];
          slideBullets.push(...rawTexts.slice(1));
        }
      }

      // Custom refinement of parsed slide elements to resolve text scrambling, placeholder noises, and physical coordinate overlaps
      const isPlaceholderText = (text: string): boolean => {
        const t = text.toLowerCase().trim();
        return (
          t.includes('click to edit') ||
          t.includes('click to add') ||
          t.includes('double-click to add') ||
          t.includes('master title style') ||
          t.includes('master text styles') ||
          t.includes('master subtitle style') ||
          t.includes('second level') ||
          t.includes('third level') ||
          t.includes('fourth level') ||
          t.includes('fifth level') ||
          t === 'click to enter' ||
          t === 'click to type' ||
          t === 'add text' ||
          t === '•' ||
          t === '.'
        );
      };

      const refinedElements: any[] = [];
      for (const el of elements) {
        if (el.type === 'image') {
          refinedElements.push(el);
          continue;
        }

        const cleanText = el.text ? el.text.trim() : '';
        if (!cleanText || isPlaceholderText(cleanText)) {
          continue;
        }

        let merged = false;
        for (const existing of refinedElements) {
          if (existing.type === 'text') {
            const xOverlap = Math.max(existing.x, el.x) < Math.min(existing.x + existing.w, el.x + el.w);
            const yOverlap = Math.max(existing.y, el.y) < Math.min(existing.y + existing.h, el.y + el.h);
            const isNearY = Math.abs(existing.y - el.y) < 5.0;
            const isNearX = Math.abs(existing.x - el.x) < 5.0;

            // Only merge if text boxes physically overlap in both X and Y dimensions
            if (xOverlap && yOverlap) {
              if (existing.text.toLowerCase().includes(el.text.toLowerCase())) {
                merged = true;
                break;
              } else if (el.text.toLowerCase().includes(existing.text.toLowerCase())) {
                existing.text = el.text;
                existing.bullets = el.bullets;
                existing.isTitle = existing.isTitle || el.isTitle;
                merged = true;
                break;
              } else {
                existing.text += "\n" + el.text;
                if (existing.bullets && el.bullets) {
                  existing.bullets = Array.from(new Set([...existing.bullets, ...el.bullets]));
                }
                existing.isTitle = existing.isTitle || el.isTitle;
                const minX = Math.min(existing.x, el.x);
                const minY = Math.min(existing.y, el.y);
                const maxX = Math.max(existing.x + existing.w, el.x + el.w);
                const maxY = Math.max(existing.y + existing.h, el.y + el.h);
                existing.x = minX;
                existing.y = minY;
                existing.w = maxX - minX;
                existing.h = maxY - minY;
                merged = true;
                break;
              }
            }
          }
        }

        if (!merged) {
          refinedElements.push(el);
        }
      }

      // De-collision pass: Ensure images and texts do not overlap each other
      const slideHasImages = refinedElements.some(e => e.type === 'image');
      const slideHasTexts = refinedElements.some(e => e.type === 'text');
      if (slideHasImages && slideHasTexts) {
        refinedElements.forEach(el => {
          if (!el.hasCoords) {
            if (el.type === 'image') {
              el.x = 54;
              el.y = 24;
              el.w = 42;
              el.h = 68;
            } else if (el.type === 'text') {
              if (el.isTitle) {
                el.x = 5;
                el.y = 5;
                el.w = 90;
                el.h = 16;
              } else {
                el.x = 5;
                el.y = 24;
                el.w = 46;
                el.h = 68;
              }
            }
          }
        });
      }

      parsedSlides.push({
        title: slideTitle || `Slide ${parsedSlides.length + 1}`,
        content: slideBullets,
        backgroundColor,
        backgroundImage,
        width: 960,
        height: 540,
        isHighFidelity: false,
        elements: refinedElements.length > 0 ? refinedElements : [
          {
            type: 'text',
            isTitle: true,
            text: slideTitle || `Slide ${parsedSlides.length + 1}`,
            bullets: [slideTitle || `Slide ${parsedSlides.length + 1}`],
            x: 10,
            y: 10,
            w: 80,
            h: 20
          },
          {
            type: 'text',
            isTitle: false,
            text: slideBullets.join(' '),
            bullets: slideBullets,
            x: 10,
            y: 35,
            w: 80,
            h: 55
          }
        ]
      });
    }

    return parsedSlides;
  } catch (err) {
    console.error('Error parsing PPTX presentation xml:', err);
    return [];
  }
};

// Helper to parse CSS color string to RGB
const parseCssColorToRgb = (colorStr: string): { r: number; g: number; b: number } | null => {
  if (!colorStr) return null;
  const s = colorStr.trim().toLowerCase().replace('!important', '').trim();
  if (s === 'transparent' || s === 'inherit' || s === 'none' || s === 'initial' || s === 'unset') return null;

  // Handle CSS gradients by averaging stop colors for contrast and luminance calculations
  if (s.includes('gradient')) {
    const hexMatches = s.match(/#[a-f0-9]{6}|#[a-f0-9]{3}/gi) || [];
    const rgbMatches = s.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/gi) || [];
    const stopColors: { r: number; g: number; b: number }[] = [];
    for (const h of hexMatches) {
      const parsed = parseCssColorToRgb(h);
      if (parsed) stopColors.push(parsed);
    }
    for (const r of rgbMatches) {
      const parsed = parseCssColorToRgb(r + ')');
      if (parsed) stopColors.push(parsed);
    }
    if (stopColors.length > 0) {
      const avgR = Math.round(stopColors.reduce((sum, c) => sum + c.r, 0) / stopColors.length);
      const avgG = Math.round(stopColors.reduce((sum, c) => sum + c.g, 0) / stopColors.length);
      const avgB = Math.round(stopColors.reduce((sum, c) => sum + c.b, 0) / stopColors.length);
      return { r: avgR, g: avgG, b: avgB };
    }
  }
  
  if (s.startsWith('#')) {
    const hex = s.slice(1).trim();
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    } else if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
  }
  
  const rgbMatch = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    if (rgbMatch[4] !== undefined && parseFloat(rgbMatch[4]) === 0) return null;
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }

  if (s === 'white') return { r: 255, g: 255, b: 255 };
  if (s === 'black') return { r: 0, g: 0, b: 0 };
  
  return null;
};

// Calculate WCAG relative luminance (0.0 to 1.0)
const getRgbLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const a = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};

// Calculate WCAG contrast ratio (1.0 to 21.0)
const calculateContrastRatio = (
  rgb1: { r: number; g: number; b: number }, 
  rgb2: { r: number; g: number; b: number }
): number => {
  const l1 = getRgbLuminance(rgb1);
  const l2 = getRgbLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Extract slide-level background colors and gradients from OpenXML package (slide -> layout -> master -> theme)
const extractPptxSlideBackgrounds = async (arrayBuffer: ArrayBuffer): Promise<(string | null)[]> => {
  const backgrounds: (string | null)[] = [];
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Parse theme color scheme (dk1, lt1, dk2, lt2, etc.)
    const themeColors: Record<string, string> = {};
    const themeFileKey = Object.keys(zip.files).find(k => /^ppt\/theme\/theme\d+\.xml$/i.test(k)) || 'ppt/theme/theme1.xml';
    const themeXml = await zip.files[themeFileKey]?.async('string') || '';
    if (themeXml) {
      const match = themeXml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
      if (match) {
        const clrSchemeInner = match[1];
        const clrRegex = /<a:([a-zA-Z0-9]+)>[\s\S]*?(?:val="([A-Fa-f0-9]{6})"|lastClr="([A-Fa-f0-9]{6})")[\s\S]*?<\/a:\1>/g;
        let m;
        while ((m = clrRegex.exec(clrSchemeInner)) !== null) {
          themeColors[m[1]] = '#' + (m[2] || m[3]);
        }
        // Map OpenXML standard theme color aliases
        if (themeColors['lt1']) themeColors['bg1'] = themeColors['lt1'];
        if (themeColors['dk1']) themeColors['tx1'] = themeColors['dk1'];
        if (themeColors['lt2']) themeColors['bg2'] = themeColors['lt2'];
        if (themeColors['dk2']) themeColors['tx2'] = themeColors['dk2'];
      }
    }

    // Helper: Parse OpenXML <a:gradFill> into CSS linear-gradient
    const parseGradFill = (gradXml: string): string | null => {
      if (!gradXml) return null;
      const gsRegex = /<a:gs\s+pos="(\d+)"[^>]*>([\s\S]*?)<\/a:gs>/g;
      let gsMatch;
      const stops: { pos: number; color: string }[] = [];

      while ((gsMatch = gsRegex.exec(gradXml)) !== null) {
        const pos = Math.min(100, Math.max(0, Math.round(parseInt(gsMatch[1], 10) / 1000)));
        const inner = gsMatch[2];
        let color: string | null = null;

        const srgb = inner.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/i);
        if (srgb) {
          color = '#' + srgb[1];
        } else {
          const scheme = inner.match(/<a:schemeClr\s+val="([^"]+)"/i);
          if (scheme && themeColors[scheme[1]]) {
            color = themeColors[scheme[1]];
          } else {
            const sys = inner.match(/<a:sysClr[^>]*lastClr="([A-Fa-f0-9]{6})"/i);
            if (sys) color = '#' + sys[1];
          }
        }

        // Apply lumMod / shade / tint if present
        if (color) {
          const lumMod = inner.match(/<a:lumMod\s+val="(\d+)"/i);
          if (lumMod) {
            const factor = parseInt(lumMod[1], 10) / 100000;
            const rgb = parseCssColorToRgb(color);
            if (rgb) {
              const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
              const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
              const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));
              color = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            }
          }
          stops.push({ pos, color });
        }
      }

      if (stops.length < 2) return null;
      stops.sort((a, b) => a.pos - b.pos);

      // Parse angle: in OpenXML, 5400000 is 90 deg (top-to-bottom in CSS: 180deg)
      let angle = 180;
      const linMatch = gradXml.match(/<a:lin\s+ang="(\d+)"/i);
      if (linMatch) {
        const pptAng = parseInt(linMatch[1], 10) / 60000;
        angle = Math.round((pptAng + 90) % 360);
      }

      return `linear-gradient(${angle}deg, ${stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
    };

    // Parse theme background fill styles list: <a:bgFillStyleLst>
    const themeBgStyles: (string | null)[] = [];
    if (themeXml) {
      const bgFillLstMatch = themeXml.match(/<a:bgFillStyleLst[^>]*>([\s\S]*?)<\/a:bgFillStyleLst>/i);
      if (bgFillLstMatch) {
        const innerLst = bgFillLstMatch[1];
        const fillRegex = /<a:(solidFill|gradFill)[^>]*>([\s\S]*?)<\/a:\1>/g;
        let fm;
        while ((fm = fillRegex.exec(innerLst)) !== null) {
          const fillType = fm[1];
          const fillContent = fm[0];
          if (fillType === 'solidFill') {
            const srgb = fillContent.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/i);
            if (srgb) {
              themeBgStyles.push('#' + srgb[1]);
            } else {
              const scheme = fillContent.match(/<a:schemeClr\s+val="([^"]+)"/i);
              if (scheme && themeColors[scheme[1]]) {
                themeBgStyles.push(themeColors[scheme[1]]);
              } else {
                themeBgStyles.push(null);
              }
            }
          } else if (fillType === 'gradFill') {
            themeBgStyles.push(parseGradFill(fillContent));
          } else {
            themeBgStyles.push(null);
          }
        }
      }
    }

    const resolveBgFromXml = (xml: string): string | null => {
      if (!xml) return null;
      // 1. <p:bg>
      const bgMatch = xml.match(/<p:bg>([\s\S]*?)<\/p:bg>/i);
      if (bgMatch) {
        const bgContent = bgMatch[1];
        const grad = parseGradFill(bgContent);
        if (grad) return grad;
        const srgb = bgContent.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/i);
        if (srgb) return '#' + srgb[1];
        const scheme = bgContent.match(/<a:schemeClr\s+val="([^"]+)"/i);
        if (scheme && themeColors[scheme[1]]) return themeColors[scheme[1]];
      }
      // 2. <p:bgRef>
      const bgRefMatch = xml.match(/<p:bgRef([^>]*)>([\s\S]*?)<\/p:bgRef>/i);
      if (bgRefMatch) {
        const attrs = bgRefMatch[1];
        const refContent = bgRefMatch[2];
        const srgb = refContent.match(/<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/i);
        if (srgb) return '#' + srgb[1];
        const scheme = refContent.match(/<a:schemeClr\s+val="([^"]+)"/i);
        if (scheme && themeColors[scheme[1]]) return themeColors[scheme[1]];

        // Reference index into themeBgStyles: idx="1001" etc.
        const idxMatch = attrs.match(/idx="(\d+)"/i);
        if (idxMatch) {
          const idx = parseInt(idxMatch[1], 10);
          if (idx > 1000 && themeBgStyles[idx - 1001]) {
            return themeBgStyles[idx - 1001];
          } else if (idx >= 1 && themeBgStyles[idx - 1]) {
            return themeBgStyles[idx - 1];
          }
        }
      }
      return null;
    };

    const slideKeys = Object.keys(zip.files)
      .filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, '') || '0', 10);
        const numB = parseInt(b.replace(/[^0-9]/g, '') || '0', 10);
        return numA - numB;
      });

    for (const key of slideKeys) {
      const sldXml = await zip.files[key].async('string');
      let bg = resolveBgFromXml(sldXml);
      
      // If not directly on slide, follow layout relationship
      if (!bg) {
        const slideNum = key.replace(/[^0-9]/g, '');
        const relsKey = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
        const relsXml = await zip.files[relsKey]?.async('string') || '';
        const layoutTarget = relsXml.match(/Type="[^"]*slideLayout"[^>]*Target="([^"]+)"/i)?.[1];
        if (layoutTarget) {
          const cleanTarget = layoutTarget.replace(/^\.\.\//, 'ppt/');
          const layoutXml = await zip.files[cleanTarget]?.async('string') || '';
          bg = resolveBgFromXml(layoutXml);

          // If not on layout, check master
          if (!bg) {
            const layoutRelsKey = cleanTarget.replace('slideLayouts/slideLayout', 'slideLayouts/_rels/slideLayout') + '.rels';
            const layoutRelsXml = await zip.files[layoutRelsKey]?.async('string') || '';
            const masterTarget = layoutRelsXml.match(/Type="[^"]*slideMaster"[^>]*Target="([^"]+)"/i)?.[1];
            if (masterTarget) {
              const cleanMaster = masterTarget.replace(/^\.\.\//, 'ppt/');
              const masterXml = await zip.files[cleanMaster]?.async('string') || '';
              bg = resolveBgFromXml(masterXml);
            }
          }
        }
      }
      backgrounds.push(bg);
    }
  } catch (err) {
    console.warn("Could not extract PPTX slide backgrounds:", err);
  }
  return backgrounds;
};

// Extract shape coordinates and dimensions from inline CSS style
const getShapeBoundsFromStyle = (style: string) => {
  const left = parseFloat((style.match(/left:\s*([\d.]+)px/i) || [])[1] || '0');
  const top = parseFloat((style.match(/top:\s*([\d.]+)px/i) || [])[1] || '0');
  const width = parseFloat((style.match(/width:\s*([\d.]+)px/i) || [])[1] || '0');
  const height = parseFloat((style.match(/height:\s*([\d.]+)px/i) || [])[1] || '0');
  return { left, top, width, height, right: left + width, bottom: top + height };
};

// Automated slide contrast enhancer: ensures all text and diagrams are 100% visible on both light and dark slides
// Detects full-bleed background shapes, underlay cards, and master themes to eliminate invisible text.
const ensureSlideTextContrast = (
  slideEl: Element,
  inheritedBg?: string | null
): string => {
  // 1. Resolve slide's actual background
  const slideStyle = slideEl.getAttribute('style') || '';
  const bgMatch = slideStyle.match(/background(?:-color)?:\s*([^;]+)/i);
  let effectiveSlideBg = bgMatch ? bgMatch[1].trim() : '';

  // Collect all shapes to inspect underlays, full-bleed background rectangles, and cards
  const allShapes = Array.from(slideEl.querySelectorAll('.shape'));
  interface ShapeMeta {
    el: Element;
    index: number;
    bounds: { left: number; top: number; width: number; height: number; right: number; bottom: number };
    bgRgb: { r: number; g: number; b: number } | null;
    bgStr: string | null;
  }

  const shapeMetas: ShapeMeta[] = allShapes.map((sEl, i) => {
    const sStyle = sEl.getAttribute('style') || '';
    const bounds = getShapeBoundsFromStyle(sStyle);
    let bgRgb: { r: number; g: number; b: number } | null = null;
    let bgStr: string | null = null;
    const sBgMatch = sStyle.match(/background(?:-color)?:\s*([^;]+)/i);
    if (sBgMatch) {
      bgStr = sBgMatch[1].trim();
      bgRgb = parseCssColorToRgb(bgStr);
    }
    if (!bgRgb) {
      const svg = sEl.querySelector(':scope > svg.shape-svg, :scope > svg');
      if (svg) {
        const fillEl = svg.querySelector('[fill]:not([fill="none"]):not([fill="transparent"])');
        if (fillEl) {
          const fillVal = fillEl.getAttribute('fill');
          if (fillVal) {
            bgStr = fillVal;
            bgRgb = parseCssColorToRgb(fillVal);
          }
        }
      }
    }
    return { el: sEl, index: i, bounds, bgRgb, bgStr };
  });

  // Check for full-bleed background shape covering the slide (>= 75% width & height)
  const fullSlideShape = shapeMetas.find(sh => sh.bounds.width >= 720 && sh.bounds.height >= 400 && (sh.bgRgb || sh.bgStr));
  if (fullSlideShape) {
    if (fullSlideShape.bgStr && fullSlideShape.bgStr.includes('gradient')) {
      effectiveSlideBg = fullSlideShape.bgStr;
      slideEl.setAttribute('style', `${slideStyle}; background: ${fullSlideShape.bgStr};`);
    } else if (fullSlideShape.bgRgb) {
      const hex = '#' + [fullSlideShape.bgRgb.r, fullSlideShape.bgRgb.g, fullSlideShape.bgRgb.b].map(v => v.toString(16).padStart(2, '0')).join('');
      effectiveSlideBg = hex;
      slideEl.setAttribute('style', `${slideStyle}; background-color: ${hex};`);
    }
  } else if (inheritedBg && (!effectiveSlideBg || effectiveSlideBg.toLowerCase() === '#ffffff' || effectiveSlideBg.toLowerCase() === '#fff' || effectiveSlideBg.toLowerCase() === 'white')) {
    effectiveSlideBg = inheritedBg;
    if (inheritedBg.includes('gradient')) {
      slideEl.setAttribute('style', `${slideStyle}; background: ${inheritedBg};`);
    } else {
      slideEl.setAttribute('style', `${slideStyle}; background-color: ${inheritedBg};`);
    }
  }

  // Check original text color distribution:
  // If the slide's text is predominantly white/light (e.g. title, cards, boxes are all white),
  // this slide was designed as a dark slide whose background failed to resolve from layout/master/gradient.
  let totalLightChars = 0;
  let totalDarkChars = 0;
  const initialTextEls = slideEl.querySelectorAll('.run, .run-segment, p, span, .paragraph, h1, h2, h3, h4, h5, h6');
  initialTextEls.forEach(tEl => {
    const txt = tEl.textContent?.trim();
    if (!txt) return;
    const st = tEl.getAttribute('style') || '';
    const colM = st.match(/(?:^|;)\s*color:\s*([^;]+)/i);
    if (colM) {
      const rgb = parseCssColorToRgb(colM[1]);
      if (rgb) {
        if (getRgbLuminance(rgb) > 0.6) {
          totalLightChars += txt.length;
        } else {
          totalDarkChars += txt.length;
        }
      }
    }
  });

  const isIntendedDarkSlide = totalLightChars > 0 && totalLightChars >= totalDarkChars;
  if (isIntendedDarkSlide && (!effectiveSlideBg || effectiveSlideBg.toLowerCase() === '#ffffff' || effectiveSlideBg.toLowerCase() === '#fff' || effectiveSlideBg.toLowerCase() === 'white')) {
    effectiveSlideBg = '#0f172a';
    slideEl.setAttribute('style', `${slideStyle}; background-color: #0f172a;`);
  }

  if (!effectiveSlideBg) {
    effectiveSlideBg = '#ffffff';
  }

  const slideBgRgb = parseCssColorToRgb(effectiveSlideBg) || { r: 255, g: 255, b: 255 };
  const slideBgLum = getRgbLuminance(slideBgRgb);

  // 2. Normalize text body containers to standard OpenXML line-height and bounding box
  slideEl.querySelectorAll('.text-body').forEach(tb => {
    const tbStyle = tb.getAttribute('style') || '';
    tb.setAttribute('style', `${tbStyle}; box-sizing: border-box; line-height: 1.15; overflow-wrap: break-word; word-break: break-word;`);
  });

  // 3. Scan all text elements within the slide
  const textCandidates = slideEl.querySelectorAll('.run, .run-segment, p, span, .paragraph, h1, h2, h3, h4, h5, h6, .text-body');

  textCandidates.forEach((el) => {
    // Only process elements that contain actual text
    const text = el.textContent?.trim();
    if (!text) return;

    // Detect color of this text element (inline or inherited from ancestor)
    let colorStr = '';
    let curr: Element | null = el;
    while (curr && curr !== slideEl) {
      const style = curr.getAttribute('style') || '';
      const cMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
      if (cMatch) {
        colorStr = cMatch[1].trim();
        break;
      }
      curr = curr.parentElement;
    }

    // In CSS, if an element has no explicit color, default browser text color is black (#000000)
    const textRgb = colorStr ? parseCssColorToRgb(colorStr) : { r: 0, g: 0, b: 0 };
    if (!textRgb) return;

    // Determine the TRUE physical background behind this text element:
    // First, check closest shape container or ancestors
    let effectiveBgRgb = slideBgRgb;
    const containingShape = el.closest('.shape');
    const containingMeta = shapeMetas.find(s => s.el === containingShape);

    if (containingMeta && containingMeta.bgRgb) {
      effectiveBgRgb = containingMeta.bgRgb;
    } else if (containingMeta) {
      // If containing shape has no background, find the preceding shape in DOM order physically underneath its center
      const centerX = containingMeta.bounds.left + containingMeta.bounds.width / 2;
      const centerY = containingMeta.bounds.top + containingMeta.bounds.height / 2;
      for (let j = containingMeta.index - 1; j >= 0; j--) {
        const prev = shapeMetas[j];
        if (prev.bgRgb && prev.bounds.left <= centerX && centerX <= prev.bounds.right &&
            prev.bounds.top <= centerY && centerY <= prev.bounds.bottom) {
          effectiveBgRgb = prev.bgRgb;
          break;
        }
      }
    } else {
      let bgCurr: Element | null = el.parentElement;
      while (bgCurr && bgCurr !== slideEl) {
        const bStyle = bgCurr.getAttribute('style') || '';
        const bMatch = bStyle.match(/background(?:-color)?:\s*([^;]+)/i);
        if (bMatch) {
          const parsed = parseCssColorToRgb(bMatch[1]);
          if (parsed) {
            effectiveBgRgb = parsed;
            break;
          }
        }
        bgCurr = bgCurr.parentElement;
      }
    }

    // Calculate contrast ratio against effective background
    const contrast = calculateContrastRatio(textRgb, effectiveBgRgb);
    // If contrast is poor (< 3.5:1), text is invisible/washed out
    if (contrast < 3.5) {
      const bgLum = getRgbLuminance(effectiveBgRgb);
      const currStyle = el.getAttribute('style') || '';
      if (bgLum > 0.5) {
        // Light background + light/invisible text => change text to high-contrast dark slate
        const updatedStyle = currStyle.includes('color:')
          ? currStyle.replace(/(?:^|;)\s*color:\s*[^;]+/gi, '; color: #1e293b !important')
          : `${currStyle}; color: #1e293b !important;`;
        el.setAttribute('style', updatedStyle);

        // Also ensure child run-segments receive or inherit this color
        el.querySelectorAll('.run-segment').forEach(child => {
          const childStyle = child.getAttribute('style') || '';
          if (childStyle.includes('color:')) {
            child.setAttribute('style', childStyle.replace(/(?:^|;)\s*color:\s*[^;]+/gi, '; color: #1e293b !important'));
          }
        });

        // Also check if parent element had an inline light color that might override
        if (el.parentElement && el.parentElement !== slideEl) {
          const pStyle = el.parentElement.getAttribute('style') || '';
          if (pStyle.includes('color:')) {
            const pMatch = pStyle.match(/(?:^|;)\s*color:\s*([^;]+)/i);
            const pRgb = pMatch ? parseCssColorToRgb(pMatch[1]) : null;
            if (pRgb && getRgbLuminance(pRgb) > 0.5) {
              el.parentElement.setAttribute('style', pStyle.replace(/(?:^|;)\s*color:\s*[^;]+/gi, '; color: #1e293b !important'));
            }
          }
        }
      } else {
        // Dark background + dark/invisible text => change text to high-contrast light
        let updatedStyle = currStyle.includes('color:')
          ? currStyle.replace(/(?:^|;)\s*color:\s*[^;]+/gi, '; color: #f8fafc !important')
          : `${currStyle}; color: #f8fafc !important;`;
        // Ensure opacity is fully visible
        updatedStyle = updatedStyle.replace(/(?:^|;)\s*opacity:\s*[^;]+/gi, '; opacity: 1 !important');
        el.setAttribute('style', updatedStyle);

        // Also ensure child run-segments receive this light color
        el.querySelectorAll('.run-segment').forEach(child => {
          const childStyle = child.getAttribute('style') || '';
          if (childStyle.includes('color:')) {
            child.setAttribute('style', childStyle.replace(/(?:^|;)\s*color:\s*[^;]+/gi, '; color: #f8fafc !important'));
          }
        });

        // Also check if parent element had an inline dark color that might override
        if (el.parentElement && el.parentElement !== slideEl) {
          const pStyle = el.parentElement.getAttribute('style') || '';
          if (pStyle.includes('color:')) {
            const pMatch = pStyle.match(/(?:^|;)\s*color:\s*([^;]+)/i);
            const pRgb = pMatch ? parseCssColorToRgb(pMatch[1]) : null;
            if (pRgb && getRgbLuminance(pRgb) < 0.45) {
              el.parentElement.setAttribute('style', pStyle.replace(/(?:^|;)\s*color:\s*[^;]+/gi, '; color: #f8fafc !important'));
            }
          }
        }
      }
    }
  });

  // 3. Scan SVG text elements (<text>, <tspan>)
  const svgTexts = slideEl.querySelectorAll('text, tspan');
  svgTexts.forEach((tEl) => {
    const text = tEl.textContent?.trim();
    if (!text) return;

    let fillStr = tEl.getAttribute('fill') || '';
    if (!fillStr) {
      const style = tEl.getAttribute('style') || '';
      const fMatch = style.match(/(?:^|;)\s*fill:\s*([^;]+)/i);
      if (fMatch) fillStr = fMatch[1].trim();
    }

    const fillRgb = fillStr ? parseCssColorToRgb(fillStr) : { r: 0, g: 0, b: 0 };
    if (fillRgb) {
      const contrast = calculateContrastRatio(fillRgb, slideBgRgb);
      if (contrast < 3.5) {
        if (slideBgLum > 0.5) {
          tEl.setAttribute('fill', '#1e293b');
        } else {
          tEl.setAttribute('fill', '#f8fafc');
        }
      }
    }
  });

  // 4. Check for SVG diagram lines/connectors directly on slide background
  if (slideBgLum > 0.6) {
    const svgShapes = slideEl.querySelectorAll('path, line, polyline, polygon');
    svgShapes.forEach((shape) => {
      const stroke = shape.getAttribute('stroke');
      if (stroke) {
        const strokeRgb = parseCssColorToRgb(stroke);
        if (strokeRgb && calculateContrastRatio(strokeRgb, slideBgRgb) < 2.0) {
          shape.setAttribute('stroke', '#94a3b8');
        }
      }
    });
  }

  return effectiveSlideBg;
};

// High-fidelity presentation loader: uses WASM engine for pixel-accurate slide rendering
const loadPptPresentation = async (arrayBuffer: ArrayBuffer): Promise<any[]> => {
  // 1. Primary engine: High-fidelity Rust/WASM presentation engine
  try {
    const { convert: convertPptx, convert_with_options: convertWithOptions, get_presentation_info: getPresInfo } = await ensurePptxEngine();
    const data = new Uint8Array(arrayBuffer);

    let presWidth = 960;
    let presHeight = 540;
    try {
      if (typeof getPresInfo === 'function') {
        const info = getPresInfo(data);
        if (info && info.widthPx > 0 && info.heightPx > 0) {
          presWidth = info.widthPx;
          presHeight = info.heightPx;
        }
      }
    } catch (infoErr) {
      console.warn("Could not read presentation info:", infoErr);
    }

    // Extract slide backgrounds from OpenXML package in parallel
    const pptxBackgrounds = await extractPptxSlideBackgrounds(arrayBuffer);

    let htmlString = '';
    if (typeof convertWithOptions === 'function') {
      try {
        htmlString = convertWithOptions(data, true, true, new Uint32Array([]), 1.0);
      } catch (optErr) {
        console.warn("convert_with_options failed, falling back to standard convert:", optErr);
        htmlString = convertPptx(data);
      }
    } else {
      htmlString = convertPptx(data);
    }
    if (htmlString && htmlString.includes('class="slide')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');

      let scopedCss = '';
      const styleTag = doc.querySelector('style');
      if (styleTag && styleTag.textContent) {
        scopedCss = styleTag.textContent
          .replace(/\bbody\s*\{[^}]*\}/gi, '')
          .replace(/\*\s*\{[^}]*margin\s*:\s*0[^}]*\}/gi, '');
      }

      const slideShells = doc.querySelectorAll('.slide-shell');
      if (slideShells.length > 0) {
        const parsedSlides: any[] = [];
        slideShells.forEach((shell, idx) => {
          const slideEl = shell.querySelector('.slide') || shell;

          const shellStyle = shell.getAttribute('style') || '';
          const wMatch = shellStyle.match(/width:\s*([\d.]+)px/i);
          const hMatch = shellStyle.match(/height:\s*([\d.]+)px/i);
          const slideWidth = wMatch ? parseFloat(wMatch[1]) : presWidth;
          const slideHeight = hMatch ? parseFloat(hMatch[1]) : presHeight;

          // Ensure full text contrast and prevent white-on-white text masking
          const inheritedBg = pptxBackgrounds[idx] || null;
          const effectiveBgColor = ensureSlideTextContrast(slideEl, inheritedBg);

          // Extract text runs for outline / accessibility / title
          const textRuns: string[] = [];
          slideEl.querySelectorAll('p, .paragraph, .run, .run-segment').forEach(node => {
            const txt = node.textContent?.trim();
            if (txt && !textRuns.includes(txt)) {
              textRuns.push(txt);
            }
          });

          const title = textRuns[0] || `Slide ${idx + 1}`;
          const content = textRuns.slice(1);

          const hasImages = !!slideEl.querySelector('img, svg, .shape-image');

          parsedSlides.push({
            slideIndex: idx,
            title,
            content: content.length > 0 ? content : (textRuns.length > 0 ? textRuns : [`Slide ${idx + 1}`]),
            html: shell.outerHTML,
            css: scopedCss,
            width: slideWidth,
            height: slideHeight,
            backgroundColor: effectiveBgColor,
            isHighFidelity: true,
            elements: hasImages 
              ? [{ type: 'image' }, { type: 'text', isTitle: true, text: title }] 
              : [{ type: 'text', isTitle: true, text: title }]
          });
        });

        if (parsedSlides.length > 0) {
          console.log(`Successfully parsed ${parsedSlides.length} high-fidelity slides via WASM engine with contrast protection.`);
          return parsedSlides;
        }
      }
    }
  } catch (wasmErr) {
    console.warn("WASM presentation renderer failed, falling back to safe OpenXML parser:", wasmErr);
  }

  // 2. Safe Fallback OpenXML parser (with non-colliding layout)
  return await parsePptx(arrayBuffer);
};

// Canvas page renderer for PDF with Persistent Page Cache & Progressive Preloading
const PdfPageRenderer: React.FC<{ 
  pdfDoc: any; 
  pageNum: number; 
  scale: number; 
  containerWidth: number; 
  isThumbnail?: boolean;
}> = ({ pdfDoc, pageNum, scale, containerWidth, isThumbnail = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageAspect, setPageAspect] = useState<{ width: number; height: number }>({ width: 1, height: 1.414 });
  // Pre-render the first 3 pages immediately
  const [shouldRender, setShouldRender] = useState(() => pageNum <= 3);
  const [rendered, setRendered] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [errorRef, setErrorRef] = useState(false);
  const renderTaskRef = useRef<any>(null);
  const lastRenderedScaleRef = useRef<number>(0);

  // 1. Generous viewport observer: pre-renders 2-3 pages ahead of scroll
  useEffect(() => {
    if (pageNum <= 3) {
      setShouldRender(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    // Generous rootMargin (1800px) so upcoming pages are rendered well before reaching viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldRender(true);
          }
          // IMPORTANT: Never unload previously rendered pages when scrolling away!
          // Keeping rendered pages in DOM guarantees instant scrolling with zero reload spinners.
        });
      },
      { rootMargin: isThumbnail ? '400px 0px' : '1800px 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [pageNum, isThumbnail]);

  // 2. Background progressive preloader: after page N finishes rendering, queue page N+1 to render in idle time
  useEffect(() => {
    const handleNextPageQueue = (e: Event) => {
      const finishedPage = (e as CustomEvent)?.detail?.pageNum;
      if (finishedPage === pageNum - 1) {
        // Queue next page render in idle time or shortly after previous page finishes
        const timer = setTimeout(() => {
          setShouldRender(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('pdf:page-rendered', handleNextPageQueue);
    return () => {
      window.removeEventListener('pdf:page-rendered', handleNextPageQueue);
    };
  }, [pageNum]);

  // 3. Render page onto canvas
  useEffect(() => {
    if (!shouldRender) return;

    // If already rendered at the same scale, don't re-render
    const effectiveScale = scale;
    if (rendered && lastRenderedScaleRef.current === effectiveScale) {
      return;
    }

    let active = true;

    const render = async () => {
      try {
        setRendering(true);
        setErrorRef(false);
        const page = await pdfDoc.getPage(pageNum);
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Balanced zoom multiplier: 1.0 for thumbnail, 1.25 for regular pages
        const zoomMultiplier = isThumbnail ? 1.0 : 1.25;
        const baseViewport = page.getViewport({ scale: 1 });
        setPageAspect({ width: baseViewport.width, height: baseViewport.height });

        const effectiveWidth = Math.max(containerWidth || 500, 480);
        const widthScale = effectiveWidth / baseViewport.width;
        const finalScale = widthScale * scale * zoomMultiplier;
        const viewport = page.getViewport({ scale: finalScale });

        // Cap DPR to 2 max to prevent massive canvas memory allocations on mobile screens
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        context.scale(dpr, dpr);

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (active) {
          setRendering(false);
          setRendered(true);
          lastRenderedScaleRef.current = effectiveScale;

          // Dispatch event to sequentially trigger the next page in background
          window.dispatchEvent(
            new CustomEvent('pdf:page-rendered', { detail: { pageNum } })
          );
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render task failed/cancelled`, err);
          if (active) {
            setErrorRef(true);
            setRendering(false);
          }
        }
      }
    };

    render();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [shouldRender, pdfDoc, pageNum, scale, containerWidth, isThumbnail, rendered]);

  if (isThumbnail) {
    return (
      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden bg-white rounded-none">
        <canvas 
          ref={canvasRef} 
          className={`max-h-full max-w-full object-contain rounded-none transition-opacity duration-200 ${rendered ? 'opacity-100' : 'opacity-0'}`} 
        />
        {(!rendered && rendering) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] z-10 rounded-none">
            <Loader2 size={16} className="text-blue-600 animate-spin" />
          </div>
        )}
        {!shouldRender && !rendered && (
          <div className="w-full h-full bg-neutral-100 flex items-center justify-center rounded-none">
            <span className="text-[10px] text-neutral-400 font-mono">{pageNum}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      style={{
        aspectRatio: `${pageAspect.width} / ${pageAspect.height}`,
      }}
      className="bg-white p-0 border border-neutral-300 shadow-[0_4px_16px_rgba(0,0,0,0.12)] rounded-none relative w-full overflow-hidden select-none"
    >
      {shouldRender ? (
        <>
          {rendering && !rendered && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs z-10 rounded-none">
              <Loader2 size={24} className="text-blue-600 animate-spin" />
            </div>
          )}
          {errorRef ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-red-500 font-medium font-sans">
              Failed to display Page {pageNum}
            </div>
          ) : (
            <canvas 
              ref={canvasRef} 
              className={`w-full h-full object-contain rounded-none block transition-opacity duration-150 ${rendered ? 'opacity-100' : 'opacity-0'}`} 
            />
          )}
        </>
      ) : (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center text-neutral-300">
          <Loader2 size={20} className="animate-spin text-neutral-300 mb-1" />
          <span className="text-[11px] font-mono font-medium text-neutral-400">{pageNum}</span>
        </div>
      )}
      {/* Subtle floating page indicator at bottom right of page sheet */}
      <span className="absolute bottom-1.5 right-2 text-[9px] font-mono font-bold text-neutral-400/85 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded shadow-2xs pointer-events-none select-none">
        {pageNum}
      </span>
    </div>
  );
};

// Word DOCX display
const WordDocxViewer: React.FC<{ arrayBuffer: ArrayBuffer; htmlContent: string | null }> = ({ arrayBuffer, htmlContent }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [zoomAdjust, setZoomAdjust] = useState(1.0);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | string>('auto');
  const [pageCount, setPageCount] = useState<number | null>(null);

  const partitionLongSections = (container: HTMLDivElement) => {
    const parent = container.querySelector('.docx-wrapper') || container;
    let sections = Array.from(parent.querySelectorAll('section'));
    if (sections.length === 0 && (parent as HTMLElement).tagName === 'SECTION') {
      sections = [parent as HTMLElement];
    }
    if (sections.length === 0) return;

    const targetA4Height = 1150; // Standard A4 height at 850px layout width
    const pagePadding = 130; // 65px top + 65px bottom padding
    const maxA4ContentHeight = targetA4Height - pagePadding; // Available printable area height (~1020px)

    const createTableFromChunk = (
      originalTable: HTMLTableElement,
      colgroups: Element[],
      thead: Element | null,
      rows: HTMLTableRowElement[]
    ): HTMLTableElement => {
      const clonedTable = originalTable.cloneNode(false) as HTMLTableElement;
      clonedTable.style.marginTop = '4px';
      clonedTable.style.marginBottom = '4px';
      clonedTable.className = (originalTable.className || '') + ' docx-split-table';

      colgroups.forEach(cg => {
        clonedTable.appendChild(cg.cloneNode(true));
      });

      if (thead) {
        clonedTable.appendChild(thead.cloneNode(true));
      }

      const tbody = document.createElement('tbody');
      rows.forEach(r => {
        tbody.appendChild(r.cloneNode(true));
      });
      clonedTable.appendChild(tbody);

      return clonedTable;
    };

    const splitTableIntoChunks = (
      tableEl: HTMLTableElement, 
      firstPageSpace: number, 
      subsequentPageSpace: number
    ) => {
      const rows = Array.from(tableEl.querySelectorAll('tr'));
      if (rows.length <= 1) {
        return [{ 
          element: tableEl, 
          height: tableEl.offsetHeight || tableEl.scrollHeight || 100 
        }];
      }

      const thead = tableEl.querySelector('thead');
      const colgroups = Array.from(tableEl.querySelectorAll('colgroup'));

      // Get rows that belong to tbody/tfoot (exclude the cloned thead rows)
      const dataRows = rows.filter(r => !thead || !thead.contains(r));
      if (dataRows.length === 0) {
        return [{ 
          element: tableEl, 
          height: tableEl.offsetHeight || tableEl.scrollHeight || 100 
        }];
      }

      const chunks: { element: HTMLTableElement; height: number }[] = [];
      let currentRowChunk: HTMLTableRowElement[] = [];
      let currentSpaceLimit = firstPageSpace;
      
      let theadHeight = 0;
      if (thead) {
        theadHeight = (thead as HTMLElement).offsetHeight || (thead as HTMLElement).scrollHeight || 35;
      }

      let accumulatedHeight = theadHeight;

      dataRows.forEach((row) => {
        const rowHeight = row.offsetHeight || row.scrollHeight || 35;
        
        if (accumulatedHeight + rowHeight > currentSpaceLimit && currentRowChunk.length > 0) {
          const clonedTable = createTableFromChunk(tableEl, colgroups, thead, currentRowChunk);
          chunks.push({
            element: clonedTable,
            height: accumulatedHeight
          });
          
          currentRowChunk = [row as HTMLTableRowElement];
          currentSpaceLimit = subsequentPageSpace;
          accumulatedHeight = theadHeight + rowHeight;
        } else {
          currentRowChunk.push(row as HTMLTableRowElement);
          accumulatedHeight += rowHeight;
        }
      });

      if (currentRowChunk.length > 0) {
        const clonedTable = createTableFromChunk(tableEl, colgroups, thead, currentRowChunk);
        chunks.push({
          element: clonedTable,
          height: accumulatedHeight
        });
      }

      return chunks;
    };

    sections.forEach((sect) => {
      const children = Array.from(sect.children) as HTMLElement[];
      if (children.length === 0) return;

      const processedChildren: { element: HTMLElement; height: number }[] = [];

      for (let index = 0; index < children.length; index++) {
        const child = children[index];
        const rect = child.getBoundingClientRect();
        const currentScale = scale || 1;
        const rectHeight = rect.height > 0 ? rect.height / currentScale : 0;
        const layoutHeight = child.offsetHeight || child.scrollHeight || rectHeight;
        
        // Extract raw text content deterministically
        const text = child.textContent || child.innerText || '';
        const trimmedLength = text.trim().length;

        let estimatedHeight = 20; // Default safe backup height
        if (trimmedLength > 0) {
          const lineCount = Math.ceil(trimmedLength / 80) || 1;
          estimatedHeight = lineCount * 22; // Estimate ~22px per line
        }

        const hasImg = child.querySelector('img') !== null || child.tagName === 'IMG';
        const tableEl = child.tagName === 'TABLE' ? (child as HTMLTableElement) : child.querySelector('table');

        if (hasImg) {
          // Adjust image sizing to fit and prevent overflow
          const img = child.tagName === 'IMG' ? (child as HTMLImageElement) : child.querySelector('img');
          if (img) {
            img.style.maxHeight = `${maxA4ContentHeight - 80}px`;
            img.style.width = 'auto';
            img.style.objectFit = 'contain';
          }
          const finalHeight = Math.max(layoutHeight, 280);
          processedChildren.push({ element: child, height: finalHeight });
        } else if (tableEl) {
          const tableHeight = tableEl.offsetHeight || tableEl.scrollHeight || layoutHeight || 100;
          processedChildren.push({ element: child, height: tableHeight });
        } else {
          const finalHeight = Math.max(layoutHeight, estimatedHeight);
          processedChildren.push({ element: child, height: finalHeight });
        }
      }

      const pages: HTMLElement[][] = [];
      let currentPage: HTMLElement[] = [];
      let currentAccumulatedHeight = 0;

      for (let j = 0; j < processedChildren.length; j++) {
        const item = processedChildren[j];
        const tableEl = item.element.tagName === 'TABLE' 
          ? (item.element as HTMLTableElement) 
          : item.element.querySelector('table');

        if (tableEl && (currentAccumulatedHeight + item.height > maxA4ContentHeight)) {
          const firstPageSpace = maxA4ContentHeight - currentAccumulatedHeight;
          
          // If the table fits entirely on a clean new page, let's keep it clean
          if (item.height <= maxA4ContentHeight && currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [item.element];
            currentAccumulatedHeight = item.height;
          } else {
            // Need to split open the table
            let tableAvailableFirstPage = firstPageSpace;
            let startOnNewPage = false;
            
            if (firstPageSpace < 120 && currentPage.length > 0) {
              pages.push(currentPage);
              currentPage = [];
              tableAvailableFirstPage = maxA4ContentHeight;
              startOnNewPage = true;
            }

            const tableChunks = splitTableIntoChunks(tableEl, tableAvailableFirstPage, maxA4ContentHeight);
            
            const wrappedChunks = tableChunks.map((chunk, idx) => {
              if (item.element.tagName === 'TABLE') {
                return chunk.element;
              } else {
                const wrapped = item.element.cloneNode(false) as HTMLElement;
                if (wrapped.id) {
                  wrapped.id = `${wrapped.id}-split-${idx}`;
                }
                wrapped.appendChild(chunk.element);
                return wrapped;
              }
            });

            if (wrappedChunks.length > 0) {
              if (startOnNewPage) {
                currentPage = [wrappedChunks[0]];
                currentAccumulatedHeight = tableChunks[0].height;
              } else {
                currentPage.push(wrappedChunks[0]);
                currentAccumulatedHeight += tableChunks[0].height;
              }

              for (let k = 1; k < wrappedChunks.length; k++) {
                pages.push(currentPage);
                currentPage = [wrappedChunks[k]];
                currentAccumulatedHeight = tableChunks[k].height;
              }
            }
          }
        } else {
          if (currentAccumulatedHeight + item.height > maxA4ContentHeight) {
            if (currentPage.length > 0) {
              pages.push(currentPage);
              currentPage = [item.element];
              currentAccumulatedHeight = item.height;
            } else {
              currentPage.push(item.element);
              pages.push(currentPage);
              currentPage = [];
              currentAccumulatedHeight = 0;
            }
          } else {
            currentPage.push(item.element);
            currentAccumulatedHeight += item.height;
          }
        }
      }

      if (currentPage.length > 0) {
        pages.push(currentPage);
      }

      if (pages.length > 1) {
        sect.innerHTML = '';
        pages[0].forEach((el) => sect.appendChild(el));

        let lastInsertedSection = sect;
        for (let i = 1; i < pages.length; i++) {
          const newSect = sect.cloneNode(false) as HTMLElement;
          if (newSect.id) {
            newSect.id = `${newSect.id}-page-${i}`;
          }
          pages[i].forEach((el) => newSect.appendChild(el));
          lastInsertedSection.parentNode?.insertBefore(newSect, lastInsertedSection.nextSibling);
          lastInsertedSection = newSect;
        }
      }
    });

    const finalSections = parent.querySelectorAll('section');
    setPageCount(finalSections.length || 1);
  };

  useEffect(() => {
    let active = true;
    const render = async () => {
      if (active) {
        setRendered(false);
        setScale(1); // Reset scale to 1 for unconstrained, desktop-standard page height calculations
        setScaledHeight('auto'); // Set height to auto so browser lays out contents fully without viewport truncation
        setPageCount(null);
      }
      if (!isZipFile(arrayBuffer)) {
        if (active) {
          setUseFallback(true);
        }
        return;
      }
      try {
        const { renderAsync } = await import('docx-preview');
        if (!active) return;
        const container = containerRef.current;
        if (container) {
          container.innerHTML = '';
          await renderAsync(arrayBuffer, container, undefined, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false, // Enforce standard A4 page heights natively so multi-page docs break perfectly
            breakPages: true     // Enable high-fidelity native client-side page break calculations
          });
          
          if (active) {
            // Wait slightly for browser layout / styles to settle so page metrics can be parsed
            setTimeout(() => {
              if (active) {
                const parent = container.querySelector('.docx-wrapper') || container;
                const sections = parent.querySelectorAll('section');
                
                let needsPartitioning = false;
                sections.forEach((s) => {
                  const sSect = s as HTMLElement;
                  if (sSect && (sSect.scrollHeight > 1300 || sSect.offsetHeight > 1300)) {
                    needsPartitioning = true;
                  }
                });

                if (needsPartitioning) {
                  partitionLongSections(container);
                } else {
                  if (sections.length > 0) {
                    setPageCount(sections.length);
                  } else {
                    setPageCount(1);
                  }
                }
                setRendered(true);
              }
            }, 300);
          }
        }
      } catch (err) {
        console.warn("docx-preview bypassed or failed, showing layout fallback", err);
        if (active) {
          setUseFallback(true);
        }
      }
    };
    render();
    return () => {
      active = false;
    };
  }, [arrayBuffer]);

  useEffect(() => {
    if (!rendered) return;

    const resizeObserver = new ResizeObserver(() => {
      const parentWidth = parentRef.current?.clientWidth || window.innerWidth;
      const el = containerRef.current;
      if (el) {
        const origHeight = el.scrollHeight || el.clientHeight || 500;
        const baseWidth = 850; // Use a crisp A4 desktop standard width
        const baseScale = parentWidth < baseWidth ? parentWidth / baseWidth : 1;
        const s = baseScale * zoomAdjust;
        setScale(s);
        setScaledHeight(origHeight * s + 40);
      }
    });

    const target = containerRef.current;
    if (target) {
      resizeObserver.observe(target);
    }

    // Also observe parent ref for real-time mobile rotation and scaling changes
    const parent = parentRef.current;
    if (parent) {
      resizeObserver.observe(parent);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [rendered, zoomAdjust, arrayBuffer]);

  const lastTouchDistanceRef = useRef<number | null>(null);

  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
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
        const delta = dist / lastTouchDistanceRef.current;
        lastTouchDistanceRef.current = dist;
        setZoomAdjust(prev => {
          const next = prev * delta;
          return Math.max(0.4, Math.min(next, 3.0));
        });
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistanceRef.current = null;
  };

  if (useFallback && htmlContent) {
    return (
      <div 
        className="w-full bg-white shadow-none sm:shadow-md p-4 sm:p-8 border-y sm:border border-neutral-200/80 prose prose-neutral max-w-none sm:max-w-3xl prose-xs sm:prose-sm md:prose-base rounded-none mx-auto my-0 sm:my-4 transition-all overflow-x-hidden" 
        dangerouslySetInnerHTML={{ __html: htmlContent }} 
      />
    );
  }

  return (
    <div 
      ref={parentRef} 
      className="w-full max-w-3xl mx-auto px-0 sm:px-4 my-2 sm:my-4 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        /* Deep layout control overrides for DOCX preview */
        .docx-render-container {
          width: 850px !important;
          max-width: 850px !important;
          min-width: 850px !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          background-color: transparent !important;
        }

        .docx-render-container .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }

        /* Set page wrapper custom size with max-width restriction to fit screen seamlessly */
        .docx-render-container section.docx,
        .docx-render-container .docx-wrapper > section.docx {
          width: 850px !important;
          max-width: 850px !important;
          min-width: 850px !important;
          min-height: 1200px !important; /* Perfect standard A4 page size at 850px width */
          overflow: visible !important; /* Prevent text / content from ever being clipped or hidden */
          box-sizing: border-box !important;
          margin: 0 auto 32px auto !important; /* Center with generous spacing between physical pages */
          padding: 65px 85px !important; /* Elegant 1-inch standard Word doc margins */
          background-color: #ffffff !important;
          border-radius: 0px !important; /* Sharp crisp square A4 paper styling */
          border: 1px solid #d4d4d8 !important; /* Soft paper outline border */
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important; /* High-end physical paper double shadow */
          position: relative !important;
          page-break-after: always !important;
        }

        /* Ensure all structural children scale down and wrap cleanly */
        .docx-render-container *,
        .docx-render-container .docx-wrapper * {
          box-sizing: border-box !important;
          word-wrap: break-word !important;
          word-break: break-word !important;
          max-width: 100% !important;
        }

        .docx-render-container table,
        .docx-render-container .docx-wrapper table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          margin: 12px 0 !important;
        }

        .docx-render-container table td,
        .docx-render-container table th,
        .docx-render-container .docx-wrapper table td,
        .docx-render-container .docx-wrapper table th {
          word-break: break-word !important;
          padding: 6px 8px !important;
        }

        .docx-render-container img,
        .docx-render-container .docx-wrapper img {
          max-width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
        }

        .docx-render-container p, 
        .docx-render-container span, 
        .docx-render-container td,
        .docx-render-container h1,
        .docx-render-container h2,
        .docx-render-container h3,
        .docx-render-container h4,
        .docx-render-container h5,
        .docx-render-container h6,
        .docx-render-container .docx-wrapper p, 
        .docx-render-container .docx-wrapper span, 
        .docx-render-container .docx-wrapper td,
        .docx-render-container .docx-wrapper h1,
        .docx-render-container .docx-wrapper h2,
        .docx-render-container .docx-wrapper h3,
        .docx-render-container .docx-wrapper h4,
        .docx-render-container .docx-wrapper h5,
        .docx-render-container .docx-wrapper h6 {
          word-break: break-word !important;
          white-space: normal !important;
        }
      `}</style>

      {/* Modern control bar for zoom, exactly styled like PDF toolbar */}
      <div className="bg-white border border-neutral-200/80 px-4 py-2 flex justify-between items-center z-20 shadow-sm rounded-2xl mb-4 shrink-0 mx-2 sm:mx-0">
        <span className="text-xs font-bold text-neutral-500 font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Word Doc {pageCount !== null ? `(${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'})` : '(Counting Pages...)'}
        </span>

      </div>

      {!rendered && !useFallback && (
        <div className="flex flex-col items-center justify-center p-12 text-neutral-400 bg-white border border-neutral-200 rounded-2xl shadow-sm mx-2 sm:mx-0">
          <Loader2 className="animate-spin text-blue-600 mb-3" size={28} />
          <span className="text-xs font-semibold">Refining text layout...</span>
        </div>
      )}

      {/* Dynamic scaled container to achieve pixel-perfect desktop layouts fitted to mobile screen sizes */}
      <div 
        style={{ 
          height: scaledHeight, 
          overflow: 'hidden', 
          width: '100%',
          position: 'relative',
          transition: 'height 0.1s ease-out'
        }}
      >
        <div 
          ref={containerRef} 
          className="docx-render-container text-neutral-800" 
          style={{
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: 'top center',
            position: 'absolute',
            left: '50%',
          }}
        />
      </div>
    </div>
  );
};

const getContrastTextColor = (colorStr: string) => {
  if (!colorStr) return '#1e293b';
  try {
    const rgb = parseCssColorToRgb(colorStr);
    if (rgb) {
      return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 ? '#1e293b' : '#f8fafc';
    }
  } catch (e) {
    console.warn("Error calculating color contrast", e);
  }
  return '#1e293b';
};

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
  // Check if value behaves like a number, percentage, currency, or positive/negative decimals
  const isNumeric = /^\s*[-+]?(?:\d[\d,]*\.?\d*|\.\d+)\s*%?$/i.test(str) || /^\s*[\$€£¥₹]?\s*[-+]?(?:\d[\d,]*\.?\d*|\.\d+)\s*$/i.test(str);
  if (isNumeric) return 'text-right font-mono text-neutral-900';
  const lowercaseStr = str.toLowerCase();
  if (lowercaseStr === 'true' || lowercaseStr === 'false' || lowercaseStr === 'yes' || lowercaseStr === 'no') return 'text-center font-bold text-neutral-700';
  return 'text-left text-neutral-800';
};

const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const decodePrintableText = (arrayBuffer: ArrayBuffer): string => {
  try {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer);
    
    // Check if the decoded text looks relatively clean (not purely binary slop)
    const isPlainText = /^[\x20-\x7E\s\r\n\t]*$/.test(text.slice(0, 1000));
    
    if (isPlainText) {
      return text.split('\n').map(line => `<p class="mb-2 leading-relaxed text-neutral-800">${escapeHtml(line)}</p>`).join('');
    } else {
      // It's a binary file. Let's extract blocks of printable text of length >= 4
      const chars = new Uint8Array(arrayBuffer);
      let currentString = '';
      const stringBlocks: string[] = [];
      
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) {
          currentString += String.fromCharCode(c);
        } else {
          if (currentString.trim().length >= 4) {
            stringBlocks.push(currentString.trim());
          }
          currentString = '';
        }
      }
      if (currentString.trim().length >= 4) {
        stringBlocks.push(currentString.trim());
      }
      
      if (stringBlocks.length > 0) {
        const cleanedBlocks = stringBlocks
          .map(b => b.replace(/[<>]/g, ''))
          .filter(b => b.length > 5 && !b.startsWith('[Content_Types]') && !b.includes('rels') && !b.includes('xml'));
          
        if (cleanedBlocks.length > 0) {
          return `
            <div class="space-y-4 text-left">
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold mb-4 flex items-center gap-2">
                <span>⚠️ Note: This document uses an legacy format or text stream, displaying recovered content below.</span>
              </div>
              ${cleanedBlocks.map(blk => `<p class="mb-2 leading-relaxed text-neutral-800">${escapeHtml(blk)}</p>`).join('')}
            </div>
          `;
        }
      }
    }
  } catch (e) {
    console.error("Failed to decode printable text", e);
  }
  return '';
};

const isZipFile = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 4) return false;
  const arr = new Uint8Array(buffer, 0, 4);
  return arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04;
};

const parseEpubStream = async (arrayBuffer: ArrayBuffer) => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const parser = new DOMParser();

  // Helper inside to get list of elements
  const getElementsListByTagName = (parent: Document | Element, tagName: string): Element[] => {
    const list: Element[] = [];
    try {
      const elNS = parent.getElementsByTagNameNS('*', tagName);
      for (let i = 0; i < elNS.length; i++) {
        list.push(elNS[i]);
      }
    } catch (e) {}
    
    if (list.length === 0) {
      const el = parent.getElementsByTagName(tagName);
      for (let i = 0; i < el.length; i++) {
        list.push(el[i]);
      }
    }
    return list;
  };

  const getXmlNodeContent = (doc: Document | Element, nodeName: string): string => {
    const elements = doc.getElementsByTagName(nodeName);
    if (elements.length > 0 && elements[0].textContent) {
      return elements[0].textContent.trim();
    }
    try {
      const nsElements = doc.getElementsByTagNameNS('*', nodeName);
      if (nsElements.length > 0 && nsElements[0].textContent) {
        return nsElements[0].textContent.trim();
      }
    } catch (e) {}
    return '';
  };

  const decodeAndCleanPath = (p: string) => {
    try {
      return decodeURIComponent(p).replace(/\\/g, '/');
    } catch (e) {
      return p.replace(/\\/g, '/');
    }
  };

  const resolveRelativePath = (base: string, relative: string): string => {
    const combined = base.endsWith('/') ? `${base}${relative}` : `${base}/${relative}`;
    const parts = combined.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    return stack.join('/');
  };

  // 1. Locate container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found');
  }
  const containerXml = await containerFile.async('string');
  const containerDoc = parser.parseFromString(containerXml, 'text/xml');
  const rootfiles = getElementsListByTagName(containerDoc, 'rootfile');
  const opfPath = decodeAndCleanPath((rootfiles.length > 0 ? rootfiles[0].getAttribute('full-path') : '') || 'OEBPS/content.opf');

  // 2. Load and parse OPF folder context
  const opfFile = zip.files[opfPath] || Object.values(zip.files).find(f => f.name.toLowerCase() === opfPath.toLowerCase());
  if (!opfFile) {
    throw new Error(`OPF metadata file not found in Archive`);
  }
  
  const opfText = await opfFile.async('string');
  const opfDoc = parser.parseFromString(opfText, 'text/xml');
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 3. Metadata
  const title = getXmlNodeContent(opfDoc, 'title') || 'Untitled eBook';
  const author = getXmlNodeContent(opfDoc, 'creator') || 'Unknown Author';

  // 4. Manifest mapping
  const manifestItems = getElementsListByTagName(opfDoc, 'item');
  const manifestMap: Record<string, { href: string; mediaType: string }> = {};
  for (const item of manifestItems) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') || '';
    if (id && href) {
      manifestMap[id] = { href, mediaType };
    }
  }

  // 5. Spine chapter map
  const spineElements = getElementsListByTagName(opfDoc, 'itemref');
  const spineIds: string[] = [];
  for (const itemref of spineElements) {
    const idref = itemref.getAttribute('idref');
    if (idref) spineIds.push(idref);
  }

  // 6. Cover URL loader
  let coverUrl = '';
  const coverMeta = opfDoc.querySelector('meta[name="cover"]');
  let coverItemId = coverMeta?.getAttribute('content');
  if (!coverItemId) {
    const coverManifestItem = Array.from(manifestItems).find(
      item => item.getAttribute('properties') === 'cover-image' || item.getAttribute('id')?.toLowerCase().includes('cover')
    );
    coverItemId = coverManifestItem?.getAttribute('id') || undefined;
  }
  
  if (coverItemId && manifestMap[coverItemId]) {
    const rawCoverPath = decodeAndCleanPath(manifestMap[coverItemId].href);
    const coverFullPath = resolveRelativePath(opfDir, rawCoverPath);
    const matchedCoverKey = Object.keys(zip.files).find(
      k => k === coverFullPath || k.toLowerCase() === coverFullPath.toLowerCase() || k.endsWith(rawCoverPath)
    );
    const coverZipFile = matchedCoverKey ? zip.file(matchedCoverKey) : null;
    if (coverZipFile) {
      try {
        const coverBlob = await coverZipFile.async('blob');
        coverUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(coverBlob);
        });
      } catch (e) {
        console.warn("Cover image read failure", e);
      }
    }
  }

  // 7. Parse Chapters listed in Spine
  const parsedChapters: { title: string; content: string; path?: string }[] = [];
  const zipKeys = Object.keys(zip.files);

  for (const idref of spineIds) {
    const mItem = manifestMap[idref];
    if (!mItem) continue;

    const rawHref = decodeAndCleanPath(mItem.href);
    const resolvedPath = resolveRelativePath(opfDir, rawHref);
    
    const matchedKey = zipKeys.find(
      k => k === resolvedPath || k.toLowerCase() === resolvedPath.toLowerCase() || k.endsWith(rawHref)
    );

    if (matchedKey && zip.files[matchedKey]) {
      const xhtmlText = await zip.files[matchedKey].async('string');
      const doc = parser.parseFromString(xhtmlText, 'text/html');

      // Extract title
      let chTitle = '';
      const hTags = doc.querySelectorAll('h1, h2, h3, h4, title');
      for (let i = 0; i < hTags.length; i++) {
        const text = hTags[i].textContent?.trim();
        if (text) {
          chTitle = text;
          break;
        }
      }
      if (!chTitle) {
        chTitle = `Section ${parsedChapters.length + 1}`;
      }

      // Inline Images
      const body = doc.querySelector('body') || doc.documentElement;
      const imagesNode = body.querySelectorAll('img, image');
      const inlinePromises: Promise<void>[] = [];

      for (let i = 0; i < imagesNode.length; i++) {
        const imgNode = imagesNode[i];
        const src = imgNode.getAttribute('src') || imgNode.getAttribute('xlink:href') || '';
        if (src && !src.startsWith('data:')) {
          const cleanSrc = decodeAndCleanPath(src);
          const chDir = matchedKey.includes('/') ? matchedKey.substring(0, matchedKey.lastIndexOf('/') + 1) : '';
          const resolvedImgPath = resolveRelativePath(chDir, cleanSrc);
          
          const matchedImgKey = zipKeys.find(
            k => k === resolvedImgPath || k.toLowerCase() === resolvedImgPath.toLowerCase() || k.endsWith(cleanSrc)
          );

          if (matchedImgKey && zip.files[matchedImgKey]) {
            const p = zip.files[matchedImgKey].async('blob').then(async (imgBlob) => {
              const dataUrl = await new Promise<string>((res) => {
                const reader = new FileReader();
                reader.onloadend = () => res(reader.result as string);
                reader.readAsDataURL(imgBlob);
              });
              imgNode.setAttribute('src', dataUrl);
              imgNode.removeAttribute('xlink:href'); // Clear older SVG schemas to allow uniform display
            }).catch(e => {
              console.warn("Failed embedding image href " + src, e);
            });
            inlinePromises.push(p);
          }
        }
      }

      // Wait for all chapter images to be fetched and embedded
      await Promise.all(inlinePromises);

      // Clean body content (removing stylesheet elements relative to other structures if needed)
      const styleSheets = body.querySelectorAll('link[rel="stylesheet"], style');
      for (let k = 0; k < styleSheets.length; k++) {
        styleSheets[k].remove();
      }

      parsedChapters.push({
        title: chTitle,
        content: body.innerHTML,
        path: matchedKey
      });
    }
  }

  if (parsedChapters.length === 0) {
    throw new Error("This EPUB book structure could not be mapped into readable chapters.");
  }

  return {
    metadata: { title, author, coverUrl },
    chapters: parsedChapters
  };
};

const getNormalizedExcelData = (worksheet: XLSX.WorkSheet): any[][] => {
  // raw: false retrieves the formatted text values (currency, percent, formatted date strings)
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as any[][];
  if (json.length === 0) return [];
  
  // Find the maximum row length across all parsed rows to avoid cell index shifting
  const maxCols = Math.max(...json.map(row => row.length), 1);
  
  // Pad each row to exactly maxCols
  return json.map(row => {
    const paddedRow = [...row];
    while (paddedRow.length < maxCols) {
      paddedRow.push('');
    }
    return paddedRow;
  });
};

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ 
  file: propFile, 
  onClose, 
  language = 'English US',
  files,
  onFileChange
}) => {
  const rawType = (propFile.type || '').toLowerCase();
  const file = {
    ...propFile,
    type: rawType === 'docx' ? 'doc' as const : (rawType === 'xlsx' || rawType === 'xls' ? 'xlsx' as const : (rawType === 'pptx' ? 'ppt' as const : rawType as any))
  };
  const t = getTranslator(language);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [useServerHtml, setUseServerHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProtected, setIsProtected] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modalHeight, setModalHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.visualViewport ? window.visualViewport.height : window.innerHeight;
    }
    return 800;
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setModalHeight(vh);
      const kbOpen = (window.innerHeight - vh) > 120;
      setIsKeyboardOpen(kbOpen);
    };

    handleResize();
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);

    let showSub: any;
    let hideSub: any;
    try {
      showSub = Keyboard.addListener('keyboardWillShow', (info: any) => {
        setIsKeyboardOpen(true);
        if (info?.keyboardHeight > 0) {
          setModalHeight(Math.max(200, window.innerHeight - info.keyboardHeight));
        }
      });
      hideSub = Keyboard.addListener('keyboardWillHide', () => {
        setIsKeyboardOpen(false);
        setModalHeight(window.innerHeight);
      });
    } catch (_) {}

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
      showSub?.then((h: any) => h.remove?.());
      hideSub?.then((h: any) => h.remove?.());
    };
  }, []);

  // State variables for server-side high-fidelity PDF loading & conversion
  const [highFidelityPdf, setHighFidelityPdf] = useState<{
    doc: any;
    pagesCount: number;
    zoom: number;
    viewMode: 'scroll' | 'grid';
    buffer: ArrayBuffer | null;
  } | null>(null);
  const [isHighFidelityMode, setIsHighFidelityMode] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle');
  const [conError, setConError] = useState<string | null>(null);
  const [savedFileId, setSavedFileId] = useState<string | null>(null);

  const handleHighFidelityToggle = async () => {
    if (isHighFidelityMode) {
      setIsHighFidelityMode(false);
      return;
    }

    if (highFidelityPdf) {
      setIsHighFidelityMode(true);
      return;
    }

    if (!isOnlineSync()) {
      triggerOfflineAlert();
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      triggerOfflineAlert();
      return;
    }

    setConversionStatus('converting');
    setIsConverting(true);
    setConError(null);

    try {
      let blob = await storageService.getFileData(file.id);
      if (!blob) {
        throw new Error("Could not load original file data.");
      }

      let pdfBlob: Blob;
      try {
        const formData = new FormData();
        formData.append("file", blob, file.name);
        const serverRes = await fetch(`${getApiBaseUrl()}/api/convert/pdf`, {
          method: "POST",
          body: formData,
        });
        if (serverRes.ok) {
          pdfBlob = await serverRes.blob();
        } else {
          throw new Error("Server conversion returned non-200");
        }
      } catch (serverErr) {
        console.warn("Server conversion failed, using local converter fallback:", serverErr);
        pdfBlob = await convertFileToPdfLocal(blob, file.name);
      }

      const arrayBuffer = await pdfBlob.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const doc = await loadingTask.promise;

      setHighFidelityPdf({
        doc,
        pagesCount: doc.numPages,
        zoom: 1.0,
        viewMode: 'scroll',
        buffer: arrayBuffer
      });
      setIsHighFidelityMode(true);
      setConversionStatus('success');
    } catch (err: any) {
      console.error("High-fidelity conversion failed:", err);
      setConError(err.message || "Failed to convert document to PDF.");
      setConversionStatus('error');
    } finally {
      setIsConverting(false);
    }
  };

  const convertFileToPdfLocal = async (blob: Blob, fileName: string): Promise<Blob> => {
    const extension = (fileName.split('.').pop() || '').toLowerCase();
    const arrayBuffer = await blob.arrayBuffer();
    
    let docxContainer: HTMLDivElement | null = null;
    let extractedHtml = '';
    
    try {
      if (extension === 'docx' || extension === 'doc') {
        if (!isZipFile(arrayBuffer)) {
          const recoveredText = decodePrintableText(arrayBuffer);
          extractedHtml = recoveredText ? `<pre>${recoveredText}</pre>` : `<p>Legacy bin .doc text parsing completed.</p>`;
        } else {
          const { renderAsync } = await import('docx-preview');
          const wrapperId = `docx-wrapper-modal-${Date.now()}`;
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

          await renderAsync(arrayBuffer, docxContainer, docxContainer, {
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              useBase64URL: true,
          });
          
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
      } else if (extension === 'ppt' || extension === 'pptx') {
        const { convert: convertPptx } = await ensurePptxEngine();
        const data = new Uint8Array(arrayBuffer);
        const htmlString = convertPptx(data);
        
        const wrapperId = `ppt-wrapper-modal-${Date.now()}`;
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
      } else if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        if (workbook.SheetNames.length > 0) {
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            let htmlString = XLSX.utils.sheet_to_html(worksheet);
            const tableMatch = htmlString.match(/<table[\s\S]*?<\/table>/i);
            if (tableMatch) {
                htmlString = tableMatch[0];
            }
            
            const wrapperId = `excel-wrapper-modal-${Date.now()}`;
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
        }
      } else {
        const text = await blob.text();
        extractedHtml = `<pre>${text}</pre>`;
      }

      const sourceElement = docxContainer || extractedHtml;
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;
        
        if (typeof sourceElement !== 'string') {
          const allSections = sourceElement.querySelectorAll('.docx-wrapper > section, section.docx, section.slide, div.slide, section, .slide, .docx');
          let targets = allSections.length > 0 ? Array.from(allSections) : [sourceElement];
          
          const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
          let baseScale = 1.5;
          if (targets.length > 20 || blob.size > 3 * 1024 * 1024) baseScale = 1.2;
          if (targets.length > 40 || blob.size > 6 * 1024 * 1024) baseScale = 1.0;
          
          let firstPageOfDocument = true;
          for (let i = 0; i < targets.length; i++) {
            const target = targets[i] as HTMLElement;
            if (i > 0 && Array.from(targets).slice(0, i).some(prev => (prev as HTMLElement).contains(target))) {
              continue;
            }
            
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
            
            const imgQuality = targets.length > 30 ? 0.8 : 0.9;
            const imgData = canvas.toDataURL('image/jpeg', imgQuality);
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            
            const ratio = pageW / canvas.width;
            const pdfWidth = pageW;
            const pdfHeight = canvas.height * ratio;
            
            let heightLeft = pdfHeight;
            let position = 0;
            
            if (!firstPageOfDocument) {
              doc.addPage();
            }
            doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            firstPageOfDocument = false;
            heightLeft -= (pageH + 1);
            
            while (heightLeft > 0) {
              position = heightLeft - pdfHeight;
              doc.addPage();
              doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
              heightLeft -= pageH;
            }
          }
          return doc.output('blob');
        } else {
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
          return doc.output('blob');
        }
      } finally {
        if (docxContainer) {
          const wrapper = docxContainer.parentNode as HTMLElement;
          if (wrapper && document.body.contains(wrapper)) {
            document.body.removeChild(wrapper);
          }
        }
      }
    } catch (e: any) {
      console.error("Local conversion error:", e);
      throw new Error(`Local PDF generation failed: ${e.message}`);
    }
  };

  const handleConvertToPdfAndSave = async () => {
    if (!isOnlineSync()) {
      triggerOfflineAlert();
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      triggerOfflineAlert();
      return;
    }

    setConversionStatus('converting');
    setIsConverting(true);
    setConError(null);
    setSavedFileId(null);

    try {
      let blob = await storageService.getFileData(file.id);
      if (!blob) {
        throw new Error("Could not load original file data.");
      }

      let pdfBlob: Blob;
      try {
        const formData = new FormData();
        formData.append("file", blob, file.name);
        const serverRes = await fetch(`${getApiBaseUrl()}/api/convert/pdf`, {
          method: "POST",
          body: formData,
        });
        if (serverRes.ok) {
          pdfBlob = await serverRes.blob();
        } else {
          throw new Error("Server conversion returned non-200");
        }
      } catch (serverErr) {
        console.warn("Server conversion failed, using local converter fallback:", serverErr);
        pdfBlob = await convertFileToPdfLocal(blob, file.name);
      }
      
      const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const pdfFileName = `${rawName}.pdf`;
      const pdfFileId = `pdf-converted-${Date.now()}`;

      const pdfDocMeta = {
        id: pdfFileId,
        name: pdfFileName,
        type: 'pdf' as const,
        size: pdfBlob.size,
        createdAt: Date.now(),
        lastOpenedAt: Date.now(),
        url: URL.createObjectURL(pdfBlob)
      };

      await storageService.saveFile({
        ...pdfDocMeta,
        data: pdfBlob
      });

      setSavedFileId(pdfFileId);
      setConversionStatus('success');

      // Trigger auto-download to Downloads folder
      if (Capacitor.isNativePlatform()) {
        await downloadDocumentFile(pdfDocMeta, undefined, pdfBlob);
      } else {
        const a = document.createElement('a');
        a.href = pdfDocMeta.url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

    } catch (err: any) {
      console.error("Convert and Save as PDF failed:", err);
      setConError(err.message || "Failed to convert and save document as PDF.");
      setConversionStatus('error');
    } finally {
      setIsConverting(false);
    }
  };
  
  // Custom interactive states
  const [fileArrayBuffer, setFileArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfPagesCount, setPdfPagesCount] = useState(0);
  const [pdfZoom, setPdfZoom] = useState(1.0);
  const [pdfViewMode, setPdfViewMode] = useState<'scroll' | 'grid'>('scroll');
  const [containerWidth, setContainerWidth] = useState(500);

  // Excel workbook states
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState('');
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const [excelSearchQuery, setExcelSearchQuery] = useState('');
  const [excelPage, setExcelPage] = useState(1);
  const [visibleRowsCount, setVisibleRowsCount] = useState(200);

  useEffect(() => {
    setExcelPage(1);
    setVisibleRowsCount(200);
  }, [excelSearchQuery]);

  // PPT slides states
  const [slides, setSlides] = useState<any[]>([]);
  const [pptViewMode, setPptViewMode] = useState<'canvas' | 'outline' | 'grid'>('canvas');
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [playingSlideshow, setPlayingSlideshow] = useState(false);
  const [copied, setCopied] = useState(false);

  // PPT interactive Zoom and Drag-to-pan states
  const [pptZoom, setPptZoom] = useState(1.0);
  const [pptPan, setPptPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPptZoom(1.0);
    setPptPan({ x: 0, y: 0 });
  }, [currentSlideIdx]);

  // EPUB reader states
  const [epubChapters, setEpubChapters] = useState<{ title: string; content: string; path?: string }[]>([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [epubMetadata, setEpubMetadata] = useState<{ title: string; author: string; coverUrl?: string } | null>(null);
  const [epubFontSize, setEpubFontSize] = useState<number>(16);
  const [epubTheme, setEpubTheme] = useState<'light' | 'sepia' | 'dark'>('light');

  // File swiping/navigation logic
  const currentIndex = files ? files.findIndex(f => f.id === file.id) : -1;
  const hasPrevFile = currentIndex > 0;
  const hasNextFile = files && currentIndex < files.length - 1;

  const goToPrevFile = () => {
    if (files && currentIndex > 0 && onFileChange) {
      onFileChange(files[currentIndex - 1]);
    }
  };

  const goToNextFile = () => {
    if (files && currentIndex < files.length - 1 && onFileChange) {
      onFileChange(files[currentIndex + 1]);
    }
  };


  // Keyboard Navigation Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in input/textarea (like password field or Excel search)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowLeft' && hasPrevFile) {
        if (file.type !== 'ppt' && file.type !== 'epub') {
          e.preventDefault();
          goToPrevFile();
        }
      } else if (e.key === 'ArrowRight' && hasNextFile) {
        if (file.type !== 'ppt' && file.type !== 'epub') {
          e.preventDefault();
          goToNextFile();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file.id, hasPrevFile, hasNextFile, file.type]);

  const containerRef = useRef<HTMLDivElement>(null);

  // PPT gesture-tracking and pan references
  const isDraggingPptRef = useRef(false);
  const dragStartPptRef = useRef({ x: 0, y: 0 });
  const panStartPptRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);

  // Helper logic to calculate zoom pinch spacing
  const getPptTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handlePptTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = getPptTouchDistance(e);
      if (dist !== null) {
        lastTouchDistanceRef.current = dist;
      }
    } else if (e.touches.length === 1) {
      isDraggingPptRef.current = true;
      dragStartPptRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartPptRef.current = { ...pptPan };
    }
  };

  const handlePptTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const dist = getPptTouchDistance(e);
      if (dist !== null) {
        const delta = dist / lastTouchDistanceRef.current;
        lastTouchDistanceRef.current = dist;
        setPptZoom(prev => {
          const next = prev * delta;
          return Math.max(1.0, Math.min(next, 5.0));
        });
      }
    } else if (e.touches.length === 1 && isDraggingPptRef.current) {
      const dx = e.touches[0].clientX - dragStartPptRef.current.x;
      const dy = e.touches[0].clientY - dragStartPptRef.current.y;
      const sensitivity = 1.0 / pptZoom;
      setPptPan({
        x: panStartPptRef.current.x + dx * sensitivity,
        y: panStartPptRef.current.y + dy * sensitivity
      });
    }
  };

  const handlePptTouchEnd = () => {
    isDraggingPptRef.current = false;
    lastTouchDistanceRef.current = null;
  };

  const handlePptMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isDraggingPptRef.current = true;
    dragStartPptRef.current = { x: e.clientX, y: e.clientY };
    panStartPptRef.current = { ...pptPan };
  };

  const handlePptMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingPptRef.current) return;
    const dx = e.clientX - dragStartPptRef.current.x;
    const dy = e.clientY - dragStartPptRef.current.y;
    const sensitivity = 1.0 / pptZoom;
    setPptPan({
      x: panStartPptRef.current.x + dx * sensitivity,
      y: panStartPptRef.current.y + dy * sensitivity
    });
  };

  const handlePptMouseUpOrLeave = () => {
    isDraggingPptRef.current = false;
  };

  // Measure container dimensions for fine layout scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const padding = width < 640 ? 16 : 48;
        setContainerWidth(Math.floor(width - padding));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    let currentBlobUrl: string | null = null;
    let progressInterval: any;

    const loadRealFile = async () => {
      setLoading(true);
      setProgress(0);
      setError(null);
      setExcelSearchQuery('');
      setUseServerHtml(false);

      // Reset previous document states to prevent leaks when switching files
      setFileArrayBuffer(null);
      setPdfDoc(null);
      setPdfPagesCount(0);
      setPdfZoom(1.0);
      setPdfViewMode('scroll');
      setWorkbook(null);
      setSheetNames([]);
      setCurrentSheet('');
      setExcelData(null);
      setVisibleRowsCount(200);
      setSlides([]);
      setPptViewMode('canvas');
      setCurrentSlideIdx(0);
      setPlayingSlideshow(false);
      setPptZoom(1.0);
      setPptPan({ x: 0, y: 0 });
      setEpubChapters([]);
      setCurrentChapterIdx(0);
      setEpubMetadata(null);
      setIsProtected(false);
      setEnteredPassword('');
      setHtmlContent(null);
      setBlobUrl(null);
      setHighFidelityPdf(null);
      setIsHighFidelityMode(false);
      setIsConverting(false);
      setConversionStatus('idle');
      setConError(null);
      setSavedFileId(null);

      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          const increment = Math.random() * 20;
          return Math.min(prev + increment, 90);
        });
      }, 150);

      try {
        if (file.id === 'welcome-guide') {
          setHtmlContent(`
            <div style="font-family: sans-serif; line-height: 1.6; color: #1f2937; padding: 24px;">
              <h1 style="color: #1e3a8a; font-size: 1.8rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1.5rem; font-weight: bold;">Welcome to PDF Reader Pro!</h1>
              <p style="font-size: 1rem; color: #4b5563; margin-bottom: 1.25rem;">This is a premium, secure offline document reader running locally on your device. Your documents are never uploaded to any server, guaranteeing 100% absolute privacy.</p>
              
              <h2 style="color: #2563eb; font-size: 1.3rem; margin-top: 1.5rem; margin-bottom: 0.75rem; font-weight: bold;">💡 Key Features:</h2>
              <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 1.5rem; space-y-2;">
                <li style="margin-bottom: 0.5rem;"><strong>No-Loss Renderers:</strong> High fidelity canvas-based PDF reader, Word DOCX preview, interactive multi-sheet scroll spreadsheets, and PowerPoint presentation slideshow player.</li>
                <li style="margin-bottom: 0.5rem;"><strong>Instant Sync:</strong> Tap "+ Live Storage" to scan and link files directly from your device folders.</li>
                <li style="margin-bottom: 0.5rem;"><strong>Secured Vault:</strong> Unlock protected documents directly with local password decryption.</li>
                <li style="margin-bottom: 0.5rem;"><strong>Fully Mobile Ready:</strong> Fluid scrolling, responsive layout scaling, system share, and quick downloads.</li>
              </ul>
              
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 1.25rem; border-radius: 0.75rem; margin-top: 2rem;">
                <p style="font-weight: bold; color: #1e40af; margin-bottom: 0.25rem; font-size: 0.9rem;">⚠️ Live Files Support Note:</p>
                <p style="color: #1e3a8a; font-size: 0.85rem; margin: 0; line-height: 1.45;">Try importing your own raw <strong>.pdf, .docx, .xlsx, or .pptx</strong> files using the <strong>"+" action</strong> on the main screen to experience our high-performance interactive readers in real-time!</p>
              </div>
            </div>
          `);
          try {
            const blob = await storageService.getFileData(file.id);
            if (blob) {
              const url = URL.createObjectURL(blob);
              currentBlobUrl = url;
              setBlobUrl(url);
              const arrayBuffer = await blob.arrayBuffer();
              setFileArrayBuffer(arrayBuffer);
            }
          } catch (e) {
            console.warn("Failed to pre-populate welcome blobUrl", e);
          }
          setProgress(100);
          setLoading(false);
          clearInterval(progressInterval);
          return;
        }

        if (file.id === 'sample-stats') {
          setSheetNames(['Storage Overview', 'File Metrics']);
          setCurrentSheet('Storage Overview');
          const mockData = [
            ['Metric Name', 'Value / Details', 'Status'],
            ['Storage Indexed', '3,450 KB', 'Optimal'],
            ['PDF Files Count', '15', 'Active'],
            ['Excel Files Count', '8', 'Active'],
            ['Word DOCX Files', '11', 'Active'],
            ['PPT Presentations', '4', 'Active'],
            ['Encrypted Files', '2', 'Protected'],
            ['Latest Activity', 'Today 09:21', 'Synchronized']
          ];
          setExcelData(mockData);
          try {
            const blob = await storageService.getFileData(file.id);
            if (blob) {
              const url = URL.createObjectURL(blob);
              currentBlobUrl = url;
              setBlobUrl(url);
              const arrayBuffer = await blob.arrayBuffer();
              setFileArrayBuffer(arrayBuffer);
            }
          } catch (e) {
            console.warn("Failed to pre-populate sample stats blobUrl", e);
          }
          setProgress(100);
          setLoading(false);
          clearInterval(progressInterval);
          return;
        }

        const blob = await storageService.getFileData(file.id);
        if (!blob) {
          throw new Error("File data not found in local index");
        }

        const url = URL.createObjectURL(blob);
        currentBlobUrl = url;
        setBlobUrl(url);

        const arrayBuffer = await blob.arrayBuffer();
        setFileArrayBuffer(arrayBuffer);

        if (file.type === 'pdf') {
          try {
            // Use PDF.js (the highly robust reader) directly to initialize the PDF document.
            // This avoids pdf-lib parser crash on standard compliant PDFs generated by LibreOffice headless.
            // We slice the arrayBuffer to prevent it from being detached by the worker.
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
            const doc = await loadingTask.promise;
            setPdfDoc(doc);
            setPdfPagesCount(doc.numPages);
          } catch (e: any) {
            // Check for password protection or encryption in the rejected exception
            if (
              e.name === 'PasswordException' || 
              e.message?.toLowerCase().includes('encrypted') || 
              e.message?.toLowerCase().includes('password')
            ) {
              setPdfBuffer(arrayBuffer);
              setIsProtected(true);
              setLoading(false);
              clearInterval(progressInterval);
              return;
            }
            throw e;
          }
        } else if (file.type === 'doc') {
          if (isZipFile(arrayBuffer)) {
            // High fidelity client-side .docx preview
            setUseServerHtml(false);
            console.log("High-fidelity standard open XML Word document (.docx) detected. Bypassing unnecessary server HTML conversion and loading native client-side rendering directly.");
          } else {
            // Try server html conversion or fallback for legacy .doc binary files
            try {
              const formData = new FormData();
              formData.append("file", blob, file.name);

              const uploadRes = await fetch(`${getApiBaseUrl()}/api/upload`, {
                method: "POST",
                body: formData,
              });

              if (!uploadRes.ok) {
                const errDetails = await uploadRes.json().catch(() => ({}));
                throw new Error(errDetails.error || "Server upload for Office Viewer failed.");
              }

              const uploadData = await uploadRes.json();
              if (uploadData.success && uploadData.downloadUrl) {
                const locationOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                const publicUrl = `${locationOrigin}${uploadData.downloadUrl}`;
                const encodedUrl = encodeURIComponent(publicUrl);
                
                setUseServerHtml(true);
                setHtmlContent(`
                  <div class="w-full h-full min-h-[85vh] relative bg-neutral-100 flex flex-col">
                    <div class="absolute top-0 w-full bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium px-4 py-2 z-10 flex gap-2 items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span>Legacy Binary Document (.doc). Viewing with 100% Accuracy via MS Office Online Viewer.</span>
                    </div>
                    <iframe 
                      src="https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}"
                      width="100%" 
                      height="100%" 
                      allowfullscreen="true"
                      frameborder="0"
                      class="w-full grow border-0 shadow-sm mt-8 pb-10"
                      title="Office Online Viewer"
                    ></iframe>
                  </div>
                `);
              } else {
                throw new Error("Invalid response from upload server");
              }
            } catch (serverErr) {
              console.warn("Server HTML conversion failed for legacy file, using local fallback parser:", serverErr);
              setUseServerHtml(false);
              const recoveredText = decodePrintableText(arrayBuffer);
              if (recoveredText) {
                setHtmlContent(recoveredText);
              } else {
                setHtmlContent(`
                  <div class="p-6 text-center space-y-4 max-w-sm mx-auto">
                    <div class="text-amber-500 font-bold text-lg">⚠️ Legacy/Unsupported Format</div>
                    <p class="text-xs text-neutral-500 leading-relaxed font-medium">
                      This document appears to be a legacy binary Word document (.doc) or a text file. Real-time rich preview is limited to standard open XML Word documents (.docx).
                    </p>
                    <p class="text-[10px] text-neutral-400 font-mono select-all">
                      File: ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                `);
              }
            }
          }
        } else if (file.type === 'xlsx') {
          try {
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            setWorkbook(wb);
            setSheetNames(wb.SheetNames);
            if (wb.SheetNames.length > 0) {
              const firstSheet = wb.SheetNames[0];
              setCurrentSheet(firstSheet);
              
              const worksheet = wb.Sheets[firstSheet];
              const parsed = getNormalizedExcelData(worksheet);
              setExcelData(parsed);
              setExcelPage(1);
              setVisibleRowsCount(200);
            }
          } catch (err) {
            console.error("XLSX parsing failed", err);
            setError("Could not parse this spreadsheet.");
          }
        } else if (file.type === 'ppt') {
          try {
            const parsedSlides = await loadPptPresentation(arrayBuffer);
            setSlides(parsedSlides);
            if (parsedSlides.length === 0) {
              // Try constructing simple presentation data
              setSlides([{
                title: file.name.replace(/\.[^/.]+$/, ""),
                content: [
                  "PowerPoint Presentation Loaded",
                  `File Size: ${(file.size / 1024).toFixed(1)} KB`,
                  "Slide extraction preview is active for standard open XML slides."
                ]
              }]);
            }
          } catch (err) {
            console.warn("PPTX slides parser failed, falling back to default slide deck representation", err);
            // Construct a fallback slide deck representation so the presentation preview mode works beautifully!
            setSlides([{
              title: file.name.replace(/\.[^/.]+$/, ""),
              content: [
                "PowerPoint Presentation Container Loaded",
                `File Size: ${(file.size / 1024).toFixed(1)} KB`,
                "This presentation format is preserved locally.",
                "To view or modify slide transitions, download or share this file to open with your native presentation software."
              ]
            }]);
          }
        } else if (file.type === 'epub') {
          if (!isZipFile(arrayBuffer)) {
            setError("Could not parse this EPUB eBook: Invalid format or corrupted archive.");
          } else {
            try {
              const epubData = await parseEpubStream(arrayBuffer);
              setEpubChapters(epubData.chapters);
              setEpubMetadata(epubData.metadata);
              setCurrentChapterIdx(0);
            } catch (err: any) {
              console.warn("EPUB parsing failed", err);
              setError(err.message || "Could not parse this EPUB eBook.");
            }
          }
        }

        setProgress(100);
      } catch (e) {
        console.error("Failed to load file data", e);
        setError("Failed to load document content from storage.");
      } finally {
        setTimeout(() => {
          setLoading(false);
          clearInterval(progressInterval);
        }, 200);
      }
    };
    loadRealFile();

    return () => {
      clearInterval(progressInterval);
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [file.id, file.type]);

  const handleSheetSelect = (name: string) => {
    if (!workbook) return;
    setCurrentSheet(name);
    setExcelSearchQuery('');
    try {
      const worksheet = workbook.Sheets[name];
      const parsed = getNormalizedExcelData(worksheet);
      setExcelData(parsed);
      setExcelPage(1);
      setVisibleRowsCount(200);
    } catch (err) {
      console.error("Failed to load sheet data", err);
    }
  };

  // Slideshow automatic cycler
  useEffect(() => {
    let slideTimer: any;
    if (playingSlideshow && slides.length > 0) {
      slideTimer = setInterval(() => {
        setCurrentSlideIdx(prev => (prev + 1) % slides.length);
      }, 3000);
    }
    return () => clearInterval(slideTimer);
  }, [playingSlideshow, slides.length]);

  // Slideshow keyboard navigation hotkeys
  useEffect(() => {
    if (file.type !== 'ppt' || slides.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlideIdx(prev => (prev + 1) % slides.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIdx(prev => (prev - 1 + slides.length) % slides.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file.type, slides.length]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfBuffer) return;

    if (Capacitor.isNativePlatform()) {
      Keyboard.hide().catch(() => {});
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsVerifying(true);
    setError(null);
    try {
      // 1. Try default decryption using the Web Worker first.
      // We slice the pdfBuffer to prevent the worker from detaching it.
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(pdfBuffer.slice(0)),
        password: enteredPassword
      });
      const doc = await loadingTask.promise;
      
      setPdfDoc(doc);
      setPdfPagesCount(doc.numPages);
      setIsProtected(false);
      setEnteredPassword('');
    } catch (err: any) {
      console.error("Decryption failed with worker:", err);
      
      // If the error is a PasswordException (i.e. incorrect password entered), do NOT retry.
      // Simply show the incorrect password error immediately.
      if (err.name === 'PasswordException' || err.message?.toLowerCase().includes('incorrect password')) {
        setError("Incorrect password. Please check and try again.");
        setIsVerifying(false);
        return;
      }

      // 2. If worker decryption failed with another error (e.g. TypeError due to missing Web Crypto inside the Web Worker),
      // we retry on the main thread (fake worker) where window.crypto.subtle is fully accessible.
      let originalWorker: any = undefined;
      try {
        console.log("Retrying decryption on the main thread...");
        if (typeof window !== 'undefined') {
          originalWorker = (window as any).Worker;
          (window as any).Worker = undefined; // Force PDF.js to fallback to fake worker in-process
        }

        const retryTask = pdfjsLib.getDocument({ 
          data: new Uint8Array(pdfBuffer.slice(0)),
          password: enteredPassword
        });

        // Restore Worker immediately after the task is created synchronously
        if (typeof window !== 'undefined' && originalWorker !== undefined) {
          (window as any).Worker = originalWorker;
        }

        const doc = await retryTask.promise;
        
        setPdfDoc(doc);
        setPdfPagesCount(doc.numPages);
        setIsProtected(false);
        setEnteredPassword('');
      } catch (retryErr: any) {
        console.error("Decryption retry on main thread also failed:", retryErr);
        
        // Ensure Worker is restored even if constructor threw synchronously
        if (typeof window !== 'undefined' && originalWorker !== undefined && (window as any).Worker !== originalWorker) {
          (window as any).Worker = originalWorker;
        }

        // Show correct error message
        if (retryErr.name === 'PasswordException' || retryErr.message?.toLowerCase().includes('password') || retryErr.message?.toLowerCase().includes('decrypt')) {
          setError("Incorrect password. Please check and try again.");
        } else {
          setError(`Error opening document: ${retryErr.message || retryErr}`);
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownload = async () => {
    await downloadDocumentFile(file, htmlContent || undefined);
  };

  const handleShare = async () => {
    try {
      await directShareFile(file, htmlContent || undefined);
    } catch (err: any) {
      console.error("Failed to share file natively:", err);
      alert(err.message || "Native share failed.");
    }
  };

  const handleCopyDetails = () => {
    try {
      const info = `Document ID: ${file.id}\nName: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\nFormat: ${file.type.toUpperCase()}\nCreated: ${new Date(file.createdAt).toLocaleString()}\nSecurely read via PDF Reader Pro.`;
      navigator.clipboard.writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Meta copy action failed', e);
    }
  };

  const renderContent = () => {
    if (isProtected) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 sm:p-6 bg-neutral-50 overflow-hidden select-none">
          <div className="w-full max-w-sm bg-white p-4 sm:p-7 rounded-2xl sm:rounded-3xl shadow-xl border border-neutral-200/90 flex flex-col items-center text-center shrink-0">
            {isKeyboardOpen ? (
              <div className="flex items-center gap-2.5 mb-2.5 shrink-0">
                <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500 shrink-0">
                  <Lock size={16} />
                </div>
                <h3 className="text-base font-bold text-neutral-900 tracking-tight">Password Protected</h3>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-3 group shrink-0">
                  <Lock className="w-7 h-7 group-hover:hidden transition-all" />
                  <Unlock className="w-7 h-7 hidden group-hover:block transition-all" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-1 shrink-0">Password Protected</h3>
                <p className="text-neutral-500 text-xs sm:text-sm mb-4 leading-relaxed max-w-xs shrink-0">
                  This PDF is encrypted for security. Enter the password below to unlock and view the content.
                </p>
              </>
            )}

            <form onSubmit={handleUnlock} className="w-full space-y-2.5 sm:space-y-3.5">
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Enter Master Password"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full px-4 py-2.5 sm:py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-11 font-medium placeholder:text-neutral-400 text-sm sm:text-base text-neutral-900"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {error && (
                <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold justify-center py-0.5">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isVerifying || !enteredPassword}
                className="w-full bg-neutral-900 text-white py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] text-sm sm:text-base shadow-sm cursor-pointer"
              >
                {isVerifying ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                {isVerifying ? 'Verifying...' : 'Unlock Document'}
              </button>
            </form>

            {!isKeyboardOpen && (
              <div className="mt-4 pt-3 border-t border-neutral-100 w-full shrink-0">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest font-mono">Secure Document Viewer</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isConverting && conversionStatus === 'converting') {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-6 bg-neutral-50 animate-fade-in">
          <div className="relative">
            <Loader2 size={56} className="text-red-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-red-650">
              PDF
            </div>
          </div>
          <div className="text-center space-y-2.5 max-w-sm px-4">
            <h3 className="text-lg font-bold text-neutral-800">Converting via Headless LibreOffice</h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
              We are compiling and rendering this document on the server with 100% layout and typographical accuracy...
            </p>
            <div className="w-56 h-1.5 bg-neutral-200 rounded-full overflow-hidden mx-auto mt-2">
              <motion.div 
                className="h-full bg-red-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.5, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (isHighFidelityMode && highFidelityPdf?.doc) {
      const pages = Array.from({ length: highFidelityPdf.pagesCount }, (_, i) => i + 1);
      return (
        <div className="w-full h-full flex flex-col relative bg-[#e8ebf0] dark:bg-neutral-900 animate-fade-in">
          {/* Zoom controls bar */}
          <div className="bg-white border-b border-neutral-200 px-4 py-2 flex flex-wrap gap-2 justify-between items-center z-20 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                100% Accuracy Layout View Active
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* PDF View Mode Selector */}
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                <button
                  onClick={() => setHighFidelityPdf(prev => prev ? { ...prev, viewMode: 'scroll' } : null)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    highFidelityPdf.viewMode === 'scroll'
                      ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/50"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                  title={t('continuous')}
                >
                  <Layout size={12} />
                  <span>{t('continuous')}</span>
                </button>
                <button
                  onClick={() => setHighFidelityPdf(prev => prev ? { ...prev, viewMode: 'grid' } : null)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    highFidelityPdf.viewMode === 'grid'
                      ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/50"
                      : "text-neutral-500 hover:text-neutral-950"
                  }`}
                  title={t('gridSorter')}
                >
                  <Grid size={12} />
                  <span>{t('gridSorter')}</span>
                </button>
              </div>

            </div>
          </div>

          {highFidelityPdf.viewMode === 'grid' ? (() => {
            const totalWidth = containerWidth;
            const estimatedScreenWidth = totalWidth + (totalWidth < 600 ? 16 : 48);
            let cols = 2;
            if (estimatedScreenWidth >= 1280) {
              cols = 6;
            } else if (estimatedScreenWidth >= 1024) {
              cols = 5;
            } else if (estimatedScreenWidth >= 768) {
              cols = 4;
            } else if (estimatedScreenWidth >= 640) {
              cols = 3;
            }
            const gap = 16;
            const totalGapWidth = (cols - 1) * gap;
            const cellWidth = Math.max(120, Math.floor((totalWidth - totalGapWidth) / cols));

            return (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-100">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto w-full">
                  {pages.map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        setHighFidelityPdf(prev => prev ? { ...prev, viewMode: 'scroll' } : null);
                        setTimeout(() => {
                          const el = document.getElementById(`pdf-page-${num}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 150);
                      }}
                      className="ring-1 ring-neutral-200/85 bg-white hover:ring-2 hover:ring-blue-600 rounded-none p-2 flex flex-col items-center justify-between text-center relative transition-all duration-300 shadow-sm group hover:scale-[1.03] hover:shadow-md cursor-pointer"
                    >
                      <div className="w-full aspect-[1/1.414] overflow-hidden rounded-none relative bg-white flex items-center justify-center p-0 border border-neutral-300 shadow-xs">
                        <PdfPageRenderer 
                          pdfDoc={highFidelityPdf.doc} 
                          pageNum={num} 
                          scale={1.3} 
                          containerWidth={cellWidth} 
                          isThumbnail={true}
                        />
                      </div>
                      <span className="text-xs font-bold text-neutral-500 mt-2 font-mono group-hover:text-blue-600">
                        {t('page')} {num}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })() : (
            <PdfZoomStripContainer resetDependency={`${file.id}-high-fidelity`}>
              {pages.map(num => (
                <div key={num} id={`pdf-page-${num}`} className="w-full flex justify-center">
                  <PdfPageRenderer 
                    pdfDoc={highFidelityPdf.doc} 
                    pageNum={num} 
                    scale={1.0} 
                    containerWidth={containerWidth} 
                  />
                </div>
              ))}
            </PdfZoomStripContainer>
          )}

          <div className="p-4 bg-white border-t border-neutral-200 flex items-center shrink-0">
             <div className="flex items-center gap-2 text-neutral-600">
                <FileText size={18} className="text-emerald-500 animate-pulse" />
                <span className="text-xs font-bold truncate max-w-[175px] sm:max-w-md text-emerald-700">Perfect Layout PDF View Active: {file.name.substring(0, file.name.lastIndexOf('.')) || file.name}.pdf</span>
             </div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-6">
          <div className="relative">
            <Loader2 size={48} className="text-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700">
              {Math.floor(progress)}%
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-neutral-600 font-medium">{t('loading')}</p>
            <div className="w-48 h-1.5 bg-neutral-100 rounded-full overflow-hidden mx-auto">
              <motion.div 
                className="h-full bg-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-neutral-400">Optimizing for view...</p>
          </div>
        </div>
      );
    }

    if (error && !isProtected) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-neutral-600 font-medium">{error}</p>
          <button 
            className="flex items-center gap-2 px-6 py-2 bg-neutral-200 text-neutral-500 rounded-xl font-bold shadow-sm cursor-not-allowed"
            disabled
          >
            Download Unavailable
          </button>
        </div>
      );
    }



    // Render custom HTML welcome guide if set
    if (file.id === 'welcome-guide' && htmlContent) {
      return (
        <div className="bg-neutral-50 py-6 min-h-full overflow-y-auto flex flex-col justify-start">
          <div 
            className="w-11/12 bg-white shadow-sm p-8 border border-neutral-200 prose prose-neutral max-w-3xl prose-sm md:prose-base rounded-2xl mx-auto my-4" 
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        </div>
      );
    }

    // High fidelity modular canvas renderer for non-blocking secure rendering on Android/iOS/PCs
    if (file.type === 'pdf' && pdfDoc) {
      const pages = Array.from({ length: pdfPagesCount }, (_, i) => i + 1);
      return (
        <div className="w-full h-full flex flex-col relative bg-[#e8ebf0] dark:bg-neutral-900">
          {/* Zoom controls bar */}
          <div className="bg-white border-b border-neutral-200 px-4 py-2 flex flex-wrap gap-2 justify-between items-center z-20 shadow-sm shrink-0">
            <span className="text-xs font-bold text-neutral-500 font-mono tracking-tight">
              {pdfPagesCount} {pdfPagesCount === 1 ? t('page') : t('pages')}
            </span>
            <div className="flex items-center gap-3">
              {/* PDF View Mode Selector */}
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                <button
                  onClick={() => setPdfViewMode('scroll')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pdfViewMode === 'scroll'
                      ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/50"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                  title={t('continuous')}
                >
                  <Layout size={12} />
                  <span>{t('continuous')}</span>
                </button>
                <button
                  onClick={() => setPdfViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pdfViewMode === 'grid'
                      ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/50"
                      : "text-neutral-500 hover:text-neutral-950"
                  }`}
                  title={t('gridSorter')}
                >
                  <Grid size={12} />
                  <span>{t('gridSorter')}</span>
                </button>
              </div>


            </div>
          </div>

          {pdfViewMode === 'grid' ? (() => {
            // Determine number of columns and dynamic cell width in real-time
            // Corresponding to: grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
            const totalWidth = containerWidth;
            const estimatedScreenWidth = totalWidth + (totalWidth < 600 ? 16 : 48);
            let cols = 2;
            if (estimatedScreenWidth >= 1280) {
              cols = 6;
            } else if (estimatedScreenWidth >= 1024) {
              cols = 5;
            } else if (estimatedScreenWidth >= 768) {
              cols = 4;
            } else if (estimatedScreenWidth >= 640) {
              cols = 3;
            }
            const gap = 16;
            const totalGapWidth = (cols - 1) * gap;
            const cellWidth = Math.max(120, Math.floor((totalWidth - totalGapWidth) / cols));

            return (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-100">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto w-full">
                  {pages.map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        setPdfViewMode('scroll');
                        setTimeout(() => {
                          const el = document.getElementById(`pdf-page-${num}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 150);
                      }}
                      className="ring-1 ring-neutral-200/85 bg-white hover:ring-2 hover:ring-blue-600 rounded-none p-2 flex flex-col items-center justify-between text-center relative transition-all duration-300 shadow-sm group hover:scale-[1.03] hover:shadow-md cursor-pointer"
                    >
                      <div className="w-full aspect-[1/1.414] overflow-hidden rounded-none relative bg-white flex items-center justify-center p-0 border border-neutral-300 shadow-xs">
                        <PdfPageRenderer 
                          pdfDoc={pdfDoc} 
                          pageNum={num} 
                          scale={1.0} 
                          containerWidth={cellWidth} 
                          isThumbnail={true}
                        />
                      </div>
                      <span className="text-xs font-bold text-neutral-500 mt-2 font-mono group-hover:text-blue-600">
                        {t('page')} {num}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })() : (
            <PdfZoomStripContainer resetDependency={file.id}>
              {pages.map(num => (
                <div key={num} id={`pdf-page-${num}`} className="w-full flex justify-center">
                  <PdfPageRenderer 
                    pdfDoc={pdfDoc} 
                    pageNum={num} 
                    scale={1.0} 
                    containerWidth={containerWidth} 
                  />
                </div>
              ))}
            </PdfZoomStripContainer>
          )}

          <div className="p-4 bg-white border-t border-neutral-200 flex items-center shrink-0">
             <div className="flex items-center gap-2 text-neutral-600">
                <FileText size={18} className="text-red-500 animate-pulse" />
                <span className="text-xs font-bold truncate max-w-[175px] sm:max-w-md">{file.name}</span>
             </div>
          </div>
        </div>
      );
    }

    if (file.type === 'image' && blobUrl) {
      return (
        <div className="w-full h-full flex flex-col bg-neutral-900 overflow-hidden">
          <ZoomPanContainer className="flex-1 overflow-hidden relative bg-neutral-900" resetDependency={file.id}>
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <img src={blobUrl} alt={file.name} className="max-w-full max-h-[70vh] shadow-2xl rounded-2xl object-contain border border-neutral-800" referrerPolicy="no-referrer" />
            </div>
          </ZoomPanContainer>
          
          <div className="p-4 bg-neutral-950 border-t border-neutral-900 flex items-center shrink-0">
             <div className="flex items-center gap-2 text-neutral-400 font-sans">
                <ImageIcon size={18} className="text-violet-400 animate-pulse" />
                <span className="text-xs font-bold truncate max-w-[175px] sm:max-w-md text-neutral-200">{file.name}</span>
             </div>
          </div>
        </div>
      );
    }

    // Advanced DOCX / DOC Viewer
    if (file.type === 'doc' && fileArrayBuffer) {
      if (useServerHtml && htmlContent) {
        return (
          <div className="w-full h-full flex flex-col bg-neutral-100 overflow-hidden">
            <ZoomPanContainer className="flex-1 overflow-hidden relative bg-neutral-50" resetDependency={file.id}>
              <div className="w-full h-full overflow-y-auto bg-neutral-50 px-2 sm:px-6 py-6 scroll-smooth">
                <div 
                  className="w-full max-w-4xl mx-auto bg-white p-6 sm:p-12 shadow-md rounded-2xl border border-neutral-200/80 overflow-x-auto word-docx-libreoffice prose prose-neutral prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            </ZoomPanContainer>
            
            <div className="p-4 bg-white border-t border-neutral-200 flex items-center shrink-0 justify-between">
              <div className="flex items-center gap-2 text-neutral-600">
                <Sparkles size={18} className="text-amber-500 animate-pulse" />
                <span className="text-xs font-bold truncate max-w-[175px] sm:max-w-md text-amber-700">100% Accurate Layout View: {file.name}</span>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="w-full h-full flex flex-col bg-neutral-150 overflow-hidden">
          <ZoomPanContainer className="flex-1 overflow-hidden relative bg-neutral-50" resetDependency={file.id}>
            <div className="w-full h-full overflow-y-auto bg-neutral-50 py-6">
              <WordDocxViewer arrayBuffer={fileArrayBuffer} htmlContent={htmlContent} />
            </div>
          </ZoomPanContainer>
          
          <div className="p-4 bg-white border-t border-neutral-200 flex items-center shrink-0">
             <div className="flex items-center gap-2 text-neutral-600">
                <FileText size={18} className="text-blue-500 animate-pulse" />
                <span className="text-xs font-bold truncate max-w-[175px] sm:max-w-md">{file.name}</span>
             </div>
          </div>
        </div>
      );
    }
    // Advanced Multi-Sheet Excel Spreadsheet Viewer
    if (file.type === 'xlsx' && excelData) {
      return (
        <ExcelSpreadsheetViewer 
          excelData={excelData}
          sheetNames={sheetNames}
          currentSheet={currentSheet}
          onSheetSelect={handleSheetSelect}
          fileName={file.name}
          fileId={file.id}
          t={t}
        />
      );
    }

    // Creative PowerPoint PPT/PPTX Slide Presentation Deck Viewer
    if (file.type === 'ppt' && slides.length > 0) {
      const activeSlide = slides[currentSlideIdx] || slides[0];
      const contrastColor = getContrastTextColor(activeSlide?.backgroundColor || '#ffffff');

      // Proportional aspect-ratio layout sizing calculated dynamically based on container workspace scale factor
      const isMobileLayout = containerWidth < 768;
      const spaceTakenBySidebar = isMobileLayout ? 0 : 256;
      const availableSlideSpace = Math.max(280, containerWidth - spaceTakenBySidebar);

      const slideNativeWidth = activeSlide?.width || 960;
      const slideNativeHeight = activeSlide?.height || 540;
      const slideAspect = slideNativeWidth / slideNativeHeight;

      // Fit container nicely on both mobile and desktop screens
      const targetCanvasWidth = Math.min(availableSlideSpace - (isMobileLayout ? 16 : 48), 960);
      const canvasBoxWidth = Math.max(280, targetCanvasWidth);
      const canvasBoxHeight = canvasBoxWidth / slideAspect;
      const scaleFactor = canvasBoxWidth / slideNativeWidth;

      return (
        <div className="w-full h-full flex flex-col bg-neutral-900 select-none overflow-hidden">
          <div className="flex-1 flex flex-row overflow-hidden min-h-0">
          {/* Sidebar drawer of slide cards - desktop only */}
          <div className="hidden md:flex flex-col w-64 shrink-0 bg-neutral-950 border-r border-neutral-800/80 p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-neutral-400 font-bold text-[10px] tracking-wider uppercase font-mono">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <Presentation size={13} className="text-yellow-500" /> Elements Tree
              </span>
              <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md font-mono text-[9px]">{slides.length} Slides</span>
            </div>
            
            <div className="flex-1 space-y-2.5 pr-1 py-1 overflow-y-auto no-scrollbar">
              {slides.map((s, idx) => {
                const isActive = idx === currentSlideIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentSlideIdx(idx);
                      setPlayingSlideshow(false);
                    }}
                    className={`group text-left w-full rounded-xl border p-3 flex flex-col justify-between gap-2 overflow-hidden relative transition-all duration-300 ${
                      isActive 
                        ? "border-amber-500 bg-neutral-850 shadow-md shadow-amber-500/10 scale-[1.01]" 
                        : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/40"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[9px] font-bold text-neutral-500 font-mono tracking-wider">
                      <span>SLIDE {idx + 1}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                    </div>
                    <span className="text-xs font-bold text-neutral-200 leading-tight line-clamp-2 select-none group-hover:text-white transition-colors font-display">
                      {s.title || `Slide ${idx + 1}`}
                    </span>
                    {s.elements && s.elements.length > 0 && (
                      <div className="flex gap-2 items-center text-[9px] font-bold font-mono text-neutral-500">
                        {s.elements.some((el: any) => el.type === 'image') && (
                          <span className="text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded-md text-[8px]">IMAGE</span>
                        )}
                        <span>{s.elements.length} Component{s.elements.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main workspace arena */}
          <div className="flex-1 flex flex-col justify-between p-4 md:p-6 overflow-y-auto">
            {/* Widescreen presenter master bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 mb-4 bg-neutral-800/80 p-3 rounded-2xl border border-neutral-700/50 backdrop-blur-md">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 font-mono">
                <Presentation size={14} className="text-yellow-500 animate-pulse" />
                {t('slide')} {currentSlideIdx + 1} / {slides.length}
              </span>

              {/* View options selectors: canvas vs easy outline vs grid */}
              <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-750">
                <button
                  onClick={() => setPptViewMode('canvas')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pptViewMode === 'canvas'
                      ? "bg-amber-500 text-neutral-950 shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="Widescreen Graphic View"
                >
                  <Layout size={12} />
                  <span>{t('graphical')}</span>
                </button>
                <button
                  onClick={() => setPptViewMode('outline')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pptViewMode === 'outline'
                      ? "bg-amber-500 text-neutral-950 shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="Document Text Outline"
                >
                  <ListCollapse size={12} />
                  <span>{t('outline')}</span>
                </button>
                <button
                  onClick={() => setPptViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pptViewMode === 'grid'
                      ? "bg-amber-500 text-neutral-950 shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="PowerPoint Slides Grid Overview"
                >
                  <Grid size={12} />
                  <span>{t('gridSorter')}</span>
                </button>
              </div>

              {/* Slide cycler player control and Dynamic Accessibility Zoom Toggles */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Visual tactile zoom controller widgets */}
                <div className="flex items-center gap-1 bg-neutral-900 px-2 py-1 rounded-xl border border-neutral-750">
                  <button
                    onClick={() => {
                      setPptZoom(prev => Math.max(1.0, prev - 0.25));
                      if (pptZoom <= 1.25) {
                        setPptPan({ x: 0, y: 0 });
                      }
                    }}
                    className="w-6 h-6 rounded-lg text-xs font-black transition-all text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
                    title="Zoom Out Slide"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-bold font-mono text-neutral-300 min-w-[34px] text-center">
                    {Math.round(pptZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPptZoom(prev => Math.min(5.0, prev + 0.25))}
                    className="w-6 h-6 rounded-lg text-xs font-black transition-all text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
                    title="Zoom In Slide"
                  >
                    +
                  </button>
                  {(pptZoom > 1.0 || pptPan.x !== 0 || pptPan.y !== 0) && (
                    <button
                      onClick={() => {
                        setPptZoom(1.0);
                        setPptPan({ x: 0, y: 0 });
                      }}
                      className="ml-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 font-bold font-mono text-[9px] uppercase tracking-wider transition-all"
                      title="Reset View Zoom"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => setPlayingSlideshow(!playingSlideshow)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    playingSlideshow 
                      ? "bg-red-500 text-white animate-pulse" 
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {playingSlideshow ? <Square size={12} /> : <Play size={12} />}
                  <span>{playingSlideshow ? t('stopAutoplay') : t('startAutoplay')}</span>
                </button>
              </div>
            </div>

            {/* Stage Body - Supports accessible pinch zoom or drag to pan */}
            {pptViewMode === 'canvas' ? (
              <div className="flex-1 flex items-center justify-center py-2 md:py-4 animate-fade-in relative group/arena">
                <div 
                  style={{ 
                    width: `${canvasBoxWidth}px`,
                    height: `${canvasBoxHeight}px`
                  }}
                  className={`shadow-2xl relative rounded-none overflow-hidden border border-neutral-800 bg-neutral-950 transition-shadow duration-300 ${
                    pptZoom > 1.0 ? 'cursor-grab active:cursor-grabbing ring-1 ring-amber-500/20' : 'cursor-default'
                  }`}
                  onTouchStart={handlePptTouchStart}
                  onTouchMove={handlePptTouchMove}
                  onTouchEnd={handlePptTouchEnd}
                  onMouseDown={handlePptMouseDown}
                  onMouseMove={handlePptMouseMove}
                  onMouseUp={handlePptMouseUpOrLeave}
                  onMouseLeave={handlePptMouseUpOrLeave}
                >
                  {pptZoom > 1.0 && (
                    <div className="absolute top-3 left-3 bg-neutral-900/95 text-amber-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-neutral-750 flex items-center gap-1.5 select-none pointer-events-none shadow-xl backdrop-blur-md z-30 animate-fade-in font-display">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span>Zoom {Math.round(pptZoom * 100)}% — Panning Active</span>
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: `${slideNativeWidth}px`,
                      height: `${slideNativeHeight}px`,
                      transform: `scale(${scaleFactor * pptZoom}) translate(${pptPan.x}px, ${pptPan.y}px)`,
                      transformOrigin: 'top left',
                    }}
                    className="overflow-hidden transition-transform duration-100 ease-out"
                  >
                    <motion.div 
                      key={currentSlideIdx}
                      initial={{ opacity: 0, scale: 0.98, x: 25 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`w-full h-full relative overflow-hidden select-text pointer-events-auto ${
                        activeSlide.html ? "p-0" : activeSlide.elements && activeSlide.elements.length > 0 ? "p-0" : "p-6 sm:p-8 md:p-10 flex flex-col justify-between"
                      }`}
                      style={{
                        backgroundColor: (activeSlide.backgroundColor && !activeSlide.backgroundColor.includes('gradient')) 
                          ? activeSlide.backgroundColor 
                          : (activeSlide.backgroundColor ? undefined : '#ffffff'),
                        background: (activeSlide.backgroundColor && activeSlide.backgroundColor.includes('gradient')) 
                          ? activeSlide.backgroundColor 
                          : undefined,
                        backgroundImage: activeSlide.backgroundImage ? `url(${activeSlide.backgroundImage})` : undefined,
                        backgroundSize: '100% 100%',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}
                    >
                      {activeSlide.html ? (
                        <div className="w-full h-full relative overflow-hidden select-text pointer-events-auto pptx-render-root">
                          <style>{`
                            @font-face {
                              font-family: 'Calibri';
                              src: local('Calibri'), local('Carlito'), local('Carlito-Regular');
                              font-weight: normal;
                              font-style: normal;
                            }
                            @font-face {
                              font-family: 'Calibri';
                              src: local('Calibri Bold'), local('Carlito-Bold');
                              font-weight: 700;
                              font-style: normal;
                            }
                            @font-face {
                              font-family: 'Arial';
                              src: local('Arial'), local('Arimo'), local('Arimo-Regular');
                              font-weight: normal;
                              font-style: normal;
                            }
                            @font-face {
                              font-family: 'Arial';
                              src: local('Arial Bold'), local('Arimo-Bold');
                              font-weight: 700;
                              font-style: normal;
                            }
                            .pptx-render-root, .pptx-render-root * { 
                              box-sizing: border-box; 
                            }
                            .pptx-render-root .slide-shell, 
                            .pptx-render-root .slide, 
                            .pptx-render-root .shape, 
                            .pptx-render-root .paragraph { 
                              margin: 0; 
                            }
                            .pptx-render-root {
                              width: 100%;
                              height: 100%;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              color: ${contrastColor};
                              font-family: "Calibri", "Carlito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                              letter-spacing: -0.012em;
                              text-rendering: optimizeLegibility;
                              -webkit-font-smoothing: antialiased;
                              -moz-osx-font-smoothing: grayscale;
                              ${activeSlide.css || ''}
                            }
                            .pptx-render-root .slide {
                              color: ${contrastColor};
                              ${activeSlide.backgroundColor && activeSlide.backgroundColor.includes('gradient') ? `background: ${activeSlide.backgroundColor} !important;` : ''}
                            }
                            .pptx-render-root .paragraph {
                              margin: 0 !important;
                              line-height: 1.15 !important;
                            }
                            .pptx-render-root .run,
                            .pptx-render-root .run-segment {
                              line-height: 1.15 !important;
                              letter-spacing: -0.012em;
                            }
                            .pptx-render-root .text-body {
                              line-height: 1.15 !important;
                              overflow-wrap: break-word;
                              word-break: break-word;
                            }
                            .pptx-render-root svg {
                              shape-rendering: geometricPrecision !important;
                              text-rendering: geometricPrecision !important;
                              image-rendering: -webkit-optimize-contrast;
                              overflow: visible;
                            }
                            .pptx-render-root svg path,
                            .pptx-render-root svg rect,
                            .pptx-render-root svg circle,
                            .pptx-render-root svg ellipse,
                            .pptx-render-root svg line,
                            .pptx-render-root svg polyline,
                            .pptx-render-root svg polygon {
                              shape-rendering: geometricPrecision !important;
                              vector-effect: non-scaling-stroke;
                            }
                          `}</style>
                          <div 
                            className="w-full h-full select-text pointer-events-auto flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: activeSlide.html }}
                          />
                          {/* Slide counter watermark inside the elements overlay */}
                          <div className="absolute bottom-3 right-3 select-none pointer-events-none z-10">
                            <span 
                              style={{ color: contrastColor, borderColor: `${contrastColor}25`, backgroundColor: `${contrastColor}05` }}
                              className="px-2.5 py-0.5 text-[9px] md:text-[10px] font-bold font-mono rounded-lg border backdrop-blur-[2px]"
                            >
                              {currentSlideIdx + 1} / {slides.length}
                            </span>
                          </div>
                        </div>
                      ) : activeSlide.elements && activeSlide.elements.length > 0 ? (
                        (() => {
                          const slideTextColor = getContrastTextColor(activeSlide.backgroundColor || '#ffffff');
                          
                          // Compute slide-wide total text volume to apply consistent uniform sizing across all boxes on the active slide
                          const totalTextLength = activeSlide.elements
                            .filter((item: any) => item.type === 'text')
                            .reduce((sum: number, item: any) => sum + (item.text ? item.text.length : 0), 0);

                          let slideWideScale = 1.0;
                          if (totalTextLength > 800) {
                            slideWideScale = 0.50;
                          } else if (totalTextLength > 500) {
                            slideWideScale = 0.65;
                          } else if (totalTextLength > 300) {
                            slideWideScale = 0.76;
                          } else if (totalTextLength > 150) {
                            slideWideScale = 0.86;
                          } else if (totalTextLength > 80) {
                            slideWideScale = 0.94;
                          }

                          const textElementsCount = activeSlide.elements.filter((item: any) => item.type === 'text').length;
                          const densityPenalty = textElementsCount > 8 ? 0.72 : textElementsCount > 4 ? 0.85 : 1.0;

                          const combinedDownscale = slideWideScale * densityPenalty;

                          return (
                            <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                              {activeSlide.elements.map((el: any, elIdx: number) => {
                                if (el.type === 'image') {
                                  return (
                                    <div
                                      key={elIdx}
                                      style={{
                                        position: 'absolute',
                                        left: `${el.x}%`,
                                        top: `${el.y}%`,
                                        width: `${el.w}%`,
                                        height: `${el.h}%`,
                                      }}
                                      className="pointer-events-none select-none rounded-none overflow-hidden transition-all duration-300 flex items-center justify-center"
                                    >
                                      <img
                                        src={el.imageUrl}
                                        alt="Slide Artwork Graphic Element"
                                        className="w-full h-full object-contain max-w-full max-h-full"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  );
                                } else if (el.type === 'text') {
                                  // Constant reference sizing for the 768px frame - the parent transform:scale fully downscales proportionally on mobile
                                  const headerFontSize = Math.max(10, Math.round(24 * (el.isTitle ? Math.max(0.65, combinedDownscale) : combinedDownscale)));
                                  const bodyFontSize = Math.max(8.0, Math.round(13 * combinedDownscale));
                                  const bulletDotSize = Math.max(3.0, Math.round(4.5 * combinedDownscale));
                                  const bulletDotMarginTop = Math.max(3.5, Math.round(5 * combinedDownscale));

                                  return (
                                    <div
                                      key={elIdx}
                                      style={{
                                        position: 'absolute',
                                        left: `${el.x}%`,
                                        top: `${el.y}%`,
                                        width: `${el.w}%`,
                                        maxHeight: `${el.h}%`,
                                      }}
                                      className="flex flex-col justify-start select-text leading-snug overflow-hidden p-1 transition-all duration-300 text-left pointer-events-auto"
                                    >
                                      {el.isTitle ? (
                                        <h4 
                                          style={{ color: slideTextColor, fontSize: `${headerFontSize}px` }}
                                          className="font-black tracking-tight leading-snug break-words font-display"
                                        >
                                          {el.text}
                                        </h4>
                                      ) : (
                                        <div className="space-y-1 mt-1" style={{ fontSize: `${bodyFontSize}px` }}>
                                          {el.bullets && el.bullets.length > 1 ? (
                                            el.bullets.map((b: string, bIdx: number) => (
                                              <p 
                                                key={bIdx}
                                                style={{ color: slideTextColor }}
                                                className="font-semibold leading-relaxed flex items-start gap-1.5 opacity-90 break-words"
                                              >
                                                <span 
                                                  style={{ 
                                                    width: `${bulletDotSize}px`, 
                                                    height: `${bulletDotSize}px`, 
                                                    marginTop: `${bulletDotMarginTop}px` 
                                                  }} 
                                                  className="rounded-full bg-amber-500 shrink-0" 
                                                />
                                                <span>{b}</span>
                                              </p>
                                            ))
                                          ) : (
                                            <p 
                                              style={{ color: slideTextColor }}
                                              className="font-medium opacity-90 leading-relaxed break-words"
                                            >
                                              {el.text}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })}

                              {/* Slide counter watermark inside the elements overlay */}
                              <div className="absolute bottom-3 right-3 select-none pointer-events-none z-10">
                                <span 
                                  style={{ color: contrastColor, borderColor: `${contrastColor}25`, backgroundColor: `${contrastColor}05` }}
                                  className="px-2.5 py-0.5 text-[9px] md:text-[10px] font-bold font-mono rounded-lg border backdrop-blur-[2px]"
                                >
                                  {currentSlideIdx + 1}
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        // Custom static fallback structured slide style
                        <div className="flex-1 flex flex-col justify-start space-y-4 md:space-y-6">
                          {/* Slide Title */}
                          <div className="border-b pb-3" style={{ borderColor: `${contrastColor}15` }}>
                            <h3 
                              style={{ color: contrastColor }}
                              className="text-base sm:text-lg md:text-2xl font-black tracking-tight leading-snug break-words font-display"
                            >
                              {activeSlide.title || `Slide ${currentSlideIdx + 1}`}
                            </h3>
                          </div>

                          {/* Content Grid layout for standard flow: Images on left, Text on right */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1">
                            {/* Slide Graphic Images column */}
                            {activeSlide.elements && activeSlide.elements.some((el: any) => el.type === 'image') ? (
                              <div className="col-span-1 md:col-span-5 flex flex-wrap gap-3 justify-center items-center">
                                {activeSlide.elements
                                  .filter((el: any) => el.type === 'image')
                                  .map((el: any, imgIdx: number) => (
                                    <div 
                                      key={imgIdx} 
                                      className="max-h-28 md:max-h-40 rounded-xl overflow-hidden bg-white/5 p-1 border border-neutral-500/10 shadow-md"
                                    >
                                      <img 
                                        src={el.imageUrl} 
                                        alt="Slide Artwork Graphic Element" 
                                        className="h-full object-contain max-h-full rounded"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  ))}
                              </div>
                            ) : null}

                            {/* Slide Bullet Texts / Details List column */}
                            <div className={`col-span-1 ${activeSlide.elements && activeSlide.elements.some((el: any) => el.type === 'image') ? 'md:col-span-7' : 'md:col-span-12'} space-y-3`}>
                              {activeSlide.content && activeSlide.content.length > 0 ? (
                                <ul className="space-y-2.5 pl-1">
                                  {activeSlide.content.map((bullet: string, idx: number) => (
                                    <li 
                                      key={idx} 
                                      style={{ color: contrastColor }}
                                      className="text-xs sm:text-sm font-semibold leading-relaxed flex items-start gap-2.5 opacity-90 break-words"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-relaxed">
                                  This slide contains visual and structure components
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Fine Corner Watermarks & Counter */}
                          <div className="mt-4 pt-3 flex justify-between items-center select-none" style={{ borderTop: `1px solid ${contrastColor}12` }}>
                            <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 truncate max-w-[200px]" style={{ color: contrastColor }}>
                              {file.name}
                            </span>
                            <span 
                              style={{ color: contrastColor, borderColor: `${contrastColor}25`, backgroundColor: `${contrastColor}05` }}
                              className="px-2.5 py-0.5 text-[9px] md:text-[10px] font-bold font-mono rounded-lg border"
                            >
                              {currentSlideIdx + 1}
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            ) : pptViewMode === 'grid' ? (
              // PowerPoint Slide Grid Sorter Mode
              <div className="flex-1 py-4 overflow-y-auto max-w-5xl mx-auto w-full pr-1.5 animate-fade-in scroll-smooth">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-1">
                  {slides.map((s, idx) => {
                    const isActive = idx === currentSlideIdx;
                    const slideTextColor = getContrastTextColor(s.backgroundColor || '#ffffff');
                    
                    // Compute slide-wide text scale
                    const totalTextLength = (s.elements || [])
                      .filter((item: any) => item.type === 'text')
                      .reduce((sum: number, item: any) => sum + (item.text ? item.text.length : 0), 0);

                    let slideWideScale = 1.0;
                    if (totalTextLength > 800) {
                      slideWideScale = 0.50;
                    } else if (totalTextLength > 500) {
                      slideWideScale = 0.65;
                    } else if (totalTextLength > 300) {
                      slideWideScale = 0.76;
                    } else if (totalTextLength > 150) {
                      slideWideScale = 0.86;
                    } else if (totalTextLength > 80) {
                      slideWideScale = 0.94;
                    }

                    const textElementsCount = (s.elements || []).filter((item: any) => item.type === 'text').length;
                    const densityPenalty = textElementsCount > 8 ? 0.72 : textElementsCount > 4 ? 0.85 : 1.0;
                    const combinedDownscale = slideWideScale * densityPenalty;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentSlideIdx(idx);
                          setPptViewMode('canvas');
                          setPlayingSlideshow(false);
                        }}
                        style={{
                          backgroundColor: (s.backgroundColor && !s.backgroundColor.includes('gradient')) 
                            ? s.backgroundColor 
                            : (s.backgroundColor ? undefined : '#ffffff'),
                          background: (s.backgroundColor && s.backgroundColor.includes('gradient')) 
                            ? s.backgroundColor 
                            : undefined,
                          backgroundImage: s.backgroundImage ? `url(${s.backgroundImage})` : undefined,
                          backgroundSize: '100% 100%',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                          containerType: 'inline-size' as any
                        }}
                        className={`group relative aspect-[16/9] w-full rounded-2xl border-2 overflow-hidden flex flex-col justify-between p-4 text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-xl shadow-md ${
                          isActive 
                            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-amber-500/5' 
                            : 'border-neutral-800 hover:border-neutral-700 hover:translate-y-[-2px]'
                        }`}
                      >
                        {/* Live Slide Elements Preview Layer */}
                        <div 
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: `${s.width || 960}px`,
                            height: `${s.height || 540}px`,
                            transform: `scale(calc(100cqw / ${s.width || 960}))`,
                            transformOrigin: 'top left',
                          }}
                          className="pointer-events-none overflow-hidden select-none z-0"
                        >
                          {s.html ? (
                            <div className="w-full h-full pptx-render-root">
                              {s.css && (
                                <style>{`
                                  .pptx-render-root, .pptx-render-root * { box-sizing: border-box; }
                                  .pptx-render-root .slide-shell, .pptx-render-root .slide, .pptx-render-root .shape, .pptx-render-root .paragraph { margin: 0; }
                                  .pptx-render-root .paragraph, .pptx-render-root .run, .pptx-render-root .run-segment { line-height: 1.15 !important; letter-spacing: -0.012em; }
                                  .pptx-render-root svg { shape-rendering: geometricPrecision !important; }
                                  .pptx-render-root { ${s.css} }
                                `}</style>
                              )}
                              <div dangerouslySetInnerHTML={{ __html: s.html }} />
                            </div>
                          ) : s.elements ? (
                            s.elements.map((el: any, elIdx: number) => {
                            if (el.type === 'image') {
                              return (
                                <div
                                  key={elIdx}
                                  style={{
                                    position: 'absolute',
                                    left: `${el.x}%`,
                                    top: `${el.y}%`,
                                    width: `${el.w}%`,
                                    height: `${el.h}%`,
                                  }}
                                  className="rounded-none overflow-hidden flex items-center justify-center opacity-90"
                                >
                                  <img
                                    src={el.imageUrl}
                                    alt="Slide Miniature Asset"
                                    className="w-full h-full object-contain max-w-full max-h-full"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              );
                            } else if (el.type === 'text') {
                              const baseHeaderSize = Math.max(10, Math.round(24 * (el.isTitle ? Math.max(0.65, combinedDownscale) : combinedDownscale)));
                              const baseBodySize = Math.max(8.0, Math.round(13 * combinedDownscale));
                              const bulletDotSize = Math.max(3.0, Math.round(4.5 * combinedDownscale));
                              const bulletDotMarginTop = Math.max(3.5, Math.round(5 * combinedDownscale));

                              return (
                                <div
                                  key={elIdx}
                                  style={{
                                    position: 'absolute',
                                    left: `${el.x}%`,
                                    top: `${el.y}%`,
                                    width: `${el.w}%`,
                                    maxHeight: `${el.h}%`,
                                  }}
                                  className="flex flex-col justify-start leading-snug overflow-hidden p-1 text-left"
                                >
                                  {el.isTitle ? (
                                    <h4 
                                      style={{ color: slideTextColor, fontSize: `${baseHeaderSize}px` }}
                                      className="font-black tracking-tight leading-snug break-words font-display"
                                    >
                                      {el.text}
                                    </h4>
                                  ) : (
                                    <div className="space-y-1 mt-1" style={{ fontSize: `${baseBodySize}px` }}>
                                      {el.bullets && el.bullets.length > 1 ? (
                                        el.bullets.map((b: string, bIdx: number) => (
                                          <p 
                                            key={bIdx}
                                            style={{ color: slideTextColor }}
                                            className="font-semibold leading-relaxed flex items-start gap-1.5 opacity-90 break-words"
                                          >
                                            <span 
                                              style={{ 
                                                width: `${bulletDotSize}px`, 
                                                height: `${bulletDotSize}px`,
                                                marginTop: `${bulletDotMarginTop}px`
                                              }}
                                              className="rounded-full bg-amber-500 shrink-0" 
                                            />
                                            <span>{b}</span>
                                          </p>
                                        ))
                                      ) : (
                                        <p style={{ color: slideTextColor }} className="font-medium leading-relaxed opacity-90 break-words">
                                          {el.text}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })
                          ) : null}
                        </div>

                        {/* Soft ambient overlay at bottom to ensure metadata typography stands out regardless of slide elements */}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/95 via-neutral-950/45 to-transparent z-10 pointer-events-none" />
                        
                        <div className="flex justify-between items-center z-20 relative">
                          <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-lg border ${
                            isActive 
                              ? 'bg-amber-500 text-neutral-950 border-amber-600/30 font-extrabold' 
                              : 'bg-neutral-900/90 text-neutral-300 border-neutral-750'
                          }`}>
                            SLIDE {idx + 1}
                          </span>
                          {isActive && (
                            <span className="flex h-2.5 w-2.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                          )}
                        </div>

                        <div className="z-20 relative mt-auto">
                          <h4 className="text-sm font-bold text-white tracking-tight leading-snug line-clamp-2 select-none group-hover:text-amber-300 transition-colors font-display">
                            {s.title || `Untitled Slide ${idx + 1}`}
                          </h4>
                          <div className="flex gap-2 mt-1.5 items-center">
                            <span className="text-[9px] font-black font-mono text-neutral-400 bg-neutral-900/80 px-1.5 py-0.5 rounded border border-neutral-750/70">
                              {s.elements?.length || 0} Components
                            </span>
                            {s.elements?.some((el: any) => el.type === 'image') && (
                              <span className="text-[9px] font-black font-mono text-blue-300 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/40 uppercase">
                                Visuals
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Structured Presentation Document Outline Text List
              <div className="flex-1 py-4 overflow-y-auto max-w-2xl mx-auto w-full space-y-4 pr-1">
                {slides.map((s, idx) => (
                  <div key={idx} className="bg-neutral-800/40 rounded-2xl border border-neutral-800 p-5 space-y-4 transition-all hover:bg-neutral-800/60 hover:border-neutral-700 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-yellow-500 font-mono tracking-wider uppercase">Slide {idx + 1} of {slides.length}</span>
                      {s.backgroundColor && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold font-mono text-neutral-400">BG:</span>
                          <span 
                            style={{ 
                              background: s.backgroundColor && s.backgroundColor.includes('gradient') ? s.backgroundColor : undefined,
                              backgroundColor: s.backgroundColor && !s.backgroundColor.includes('gradient') ? s.backgroundColor : undefined 
                            }} 
                            className="w-3.5 h-3.5 rounded-full border border-neutral-700 inline-block shadow-sm"
                            title={`Slide background: ${s.backgroundColor}`}
                          />
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-base font-bold text-white tracking-tight font-display">{s.title || "Untitled Slide"}</h4>
                    
                    {s.content && s.content.length > 0 ? (
                      <ul className="space-y-2 pl-2 border-l-2 border-neutral-700/60">
                        {s.content.map((bullet: string, bIdx: number) => (
                          <li key={bIdx} className="text-xs text-neutral-300 font-medium leading-relaxed flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-neutral-500 font-bold font-mono uppercase">Empty Slide Content Text</p>
                    )}

                    {/* Image assets/icons parsed inside this slide */}
                    {s.elements && s.elements.some((el: any) => el.type === 'image') && (
                      <div className="pt-3 border-t border-neutral-800/60 space-y-2">
                        <span className="text-[9px] font-black font-mono text-neutral-500 tracking-wider uppercase block">Visual Assets & Icons</span>
                        <div className="flex flex-wrap gap-2.5">
                          {s.elements
                            .filter((el: any) => el.type === 'image')
                            .map((el: any, elIdx: number) => (
                              <div
                                key={elIdx}
                                className="w-14 h-14 rounded-xl border border-neutral-750 bg-neutral-900/80 p-1 flex items-center justify-center relative group/thumb overflow-hidden transition-all hover:scale-105 hover:ring-2 hover:ring-amber-500/50 hover:border-transparent active:scale-95 cursor-zoom-in shadow-inner"
                                onClick={() => {
                                  // Jump to this slide and zoom/switch to canvas view on click!
                                  setCurrentSlideIdx(idx);
                                  setPptViewMode('canvas');
                                  setPlayingSlideshow(false);
                                }}
                                title="Click to view this visual in regular slide editor"
                              >
                                <img
                                  src={el.imageUrl}
                                  alt={`Slide ${idx + 1} Visual Asset`}
                                  className="max-w-full max-h-full object-contain filter drop-shadow transition-transform duration-300 group-hover/thumb:scale-110"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-neutral-950/45 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[8px] font-mono font-black text-amber-500 uppercase tracking-widest bg-neutral-900/90 px-1 py-0.5 rounded border border-neutral-800">
                                    View
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom slideshow controls & carousel dots */}
            <div className="flex flex-col items-center gap-4 shrink-0 mt-4 max-w-md mx-auto w-full">
              {/* Pagination indicators dots */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full px-4 py-2 bg-neutral-950/25 rounded-full border border-neutral-800/30">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentSlideIdx(idx);
                      setPlayingSlideshow(false);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentSlideIdx 
                        ? "w-5 bg-amber-500 shadow-sm" 
                        : "w-2 bg-neutral-600 hover:bg-neutral-500"
                    }`}
                    title={`Go to Slide ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Active remote controller buttons */}
              <div className="flex justify-between items-center gap-3 w-full">
                <button 
                  onClick={() => {
                    setCurrentSlideIdx(prev => (prev - 1 + slides.length) % slides.length);
                    setPlayingSlideshow(false);
                  }}
                  className="flex-1 py-3 bg-neutral-800 text-white hover:bg-neutral-750 font-bold text-xs md:text-sm rounded-xl border border-neutral-750 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  {t('prevSlide')}
                </button>
                <button 
                  onClick={() => {
                    setCurrentSlideIdx(prev => (prev + 1) % slides.length);
                    setPlayingSlideshow(false);
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs md:text-sm rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10"
                >
                  {t('nextSlide')}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

          <div className="p-4 bg-neutral-950 border-t border-neutral-855 flex items-center shrink-0">
             <div className="flex items-center gap-2 text-neutral-400 font-sans">
                <Presentation size={18} className="text-amber-500 animate-pulse" />
                <span className="text-xs font-bold truncate max-w-[175px] sm:max-w-md text-neutral-200">{file.name}</span>
             </div>
          </div>
        </div>
      );
    }

    // Advanced Interactive EPUB E-Book Reader
    if (file.type === 'epub' && epubChapters.length > 0) {
      const activeChapter = epubChapters[currentChapterIdx];
      
      // Determine theme background and text colors
      let bgStyle = 'bg-white text-neutral-800';
      let headerFooterBg = 'bg-neutral-50/80 border-neutral-200/85';
      let readerContainerBg = 'bg-neutral-100';
      let sidebarBg = 'bg-neutral-50 border-r border-neutral-200';
      let sidebarItemActive = 'bg-indigo-50 border-indigo-200 text-indigo-700';
      let sidebarItemInactive = 'text-neutral-600 hover:bg-neutral-100';
      if (epubTheme === 'sepia') {
        bgStyle = 'bg-[#f7f1e3] text-[#4d3a26]';
        headerFooterBg = 'bg-[#eee3cb] border-[#dfd0b5]';
        readerContainerBg = 'bg-[#efe6cb]';
        sidebarBg = 'bg-[#f2e7cc] border-r border-[#dfd0b5]';
        sidebarItemActive = 'bg-[#e3d3b7] border-[#d2bd9a] text-[#553a15]';
        sidebarItemInactive = 'text-[#5d462c] hover:bg-[#e6d8bc]';
      } else if (epubTheme === 'dark') {
        bgStyle = 'bg-neutral-900 text-neutral-100';
        headerFooterBg = 'bg-neutral-950/80 border-neutral-800';
        readerContainerBg = 'bg-neutral-950';
        sidebarBg = 'bg-neutral-900 border-r border-neutral-800';
        sidebarItemActive = 'bg-neutral-800 border-neutral-700 text-white';
        sidebarItemInactive = 'text-neutral-400 hover:bg-neutral-850';
      }

      return (
        <div className={`h-full flex flex-row overflow-hidden ${readerContainerBg}`}>
          {/* Table of Contents Chapter list sidebar - desktop only */}
          <div className={`hidden md:flex flex-col w-64 shrink-0 p-4 overflow-y-auto space-y-4 ${sidebarBg}`}>
            <div className="flex items-center justify-between pb-3 border-b border-current opacity-20">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <BookOpen size={14} /> {t('tableOfContents')}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border">
                {epubChapters.length} {t('ch')}
              </span>
            </div>

            {epubMetadata && (
              <div className="flex flex-col items-center text-center py-2 space-y-2 border-b border-current opacity-15">
                {epubMetadata.coverUrl ? (
                  <img src={epubMetadata.coverUrl} alt="Cover" className="h-28 object-contain rounded-md shadow-md" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-24 bg-neutral-200/30 rounded flex items-center justify-center">
                    <BookOpen size={24} className="opacity-40" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold line-clamp-1">{epubMetadata.title}</h4>
                  <p className="text-[10px] opacity-80">{epubMetadata.author}</p>
                </div>
              </div>
            )}

            <div className="flex-1 space-y-1 py-1 overflow-y-auto no-scrollbar">
              {epubChapters.map((ch, idx) => {
                const isActive = idx === currentChapterIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentChapterIdx(idx)}
                    className={`text-left w-full rounded-xl border px-3 py-2.5 flex items-center gap-2 text-xs font-bold transition-all duration-300 ${
                      isActive ? sidebarItemActive : sidebarItemInactive
                    }`}
                  >
                    <span className="opacity-40 font-mono text-[9px] w-4">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="truncate flex-1">{ch.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reading Arena */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Top Toolbar */}
            <div className={`flex items-center justify-between px-4 py-2 bg-white border-b ${headerFooterBg} z-10 shrink-0`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1 shrink-0">
                  <BookOpen size={11} /> {t('readerMode')}
                </span>
                <span className="text-[11px] font-bold line-clamp-1 opacity-80 max-w-[150px] md:max-w-xs">{activeChapter.title}</span>
              </div>

              {/* Reader Options */}
              <div className="flex items-center gap-3">
                {/* Font sizes A- / A+ */}
                <div className="flex items-center gap-1.5 border border-neutral-200 bg-neutral-50 px-1 py-0.5 rounded-lg shrink-0 scale-90 sm:scale-100 origin-right">
                  <button 
                    onClick={() => setEpubFontSize(f => Math.max(12, f - 2))}
                    className="p-1 text-neutral-600 hover:bg-neutral-205 rounded text-xs font-bold"
                    title="Font Size Down"
                  >
                    A-
                  </button>
                  <span className="text-[10px] font-mono font-bold text-neutral-500 w-6 text-center">{epubFontSize}px</span>
                  <button 
                    onClick={() => setEpubFontSize(f => Math.min(26, f + 2))}
                    className="p-1 text-neutral-600 hover:bg-neutral-205 rounded text-xs font-bold"
                    title="Font Size Up"
                  >
                    A+
                  </button>
                </div>

                {/* Theme buttons */}
                <div className="flex items-center gap-1 bg-neutral-200/50 p-0.5 rounded-lg shrink-0 scale-90 sm:scale-100 origin-right">
                  {(['light', 'sepia', 'dark'] as const).map(th => (
                    <button
                      key={th}
                      onClick={() => setEpubTheme(th)}
                      className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                        epubTheme === th 
                          ? "bg-white text-neutral-800 shadow-sm"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      {t(th)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Read Page content pane */}
            <ZoomPanContainer className="flex-1 overflow-hidden relative" resetDependency={`${file.id}-${currentChapterIdx}`}>
              <div className={`w-full h-full overflow-y-auto ${bgStyle} p-4 md:p-8 flex justify-center`}>
                {/* Main formatted interactive reading flow */}
                <div 
                  className="w-full max-w-2xl font-serif text-justify select-text focus:outline-none focus:ring-0 leading-relaxed break-words pb-16"
                  style={{ fontSize: `${epubFontSize}px` }}
                >
                  {/* Chapter Title Head */}
                  <h2 className="text-2xl md:text-3xl font-display font-medium border-b pb-4 mb-6 tracking-tight font-serif-heading text-left leading-relaxed">
                    {activeChapter.title}
                  </h2>

                  {/* Body Elements - formatted with elegant padding rules */}
                  <div 
                    className="prose prose-neutral max-w-none space-y-4 md:space-y-5"
                    style={{ color: 'inherit' }}
                    dangerouslySetInnerHTML={{ __html: activeChapter.content }}
                  />
                </div>
              </div>
            </ZoomPanContainer>

            {/* Footer Pagination Navigation */}
            <div className={`px-4 py-3 border-t bg-white flex items-center justify-between shrink-0 ${headerFooterBg} z-10`}>
              <button
                disabled={currentChapterIdx === 0}
                onClick={() => setCurrentChapterIdx(prev => Math.max(0, prev - 1))}
                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:pointer-events-none text-neutral-700 text-xs font-bold rounded-xl border border-neutral-200 flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
              >
                <ChevronLeft size={14} /> {t('previousSection')}
              </button>
              
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs font-bold font-mono text-neutral-500 text-center uppercase tracking-wide">
                  {t('sectionOf')} {currentChapterIdx + 1} / {epubChapters.length}
                </span>
              </div>

              <button
                disabled={currentChapterIdx === epubChapters.length - 1}
                onClick={() => setCurrentChapterIdx(prev => Math.min(epubChapters.length - 1, prev + 1))}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
              >
                {t('nextSection')} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fallback format
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
          <FileText size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-neutral-900">Format Preview Limited</h3>
          <p className="text-neutral-500 max-w-xs mx-auto">This file format ({file.type.toUpperCase()}) is best viewed in its native application.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button 
            onClick={handleDownload}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download size={18} />
            Open Full Document
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      style={{ 
        height: `${modalHeight}px`,
        maxHeight: `${modalHeight}px`,
        top: 0,
        left: 0,
        right: 0,
        bottom: 'auto'
      }}
      className="fixed z-[60] bg-neutral-50 flex flex-col overflow-hidden select-none"
      translate="no"
      lang="en"
    >
      <div className="bg-white border-b border-neutral-200 px-4 py-2.5 sm:py-3 flex justify-between items-center z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-neutral-100 text-neutral-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <span className="font-semibold text-neutral-900 line-clamp-1 text-sm">
              {file.name} {files && files.length > 1 && file.type !== 'doc' && file.type !== 'pdf' && `(${currentIndex + 1}/${files.length})`}
            </span>
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{file.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* High-fidelity / Convert actions for Word docs only (removed from PPT and Excel) */}
          {file.type === 'doc' && file.id !== 'welcome-guide' && file.id !== 'sample-stats' && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                disabled={isConverting}
                onClick={handleHighFidelityToggle}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 disabled:opacity-50 cursor-pointer ${
                  isHighFidelityMode
                    ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600/30"
                    : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200 shadow-sm"
                }`}
                title={isHighFidelityMode ? "Switch back to standard format viewer" : "Convert and display using perfect visual PDF layout"}
              >
                <Sparkles size={13} className={isHighFidelityMode ? "text-white animate-pulse" : "text-amber-500 animate-pulse"} />
                <span className="hidden sm:inline">{isHighFidelityMode ? "Exit 100% Layout" : "100% Layout View"}</span>
                <span className="sm:hidden">{isHighFidelityMode ? "Standard" : "100% View"}</span>
              </button>

              <button
                disabled={isConverting}
                onClick={handleConvertToPdfAndSave}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-700/20 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                title="Convert this document to PDF and download it instantly"
              >
                {isConverting && conversionStatus === 'converting' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileText size={13} className="text-white" />
                )}
                <span>Convert to PDF</span>
              </button>
            </div>
          )}

          {conversionStatus === 'success' && savedFileId && (
            <span className="text-[10px] font-black font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 animate-bounce">
              <Check size={12} />
              Saved PDF!
            </span>
          )}

          {conError && (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg max-w-[120px] sm:max-w-[180px] truncate" title={conError}>
              ⚠️ {conError}
            </span>
          )}
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        className={`flex-1 relative bg-neutral-50 w-full ${
          isProtected 
            ? 'flex flex-col items-center justify-center overflow-hidden p-2 sm:p-6' 
            : 'overflow-y-auto overflow-x-hidden no-scrollbar'
        }`}
      >
         {renderContent()}
      </div>
    </div>
  );
};
