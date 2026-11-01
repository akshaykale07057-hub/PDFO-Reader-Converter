import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { DocFile } from '../types';

interface AllFilesAccessPlugin {
    checkPermission(): Promise<{ granted: boolean }>;
    requestPermission(): Promise<{ requested: boolean; error?: string }>;
}

export const AllFilesAccess = registerPlugin<AllFilesAccessPlugin>('AllFilesAccess');

export const scanDeviceForDocuments = async (): Promise<DocFile[]> => {
    // 1. Request standard storage permissions (shows Allow/Deny popup)
    try {
        const currentPermission = await Filesystem.checkPermissions();
        if (currentPermission.publicStorage !== 'granted') {
            const request = await Filesystem.requestPermissions();
            if (request.publicStorage !== 'granted') {
                console.error("Storage permission denied.");
                return [];
            }
        }
    } catch (e) {
        console.warn("Standard permission check failed:", e);
    }

    const foundFiles: DocFile[] = [];
    // "" reads the root directory, which helps catch documents floating in storage
    const targetFolders = ['', 'Download', 'Documents', 'download', 'documents'];

    // 2. Scan Storage
    for (const folder of targetFolders) {
        try {
            const result = await Filesystem.readdir({
                path: folder,
                directory: Directory.ExternalStorage,
            });

            if (!result.files) continue;

            result.files.forEach((file: any) => {
                // Handle both older Capacitor string arrays and newer Object arrays
                const fileName = typeof file === 'string' ? file : file.name;
                const fileUri = typeof file === 'object' ? file.uri : '';

                if (!fileName) return;

                const ext = fileName.split('.').pop()?.toLowerCase();

                const extMap: Record<string, DocFile['type']> = {
                    'pdf': 'pdf',
                    'doc': 'doc',
                    'docx': 'doc',
                    'xls': 'xlsx',
                    'xlsx': 'xlsx',
                    'ppt': 'ppt',
                    'pptx': 'ppt'
                };

                if (ext && extMap[ext]) {
                    const mappedType = extMap[ext];
                    // Avoid adding duplicates if scanning overlapping directories
                    if (!foundFiles.some(f => f.name === fileName)) {
                        foundFiles.push({
                            id: fileUri || fileName,
                            name: fileName,
                            type: mappedType,
                            size: file.size || 0,
                            createdAt: file.mtime || Date.now(),
                            url: fileUri || '',
                        });
                    }
                }
            });
        } catch (e) {
            console.warn(`Could not read directory branch: "${folder}"`, e);
        }
    }

    return foundFiles;
};