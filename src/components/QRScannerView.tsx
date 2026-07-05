import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Image as ImageIcon, 
  Check, 
  CheckCircle2, 
  Wifi, 
  Plus 
} from 'lucide-react';
import { motion } from 'motion/react';
import jsQR from 'jsqr';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

interface QRScannerViewProps {
  onClose: () => void;
  language?: string;
}

const EnglishQRTranslations = {
  webcamNotEngaged: "Webcam Not Engaged",
  provideAccess: "Provide access or upload an image instead.",
  handleCamera: "Handle Camera",
  parseFromFile: "Parse QR Code from File",
  selectOrDrop: "Select or drop a photo featuring a QR code",
  chooseImage: "Choose Image File",
  decodedSuccessfully: "Decoded Successfully!",
  format: "Format",
  wifiDetails: "Wi-Fi Connection Details",
  ssid: "SSID (Name)",
  password: "Password",
  goToLink: "Go to web Link",
  copyClipboard: "Copy to Clipboard",
  scanAnother: "Scan Another",
  seeking: "Seeking QR code...",
};

const LOCALIZED: Record<string, Record<string, string>> = {
  "English US": EnglishQRTranslations,
  "English UK": EnglishQRTranslations,
  English: EnglishQRTranslations,
  Hindi: {
    webcamNotEngaged: "वेबकैम चालू नहीं है",
    provideAccess: "पहुंच प्रदान करें या इसके बजाय कोई चित्र अपलोड करें।",
    handleCamera: "कैमरा नियंत्रित करें",
    parseFromFile: "फाइल से क्यूआर कोड पढ़ें",
    selectOrDrop: "क्यूआर कोड वाली फोटो चुनें या खींचें",
    chooseImage: "चित्र फ़ाइल चुनें",
    decodedSuccessfully: "सफलतापूर्वक डिकोड किया गया!",
    format: "प्रारूप",
    wifiDetails: "वाई-फाई कनेक्शन विवरण",
    ssid: "SSID (नाम)",
    password: "पासवर्ड",
    goToLink: "वेब लिंक पर जाएं",
    copyClipboard: "क्लिपबोर्ड पर कॉपी करें",
    scanAnother: "दूसरा स्कैन करें",
    seeking: "क्यूआर कोड खोजा जा रहा है...",
  },
  Marathi: {
    webcamNotEngaged: "वेबकॅम चालू नाही",
    provideAccess: "प्रवेश द्या किंवा त्याऐवजी एखादा फोटो अपलोड करा.",
    handleCamera: "कॅमेरा सुरू करा",
    parseFromFile: "फाइलमधून क्यूआर कोड स्कॅन करा",
    selectOrDrop: "क्यूआर कोड असलेला फोटो निवडा किंवा टाका",
    chooseImage: "फोटो निवडा",
    decodedSuccessfully: "यशस्वीरित्या डीकोड केले!",
    format: "स्वरूप",
    wifiDetails: "वाय-फाय कनेक्शन तपशील",
    ssid: "SSID (नाव)",
    password: "पासवर्ड",
    goToLink: "वेब लिंकवर जा",
    copyClipboard: "क्लिपबोर्डवर कॉपी करा",
    scanAnother: "दुसरा स्कैन करा",
    seeking: "क्यूआर कोड शोधत आहे...",
  },
  Gujarati: {
    webcamNotEngaged: "વેબકેમ ચાલુ નથી",
    provideAccess: "ઍક્સેસ આપો અથવા બદલામાં ફોટો અપલોડ કરો.",
    handleCamera: "કેમેરા હેન્ડલ કરો",
    parseFromFile: "ફાઇલમાંથી ક્યુઆર કોડ સ્કેન કરો",
    selectOrDrop: "ક્યુઆર કોડ વાળો ફોટો પસંદ કરો અથવા અહીં ખેંચો",
    chooseImage: "ફોટો ફાઇલ પસંદ કરો",
    decodedSuccessfully: "સફળતાપૂર્વક મેળવવામાં આવ્યું!",
    format: "ફોર્મેટ",
    wifiDetails: "વાઇ-ફાઇ કનેક્શન વિગતો",
    ssid: "SSID (નામ)",
    password: "પાસવર્ડ",
    goToLink: "વેબ લિંક પર જાઓ",
    copyClipboard: "ક્લિપબોર્ડ પર કોપી કરો",
    scanAnother: "બીજો સ્કેન કરો",
    seeking: "કયૂઆર કોડ શોધી રહ્યા છીએ...",
  },
  Tamil: {
    webcamNotEngaged: "வெப்கேம் இயக்கப்படவில்லை",
    provideAccess: "அனுமதியை வழங்கவும் அல்லது படத்தைப் பதிவேற்றவும்.",
    handleCamera: "கேமராவை இயக்கு",
    parseFromFile: "கோப்பிலிருந்து QR குறியீட்டைப் படி",
    selectOrDrop: "QR குறியீடு உள்ள புகைப்படத்தைத் தேர்ந்தெடுக்கவும்",
    chooseImage: "படக் கோப்பைக் தேர்ந்தெடு",
    decodedSuccessfully: "வெற்றிகரமாக குறியீடு பிரிக்கப்பட்டது!",
    format: "வடிவமைப்பு",
    wifiDetails: "வைஃபை இணைப்பு விவரங்கள்",
    ssid: "SSID (பெயர்)",
    password: "கடவுச்சொல்",
    goToLink: "இணைய இணைப்பிற்குச் செல்",
    copyClipboard: "நகலெடு",
    scanAnother: "அடுத்ததை ஸ்கேன் செய்",
    seeking: "QR குறியீட்டைத் தேடுகிறது...",
  },
  Telugu: {
    webcamNotEngaged: "వెబ్‌క్యామ్ ప్రారంభం కాలేదు",
    provideAccess: "యాక్సెస్ ఇవ్వండి లేదా బదులుగా చిత్రాన్ని అప్‌లోడ్ చేయండి.",
    handleCamera: "కెమెరాను నిర్వహించండి",
    parseFromFile: "ఫైల్ నుండి QR కోడ్‌ని స్కాన్ చేయండి",
    selectOrDrop: "QR కోడ్ ఉన్న ఫోటోను ఎంచుకోండి లేదా డ్రాప్ చేయండి",
    chooseImage: "చిత్రం ఫైల్ ఎంచుకోండి",
    decodedSuccessfully: "విజయవంతంగా డీకోడ్ చేయబడింది!",
    format: "ఫార్మాట్",
    wifiDetails: "వై-ఫై కనెక్షన్ వివరాలు",
    ssid: "SSID (పేరు)",
    password: "పాస్‌వర్డ్",
    goToLink: "వెబ్ లింక్‌కి వెళ్ళండి",
    copyClipboard: "క్లిప్‌బోర్డ్‌కు కాపీ చేయి",
    scanAnother: "మరొకటి స్కాన్ చేయి",
    seeking: "QR కోడ్ కోసం వెతుకుతోంది...",
  },
  Spanish: {
    webcamNotEngaged: "Cámara no activada",
    provideAccess: "Permite el acceso o sube una imagen.",
    handleCamera: "Activar cámara",
    parseFromFile: "Escanear desde archivo",
    selectOrDrop: "Arrastra o selecciona una foto con código QR",
    chooseImage: "Elegir archivo de imagen",
    decodedSuccessfully: "¡Decodificado con éxito!",
    format: "Formato",
    wifiDetails: "Detalles de conexión Wi-Fi",
    ssid: "SSID (Nombre)",
    password: "Contraseña",
    goToLink: "Ir al enlace web",
    copyClipboard: "Copiar al portapapeles",
    scanAnother: "Escanear otro",
    seeking: "Buscando código QR...",
  },
  French: {
    webcamNotEngaged: "Caméra non activée",
    provideAccess: "Autorisez l'accès ou téléchargez une image.",
    handleCamera: "Activer la caméra",
    parseFromFile: "Scanner depuis un fichier",
    selectOrDrop: "Sélectionnez ou déposez une photo avec un code QR",
    chooseImage: "Choisir un fichier image",
    decodedSuccessfully: "Décodé avec succès !",
    format: "Format",
    wifiDetails: "Détails de la connexion Wi-Fi",
    ssid: "SSID (Nom)",
    password: "Mot de passe",
    goToLink: "Aller sur le lien",
    copyClipboard: "Copier dans le presse-papiers",
    scanAnother: "Scanner un autre",
    seeking: "Recherche du code QR...",
  },
  Bengali: {
    webcamNotEngaged: "ওয়েবক্যাম চালু নেই",
    provideAccess: "অ্যাক্সেস দিন বা একটি ছবি আপলোড করুন।",
    handleCamera: "क্যামেরা নিয়ন্ত্রণ করুন",
    parseFromFile: "ফাইল থেকে কিউআর কোড স্ক্যান করুন",
    selectOrDrop: "কিউআর কোড সহ ছবি নির্বাচন করুন বা এখানে ড্রপ করুন",
    chooseImage: "ছবি ফাইল নির্বাচন করুন",
    decodedSuccessfully: "সফলভাবে ডিকোড করা হয়েছে!",
    format: "ফরম্যাট",
    wifiDetails: "ওয়াই-ফাই সংযোগের বিবরণ",
    ssid: "SSID (নাম)",
    password: "পাসওয়ার্ড",
    goToLink: "ওয়েব লিঙ্কে যান",
    copyClipboard: "ক্লিপবোর্ডে কপি করুন",
    scanAnother: "অন্যটি স্ক্যান করুন",
    seeking: "কিউআর কোড খোঁজা হচ্ছে...",
  },
  Kannada: {
    webcamNotEngaged: "ವೆಬ್‌ಕ್ಯಾಮ್ ಸಕ್ರಿಯವಾಗಿಲ್ಲ",
    provideAccess: "ಪ್ರವೇಶ ನೀಡಿ ಅಥವಾ ಚಿತ್ರವೊಂದನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
    handleCamera: "ಕ್ಯಾಮೆರಾ ಬಳಸಿ",
    parseFromFile: "ಫೈಲ್‌ನಿಂದ ಕ್ಯೂಆರ್ ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    selectOrDrop: "ಕ್ಯೂಆರ್ ಕೋಡ್ ಇರುವ ಫೋಟೋ ಆಯ್ಕೆ ಮಾಡಿ ಅಥವಾ ಹಾಕಿ",
    chooseImage: "ಚಿತ್ರ ಫೈಲ್ ಆರಿಸಿ",
    decodedSuccessfully: "ಡೀಕೋಡ್ ಯಶಸ್ವಿಯಾಗಿದೆ!",
    format: "ಫಾರ್ಮ್ಯಾಟ್",
    wifiDetails: "ವೈ-ಫೈ ಸಂಪರ್ಕದ ವಿವರಗಳು",
    ssid: "SSID (ಹೆಸರು)",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    goToLink: "ವೆಬ್ ಲಿಂಕ್‌ಗೆ ಹೋಗಿ",
    copyClipboard: "ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ಕಾಪಿ ಮಾಡಿ",
    scanAnother: "ಮತ್ತೊಮ್ಮೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    seeking: "ಕ್ಯೂಆರ್ ಕೋಡ್ ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
  },
  Malayalam: {
    webcamNotEngaged: "വെബ്‌ക്യാം പ്രവർത്തനക്ഷമമല്ല",
    provideAccess: "അനുമതി നൽകുക അല്ലെങ്കിൽ ഫയൽ അപ്‌ലോഡ് ചെയ്യുക.",
    handleCamera: "ക്യാമറ നിയന്ത്രിക്കുക",
    parseFromFile: "ഫയലിൽ നിന്ന് ക്യുആർ കോഡ് സ്കാൻ ചെയ്യുക",
    selectOrDrop: "ക്യുആർ കോഡ് ഉള്ള ഫോട്ടോ തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ ഇടുക",
    chooseImage: "ഫയൽ തിരഞ്ഞെടുക്കുക",
    decodedSuccessfully: "വിജയകരമായി ഡീകോഡ് ചെയ്തു!",
    format: "ഫോർമാറ്റ്",
    wifiDetails: "വൈ-ഫൈ കണക്ഷൻ വിവരങ്ങൾ",
    ssid: "SSID (പേര്)",
    password: "പാസ്‌വേഡ്",
    goToLink: "വെബ് ലിങ്കിലേക്ക് പോകുക",
    copyClipboard: "ക്ലിപ്പ്ബോർഡിലേക്ക് പകർ പകർത്തുക",
    scanAnother: "മറ്റൊന്ന് സ്കാൻ ചെയ്യുക",
    seeking: "ക്യുആർ കോഡ് തിരയുന്നു...",
  },
  Punjabi: {
    webcamNotEngaged: "ਵਾਇਰਸ ਮੁਕਤ ਕੈਮਰਾ",
    provideAccess: "ਪਹੁੰਚ ਦਿਓ ਜਾਂ ਕੋਈ ਫੋਟੋ ਅਪਲੋਡ ਕਰੋ।",
    handleCamera: "ਕੈਮਰਾ ਚਾਲੂ ਕਰੋ",
    parseFromFile: "ਫਾਈਲ ਤੋਂ ਕਿਊਆਰ ਕੋਡ ਪੜ੍ਹੋ",
    selectOrDrop: "ਕਿਊਆਰ ਕੋਡ ਵਾਲੀ ਫੋਟੋ ਚੁਣੋ ਜਾਂ ਖਿੱਚੋ",
    chooseImage: "ਫੋਟੋ ਫਾਈਲ ਚੁਣੋ",
    decodedSuccessfully: "ਸਫਲਤਾਪੂਰਵਕ ਡੀਕੋਡ ਕੀਤਾ ਗਿਆ!",
    format: "ਫਾਰਮੈਟ",
    wifiDetails: "ਵਾਈ-ਫਾਈ ਕਨੈਕਸ਼ਨ ਵੇਰਵੇ",
    ssid: "SSID (ਨਾਮ)",
    password: "ਪਾਸਵਰਡ",
    goToLink: "ਵੈੱਬ ਲਿੰਕ 'ਤੇ ਜਾਓ",
    copyClipboard: "ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਕਰੋ",
    scanAnother: "ਦੂਜਾ ਸਕੈਨ ਕਰੋ",
    seeking: "ਕਿਊਆਰ ਕੋਡ ਲੱਭਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
  },
  German: {
    webcamNotEngaged: "Webcam nicht aktiv",
    provideAccess: "Zugriff erlauben oder stattdessen ein Bild hochladen.",
    handleCamera: "Kamera aktivieren",
    parseFromFile: "QR-Code aus Datei lesen",
    selectOrDrop: "Wähle ein Foto mit einem QR-Code aus",
    chooseImage: "Bilddatei auswählen",
    decodedSuccessfully: "Erfolgreich entschlüsselt!",
    format: "Format",
    wifiDetails: "WLAN-Verbindungsdetails",
    ssid: "SSID (Name)",
    password: "Passwort",
    goToLink: "Web-Link öffnen",
    copyClipboard: "In Zwischenablage kopieren",
    scanAnother: "Anderes scannen",
    seeking: "Suche QR-Code...",
  },
  Portuguese: {
    webcamNotEngaged: "Webcam inativa",
    provideAccess: "Ative o acesso ou envie uma imagem.",
    handleCamera: "Ativar câmera",
    parseFromFile: "Ler QR Code de arquivo",
    selectOrDrop: "Escolha ou arraste uma foto com QR code",
    chooseImage: "Escolher arquivo de imagem",
    decodedSuccessfully: "Decodificado com sucesso!",
    format: "Formato",
    wifiDetails: "Detalhes de conexão Wi-Fi",
    ssid: "SSID (Nome)",
    password: "Senha",
    goToLink: "Ir para o link",
    copyClipboard: "Copiar para área de transferência",
    scanAnother: "Escanear outro",
    seeking: "Buscando QR code...",
  },
  Arabic: {
    webcamNotEngaged: "كاميرا الويب غير متصلة",
    provideAccess: "امسح الإذن أو ارفع صورة بدلاً من ذلك.",
    handleCamera: "تشغيل الكاميرا",
    parseFromFile: "قراءة رمز QR من ملف",
    selectOrDrop: "اختر أو اسحب صورة تحتوي على رمز QR",
    chooseImage: "اختر ملف الصورة",
    decodedSuccessfully: "تم فك التشفير بنجاح!",
    format: "الصيغة",
    wifiDetails: "تفاصيل اتصال Wi-Fi",
    ssid: "اسم الشبكة (SSID)",
    password: "كلمة المرور",
    goToLink: "انتقل إلى الرابط",
    copyClipboard: "نسخ إلى الحافظة",
    scanAnother: "مسح آخر",
    seeking: "البحث عن رمز QR...",
  },
  Japanese: {
    webcamNotEngaged: "ウェブカメラが無効です",
    provideAccess: "アクセスを許可するか画像をアップロードしてください。",
    handleCamera: "カメラを使用する",
    parseFromFile: "ファイルからQRコードを読み取る",
    selectOrDrop: "QRコード付きのフォトレポートを選択またはドロップしてください",
    chooseImage: "画像ファイルを選択",
    decodedSuccessfully: "デコードに成功しました！",
    format: "形式",
    wifiDetails: "Wi-Fi接続の詳細",
    ssid: "SSID (ネットワーク名)",
    password: "パスワード",
    goToLink: "ウェブリンクを開く",
    copyClipboard: "クリップボードにコピー",
    scanAnother: "別のコードをスキャン",
    seeking: "QRコードを検出中...",
  }
};

export const QRScannerView: React.FC<QRScannerViewProps> = ({ onClose, language = 'English US' }) => {
  const dict = LOCALIZED[language] || LOCALIZED.English;
  const t = (key: string) => dict[key] || LOCALIZED.English[key] || key;
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'url' | 'wifi' | 'text'>('text');
  const [isCopied, setIsCopied] = useState(false);
  
  const handleOpenUrl = async (url: string) => {
    if (!url) return;
    const trimmedUrl = url.trim();
    if (Capacitor.isNativePlatform()) {
      try {
        await AppLauncher.openUrl({ url: trimmedUrl });
      } catch (err) {
        console.warn('AppLauncher failed to open URL, falling back:', err);
        window.open(trimmedUrl, '_system');
      }
    } else {
      window.open(trimmedUrl, '_blank', 'noopener,noreferrer');
    }
  };
  
  // Camera scanning states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [hasScannedSuccess, setHasScannedSuccess] = useState(false);

  // Ref assignments
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanLoopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFullFrameRef = useRef(false);


  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start scanning loop
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setScanResult(null);
    setHasScannedSuccess(false);

    try {
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
        throw new Error('Your browser does not support raw video stream input. Use an image file or modern browser.');
      }

      let stream: MediaStream;
      try {
        // Attempt 1: Ideal HD constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (err: any) {
        console.warn('Ideal HD constraints failed, trying 640x480 constraints:', err);
        try {
          // Attempt 2: Simpler constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
          });
        } catch (err2) {
          console.warn('Simpler constraints failed, trying facing mode only:', err2);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: facingMode } }
            });
          } catch (err3) {
            console.warn('Facing mode constraints failed, trying any video stream:', err3);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        const onReady = () => {
          console.log('QR Scanner Video ready');
          videoRef.current?.play().catch(() => {});
        };

        // Attach event listeners to guarantee catching metadata/data load events
        videoRef.current.onloadedmetadata = onReady;
        videoRef.current.onloadeddata = onReady;
        videoRef.current.oncanplay = onReady;

        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        
        videoRef.current.play().then(() => {
          console.log('Successfully started QR video stream playback programmatically.');
        }).catch(e => {
          console.warn('Explicit play() command was blocked or failed:', e);
        });

        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Webcam start failed:', err);
      const errMessage = err.message || err.toString();
      if (Capacitor.isNativePlatform()) {
        setCameraError(`Camera access failed: ${errMessage}. Please ensure camera permissions are granted in settings.`);
      } else {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || errMessage.toLowerCase().includes('denied')) {
          setCameraError('Camera access was denied. Please allow camera access in your browser settings.');
        } else {
          setCameraError(`Camera access failed: ${errMessage}`);
        }
      }
    }
  }, [facingMode, stopCamera]);

  const scanNativePhoto = (webPath: string) => {
    setIsSearchingImage(true);
    setCameraError(null);
    const img = new Image();
    img.onload = () => {
      const offscreenCanvas = document.createElement('canvas');
      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) {
        setIsSearchingImage(false);
        alert('Could not initialize scanning canvas');
        return;
      }
      offscreenCanvas.width = img.width;
      offscreenCanvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      setIsSearchingImage(false);
      if (code) {
        handleQRCodeDecoded(code.data);
      } else {
        alert('No valid QR code detected in this photo. Please get closer and make sure the QR code is clear and in focus.');
      }
    };
    img.onerror = () => {
      setIsSearchingImage(false);
      alert('Failed to load image for scanning.');
    };
    img.src = webPath;
  };

  const handleNativeCameraScan = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        presentationStyle: 'fullscreen'
      });
      if (photo && photo.webPath) {
        scanNativePhoto(photo.webPath);
      }
    } catch (err) {
      console.warn('Native camera capture failed or cancelled:', err);
    }
  };

  // Decode from file upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSearchingImage(true);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const offscreenCanvas = document.createElement('canvas');
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) {
          setIsSearchingImage(false);
          alert('Could not initialize scanning canvas');
          return;
        }

        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        setIsSearchingImage(false);
        if (code) {
          handleQRCodeDecoded(code.data);
        } else {
          alert('No valid QR code detected in this image. Please ensure the QR code is clearly visible and centered.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleQRCodeDecoded = (data: string) => {
    // Immediate vibration/feedback
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    setScanResult(data);
    setHasScannedSuccess(true);

    const trimmed = data.trim();
    const isUrl = /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed);
    const isWifi = trimmed.startsWith('WIFI:');
    setScanType(isUrl ? 'url' : (isWifi ? 'wifi' : 'text'));

    // Trigger stop of active feed
    stopCamera();

    if (isUrl) {
      handleOpenUrl(trimmed);
    }
  };

  // Live Canvas Tick Process
  useEffect(() => {
    if (!isCameraActive || hasScannedSuccess) return;

    const tick = () => {
      if (!videoRef.current || !canvasRef.current) {
        scanLoopRef.current = requestAnimationFrame(tick);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        const scanFullFrame = scanFullFrameRef.current;
        scanFullFrameRef.current = !scanFullFrame;

        if (scanFullFrame) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else {
          // Cropped center box scan for high resolution and accuracy
          const scanSize = Math.floor(Math.min(video.videoWidth, video.videoHeight) * 0.7);
          const sx = Math.floor((video.videoWidth - scanSize) / 2);
          const sy = Math.floor((video.videoHeight - scanSize) / 2);
          canvas.width = scanSize;
          canvas.height = scanSize;
          ctx.drawImage(video, sx, sy, scanSize, scanSize, 0, 0, scanSize, scanSize);
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          handleQRCodeDecoded(code.data);
          return; // Escape animation loop
        }
      }
      scanLoopRef.current = requestAnimationFrame(tick);
    };

    scanLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, [isCameraActive, hasScannedSuccess]);

  // Clean-up hook on unmount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Copy scan results
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getSsidFromWifiString = (wifiStr: string) => {
    const ssidMatch = wifiStr.match(/S:([^;]+)/);
    return ssidMatch ? ssidMatch[1] : 'Unknown Network';
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]" ref={containerRef}>
      {/* Main Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 pb-24">
        {!scanResult ? (
          <div className="space-y-6">
            <div className="relative aspect-square w-full max-w-[340px] mx-auto rounded-[32px] overflow-hidden bg-black border-4 border-white shadow-2xl flex flex-col justify-between">
              <canvas ref={canvasRef} className="hidden" />
              
              <video 
                ref={videoRef} 
                className={`w-full h-full object-cover ${isCameraActive ? "" : "hidden"}`}
                playsInline
                muted
              />

              {isCameraActive ? (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Laser scanning strip */}
                  <motion.div 
                    className="absolute inset-x-4 h-1 bg-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.8)]" 
                    animate={{ top: ['5%', '95%', '5%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  />
                  
                  {/* Interactive Bounding box brackets */}
                  <div className="absolute inset-12 pointer-events-none flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
                      <div className="w-10 h-10 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
                    </div>
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
                      <div className="w-10 h-10 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-neutral-950">
                  <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 mb-4 animate-pulse">
                    <Camera size={28} />
                  </div>
                  <p className="text-sm font-bold text-neutral-300">{t('webcamNotEngaged')}</p>
                  <p className="text-xs text-neutral-500 mt-1 pb-4">{t('provideAccess')}</p>
                  {cameraError && (
                    <p className="text-[11px] text-red-400 bg-red-950/20 border border-red-500/20 rounded-lg py-1.5 px-3 mb-4 max-w-[280px] leading-normal break-words">
                      {cameraError}
                    </p>
                  )}
                  
                  <div className="flex flex-col gap-2 w-full max-w-[240px] mx-auto z-10 pointer-events-auto">
                    <button 
                      onClick={startCamera}
                      className="py-2.5 px-5 bg-blue-500 hover:bg-blue-600 rounded-full text-xs font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw size={14} /> {t('handleCamera')}
                    </button>
                    {Capacitor.isNativePlatform() && (
                      <button 
                        onClick={handleNativeCameraScan}
                        className="py-2.5 px-5 bg-neutral-800 hover:bg-neutral-755 text-neutral-200 border border-neutral-700/60 rounded-full text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Camera size={14} /> Launch System Camera
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Scanning active tags overlay */}
              {isCameraActive && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  {t('seeking')}
                </div>
              )}
            </div>

            {/* Upload Section Option */}
            <div className="border border-neutral-200 border-dashed rounded-[32px] bg-white p-6 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-400 mx-auto">
                <ImageIcon size={26} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-850">{t('parseFromFile')}</p>
                <p className="text-xs text-neutral-400">{t('selectOrDrop')}</p>
              </div>

              <div className="relative overflow-hidden inline-block mx-auto">
                <button className="bg-neutral-900 text-white font-bold text-xs py-3.5 px-6 rounded-full hover:bg-neutral-850 active:scale-95 transition-all flex items-center gap-2 shadow-md">
                  {isSearchingImage ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                  {t('chooseImage')}
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  disabled={isSearchingImage}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </div>
            </div>
          </div>
        ) : (
          /* RESULTS VIEWER OVERLAY CANVAS */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-neutral-200/60 rounded-[32px] p-6 shadow-xl space-y-6 text-neutral-900"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 animate-bounce">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-neutral-900 leading-tight">{t('decodedSuccessfully')}</h3>
                <p className="text-xs text-neutral-400 font-medium tracking-wide uppercase mt-0.5">{t('format')}: QR Code ({scanType})</p>
              </div>
            </div>

            {/* Content Payload block */}
            <div className="bg-neutral-50 border border-neutral-200/40 rounded-2xl p-5 break-words space-y-3 font-mono text-sm leading-relaxed relative ring-2 ring-emerald-500/5">
              <div className="text-neutral-700 select-all font-medium pr-8">{scanResult}</div>
              
              {scanType === 'wifi' && (
                <div className="mt-3 bg-white p-3.5 rounded-xl border border-neutral-200/50 space-y-2 text-xs font-sans">
                  <div className="flex items-center gap-2 font-bold text-neutral-800"><Wifi size={14} className="text-emerald-500" /> {t('wifiDetails')}</div>
                  <div className="grid grid-cols-2 gap-2 text-neutral-600">
                    <div>{t('ssid')}:</div>
                    <div className="font-bold text-neutral-900">{getSsidFromWifiString(scanResult)}</div>
                    <div>{t('password')}:</div>
                    <div className="font-bold text-neutral-900">••••••••</div>
                  </div>
                </div>
              )}

              <button 
                onClick={() => copyToClipboard(scanResult)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 bg-white shadow-sm border border-neutral-200/60 w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                title="Copy Payload"
              >
                {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Operations buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {scanType === 'url' && (
                <button 
                  onClick={() => handleOpenUrl(scanResult)}
                  className="flex-1 py-4 bg-red-500 hover:bg-red-650 text-white rounded-full font-bold text-center text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <ExternalLink size={14} />
                  {t('goToLink')}
                </button>
              )}

              <button 
                onClick={() => copyToClipboard(scanResult)}
                className="flex-1 py-4 bg-neutral-900 hover:bg-neutral-850 text-white rounded-full font-bold text-xs flex items-center justify-center gap-1.5 border border-neutral-800 shadow-md active:scale-95 transition-all"
              >
                <Copy size={14} />
                {t('copyClipboard')}
              </button>
              
              <button 
                onClick={startCamera}
                className="w-full py-4 border border-neutral-200/70 hover:bg-neutral-50 rounded-full font-bold text-neutral-700 text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                {t('scanAnother')}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
