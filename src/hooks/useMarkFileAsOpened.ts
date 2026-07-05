import { storageService } from '../services/storageService';
import { DocFile } from '../types';

export const useMarkFileAsOpened = () => {
  const markFileAsOpened = async (file: DocFile) => {
    const updatedFile = { ...file, lastOpenedAt: Date.now() };
    await storageService.saveFile(updatedFile);
  };
  return markFileAsOpened;
};
