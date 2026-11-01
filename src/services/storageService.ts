import { get, set, del, keys, getMany, setMany } from 'idb-keyval';
import { DocFile } from '../types';

const STORE_NAME = 'real-files';

export const storageService = {
  async saveFile(file: DocFile & { data?: Blob }): Promise<void> {
    const { id, ...metadata } = file;
    await set(`${id}-meta`, metadata);
    if (file.data) {
      await set(`${id}-data`, file.data);
    }
  },

  async saveFilesBatch(fileList: (DocFile & { data?: Blob })[]): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    const entries: [IDBValidKey, any][] = [];
    for (const file of fileList) {
      const { id, ...metadata } = file;
      entries.push([`${id}-meta`, metadata]);
      if (file.data) {
        entries.push([`${id}-data`, file.data]);
      }
    }
    await setMany(entries);
  },

  async getFiles(): Promise<DocFile[]> {
    const allKeys = await keys();
    const metaKeys = allKeys.filter(k => typeof k === 'string' && k.endsWith('-meta')) as string[];
    if (metaKeys.length === 0) return [];

    const allMeta = await getMany(metaKeys);
    const files: DocFile[] = [];
    for (let i = 0; i < metaKeys.length; i++) {
      const key = metaKeys[i];
      const meta = allMeta[i];
      if (meta) {
        const id = key.replace('-meta', '');
        let type = meta.type;
        if (type === 'docx') type = 'doc';
        if (type === 'xlsx' || type === 'xls') type = 'xlsx';
        if (type === 'pptx') type = 'ppt';
        files.push({ ...meta, id, type });
      }
    }
    return files.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.name.localeCompare(b.name));
  },

  async getFileData(id: string): Promise<Blob | null> {
    const isNativePath = id.startsWith('file://') || id.startsWith('content://') || id.startsWith('/') || id.includes(':/');
    if (isNativePath) {
      console.log(`[StorageService] Attempting to load native file: ${id}`);
      
      // 1. Try fetching via convertFileSrc (most efficient)
      try {
        const { Capacitor } = await import('@capacitor/core');
        const webviewUrl = Capacitor.convertFileSrc(id);
        console.log(`[StorageService] Converted to Webview URL: ${webviewUrl}`);
        const response = await fetch(webviewUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        console.log(`[StorageService] Successfully loaded via fetch. Blob size: ${blob.size}`);
        return blob;
      } catch (e) {
        console.warn("[StorageService] Fetch loading failed. Falling back to Filesystem.readFile", e);
        
        // 2. Fallback to Filesystem.readFile
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          
          // Clean the path (remove file:// scheme and decode special characters)
          let cleanPath = id;
          if (cleanPath.startsWith('file://')) {
            cleanPath = cleanPath.substring(7); // Remove 'file://'
          } else if (cleanPath.startsWith('file:')) {
            cleanPath = cleanPath.substring(5); // Remove 'file:'
          }
          try {
            cleanPath = decodeURIComponent(cleanPath);
          } catch (decodeErr) {
            console.warn("[StorageService] URI decode failed:", cleanPath, decodeErr);
          }
          
          console.log(`[StorageService] Reading path via Filesystem: ${cleanPath}`);
          const result = await Filesystem.readFile({
            path: cleanPath
          });
          
          const ext = cleanPath.split('.').pop()?.toLowerCase();
          let mimeType = 'application/octet-stream';
          if (ext === 'pdf') mimeType = 'application/pdf';
          else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (ext === 'doc') mimeType = 'application/msword';
          else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          else if (ext === 'xls') mimeType = 'application/vnd.ms-excel';
          else if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          else if (ext === 'ppt') mimeType = 'application/vnd.ms-powerpoint';
          
          const base64Data = typeof result.data === 'string' ? result.data : '';
          
          // Fast native base64 conversion fallback using data URI
          const dataUri = `data:${mimeType};base64,${base64Data}`;
          const response = await fetch(dataUri);
          const blob = await response.blob();
          console.log(`[StorageService] Successfully loaded via Filesystem fallback. Blob size: ${blob.size}`);
          return blob;
        } catch (fallbackErr) {
          console.error("[StorageService] Both fetch and Filesystem fallback failed to read native file", fallbackErr);
          return null;
        }
      }
    }
    return await get(`${id}-data`);
  },

  async deleteFile(id: string): Promise<void> {
    await del(`${id}-meta`);
    await del(`${id}-data`);
  },

  async renameFile(id: string, newName: string): Promise<void> {
    const meta = await get(`${id}-meta`);
    if (meta) {
      meta.name = newName;
      await set(`${id}-meta`, meta);
    }
  }
};
