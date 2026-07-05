import { jsPDF } from "jspdf";

export const imagesToPdf = async (images: string[]): Promise<Blob> => {
  const pdf = new jsPDF();
  
  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage();
    
    const img = images[i];
    const imgProps = pdf.getImageProperties(img);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(img, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  }
  
  return pdf.output('blob');
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
