// ShareService.js - Capacitor Version
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Downloads a document from the Node backend and shares the real file.
 * @param {string} filename - The exact name of the file on the server (e.g., "document-12345.pdf" or "document-12345.docx")
 */
export const shareRealFile = async (filename) => {
    try {
        // Resolve backend URL dynamically. If hosted on Koyeb, use the current origin.
        // Otherwise, fallback to the hardcoded local IP address for physical device emulator testing.
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const isLocalHost = origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("capacitor://") || !origin;
        const BACKEND_BASE = isLocalHost ? "http://192.168.43.32:3000" : origin;

        const BACKEND_URL = `${BACKEND_BASE}/api/files/${filename}`;
        console.log(`[Share] Downloading file from server to local cache: ${filename}`);

        // 1. Fetch file as a binary blob from your Node backend
        const response = await fetch(BACKEND_URL);
        if (!response.ok) throw new Error("Failed to fetch file from server.");
        const blob = await response.blob();

        // 2. Convert to Base64 (Capacitor's Filesystem requires base64 data)
        const base64Data = await convertBlobToBase64(blob);

        // 3. Write file securely to the phone's cache directory
        const savedFile = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Cache,
        });

        const ext = filename.split('.').pop()?.toUpperCase() || 'Document';

        // 4. Hand the local file path over to the Android native share sheet
        await Share.share({
            title: 'Share Document',
            text: `Sharing your document: ${filename}`,
            files: [savedFile.uri], // The native file:// identifier
            dialogTitle: `Share your ${ext} via:`,
        });

        console.log(`[Share] Native share sheet opened successfully.`);

    } catch (error) {
        console.error("Direct file sharing failed:", error);
        alert("Sharing Error: We couldn't process and send the real file. Please check your network connection.");
    }
};

// Helper to translate file binary arrays into Base64 web text strings
const convertBlobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
    };
    reader.readAsDataURL(blob);
});