import PptxGenJS from "pptxgenjs";
const pres = new PptxGenJS();
pres.defineLayout({ name: 'CUSTOM_PDF', width: 8.5, height: 11 });
pres.layout = 'CUSTOM_PDF';
const slide = pres.addSlide();
slide.addImage({ data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', x: 0, y: 0, w: '100%', h: '100%' });
pres.write({ outputType: 'arraybuffer' }).then(ab => console.log('success', (ab as ArrayBuffer).byteLength)).catch(console.error);
