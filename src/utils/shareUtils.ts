import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { storageService } from '../services/storageService';
import { DocFile } from '../types';

// Helper to convert Blob to Base64
const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      const base64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
};

// Writes a Blob to Capacitor filesystem chunk-by-chunk to prevent memory bloating and ANRs
const writeBlobToFilesystemInChunks = async (
  fileName: string,
  blob: Blob,
  directory: Directory
): Promise<string> => {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const totalSize = blob.size;
  let offset = 0;
  let isFirst = true;

  while (offset < totalSize) {
    const chunk = blob.slice(offset, offset + CHUNK_SIZE);
    const base64Data = await convertBlobToBase64(chunk);
    
    if (isFirst) {
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory,
      });
      isFirst = false;
    } else {
      await Filesystem.appendFile({
        path: fileName,
        data: base64Data,
        directory,
      });
    }
    
    offset += CHUNK_SIZE;
    // Yield to the browser main thread to keep it responsive and prevent UI lockup/ANR
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const uriResult = await Filesystem.getUri({
    path: fileName,
    directory,
  });
  return uriResult.uri;
};

// Map file extensions to MIME types
export const getMimeType = (fileName: string, blobType?: string): string => {
  if (blobType && blobType !== 'application/octet-stream') {
    return blobType;
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';
  
  const mimeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'epub': 'application/epub+zip',
    'txt': 'text/plain',
    'csv': 'text/csv'
  };
  return mimeMap[ext] || 'application/octet-stream';
};

// Unified direct share function
export const directShareFile = async (
  file: DocFile,
  htmlContentFallback?: string
): Promise<void> => {
  // 1. Get the binary file data (Blob)
  let fileData = await storageService.getFileData(file.id);
  if (!fileData) {
    if (file.id === 'welcome-guide') {
      fileData = new Blob([htmlContentFallback || "Welcome to PDF Reader Pro!"], { type: 'text/html' });
    } else if (file.id === 'sample-stats') {
      fileData = new Blob(["[]"], { type: 'application/json' });
    } else {
      throw new Error("Could not retrieve file content details to share.");
    }
  }

  const mimeType = getMimeType(file.name, fileData.type);
  const typedBlob = new Blob([fileData], { type: mimeType });

  // 2. Capacitor native platform sharing
  if (Capacitor.isNativePlatform()) {
    const savedFileUri = await writeBlobToFilesystemInChunks(file.name, typedBlob, Directory.Cache);

    await Share.share({
      title: file.name,
      text: `Sharing secure offline file: ${file.name}`,
      files: [savedFileUri],
    });
    return;
  }

  // 3. Web share (navigator.share)
  const shareFile = new File([typedBlob], file.name, { type: mimeType });
  let canShare = false;
  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
      canShare = true;
    }
  } catch (e) {
    console.warn('canShare check failed', e);
  }

  if (canShare) {
    try {
      await navigator.share({
        files: [shareFile],
        title: file.name,
        text: `Share secure offline file: ${file.name}`
      });
      return;
    } catch (err: any) {
      console.warn("navigator.share failed, falling back to download:", err);
      // If the user cancelled/aborted the share sheet, do not trigger download fallback
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('cancel') || err.message?.toLowerCase().includes('abort')) {
        return;
      }
    }
  }

  // 4. Fallback: Direct download copy if native share is not supported
  const url = URL.createObjectURL(typedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Unified direct share multiple files function
export const directShareMultipleFiles = async (
  files: DocFile[]
): Promise<void> => {
  if (!files || files.length === 0) return;

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const formattedSize = (totalSize / 1024).toFixed(1) + " KB";
  const shareMessage = `Sharing ${files.length} secure documents (Total Size: ${formattedSize}) via PDF Reader Pro.`;

  // 1. Capacitor native platform sharing
  if (Capacitor.isNativePlatform()) {
    const fileUris: string[] = [];
    for (const f of files) {
      let fileData = await storageService.getFileData(f.id);
      if (!fileData) {
        if (f.id === 'welcome-guide') {
          fileData = new Blob(["Welcome to PDF Reader! This is a secure local document."], { type: 'application/pdf' });
        } else if (f.id === 'sample-stats') {
          fileData = new Blob(['Sample Excel Data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        } else {
          continue;
        }
      }

      const mimeType = getMimeType(f.name, fileData.type);
      const savedFileUri = await writeBlobToFilesystemInChunks(
        f.name,
        new Blob([fileData], { type: mimeType }),
        Directory.Cache
      );
      fileUris.push(savedFileUri);
    }

    if (fileUris.length > 0) {
      await Share.share({
        title: `Shared ${files.length} Documents`,
        text: shareMessage,
        files: fileUris,
      });
    } else {
      throw new Error("No files to share.");
    }
    return;
  }

  // 2. Web share (navigator.share)
  const filesList: File[] = [];
  for (const f of files) {
    let fileData = await storageService.getFileData(f.id);
    if (!fileData) {
      if (f.id === 'welcome-guide') {
        fileData = new Blob(["Welcome Guide Content"], { type: 'text/html' });
      } else if (f.id === 'sample-stats') {
        fileData = new Blob(["[]"], { type: 'application/json' });
      } else {
        continue;
      }
    }

    const mimeType = getMimeType(f.name, fileData.type);
    filesList.push(new File([fileData], f.name, { type: mimeType }));
  }

  let canShare = false;
  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: filesList })) {
      canShare = true;
    }
  } catch (e) {
    console.warn("canShare failed for multi files", e);
  }

  if (canShare && filesList.length > 0) {
    try {
      await navigator.share({
        files: filesList,
        title: `Shared ${files.length} Documents`,
        text: shareMessage
      });
      return;
    } catch (err: any) {
      console.warn("navigator.share multi failed, falling back to download:", err);
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('cancel') || err.message?.toLowerCase().includes('abort')) {
        return;
      }
    }
  }

  // Download fallback for each file
  for (const f of files) {
    let fileData = await storageService.getFileData(f.id);
    if (!fileData) {
      if (f.id === 'welcome-guide') {
        fileData = new Blob(["Welcome Guide Content"], { type: 'text/html' });
      } else if (f.id === 'sample-stats') {
        fileData = new Blob(["[]"], { type: 'application/json' });
      } else {
        continue;
      }
    }
    const mimeType = getMimeType(f.name, fileData.type);
    const url = URL.createObjectURL(new Blob([fileData], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Robust unified download file function (works seamlessly on Android Capacitor and Web)
export const downloadDocumentFile = async (
  file: DocFile,
  htmlContentFallback?: string
): Promise<void> => {
  try {
    // 1. Retrieve file data
    let fileData = await storageService.getFileData(file.id);
    if (!fileData && file.url) {
      fileData = await storageService.getFileData(file.url);
    }
    if (!fileData && file.url && (file.url.startsWith('http') || file.url.startsWith('blob:') || file.url.startsWith('file://'))) {
      try {
        const res = await fetch(file.url);
        if (res.ok) {
          fileData = await res.blob();
        }
      } catch (e) {
        console.warn("Direct fetch from file.url failed", e);
      }
    }
    if (!fileData) {
      if (file.id === 'welcome-guide') {
        fileData = new Blob([htmlContentFallback || "Welcome to PDF Reader Pro!\n\nThis is your secure offline document."], { type: 'application/pdf' });
      } else if (file.id === 'sample-stats') {
        fileData = new Blob(['Sample Data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }
    }

    if (!fileData) {
      alert(`Could not find document data to download for "${file.name}".`);
      return;
    }

    const mimeType = getMimeType(file.name, fileData.type);
    const typedBlob = new Blob([fileData], { type: mimeType });

    // 2. Native Capacitor download / save to device
    if (Capacitor.isNativePlatform()) {
      const base64Data = await convertBlobToBase64(typedBlob);
      let savedFolder = 'Documents';
      let success = false;

      // Try Directory.Documents first
      try {
        await Filesystem.writeFile({
          path: file.name,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        success = true;
        savedFolder = 'Documents';
      } catch (e1) {
        console.warn("Saving to Directory.Documents failed, trying ExternalStorage/Download", e1);
        try {
          await Filesystem.writeFile({
            path: `Download/${file.name}`,
            data: base64Data,
            directory: Directory.ExternalStorage,
            recursive: true
          });
          success = true;
          savedFolder = 'Downloads';
        } catch (e2) {
          console.warn("Saving to Download failed, trying Cache and native share/save dialog", e2);
          try {
            const cacheResult = await Filesystem.writeFile({
              path: file.name,
              data: base64Data,
              directory: Directory.Cache
            });
            await Share.share({
              title: file.name,
              url: cacheResult.uri,
              dialogTitle: `Save ${file.name}`
            });
            success = true;
            savedFolder = 'Device';
          } catch (e3) {
            console.error("All native write attempts failed", e3);
          }
        }
      }

      if (success) {
        alert(`Downloaded successfully! File saved to ${savedFolder}: ${file.name}`);
      } else {
        alert(`Failed to save ${file.name} to device storage.`);
      }
      return;
    }

    // 3. Web browser direct download
    const url = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err: any) {
    console.error("Failed to download file:", err);
    alert(err?.message || "Failed to download file.");
  }
};
