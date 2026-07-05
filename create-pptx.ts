import PptxGenJS from 'pptxgenjs';
import fs from 'fs';

async function create() {
  const pres = new PptxGenJS();
  pres.addSlide().addText("Slide 1");
  pres.addSlide().addText("Slide 2");
  await pres.writeFile({ fileName: 'test.pptx' });
}

create().catch(console.error);
