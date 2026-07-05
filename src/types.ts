export type FileType = 'pdf' | 'doc' | 'xlsx' | 'ppt' | 'epub' | 'image';

export interface DocFile {
  id: string;
  name: string;
  type: FileType;
  size: number; // in bytes
  createdAt: number;
  lastOpenedAt?: number;
  url: string;
  thumbnail?: string;
}

export type TabType = 'home' | 'files' | 'recent' | 'scan' | 'tools';
