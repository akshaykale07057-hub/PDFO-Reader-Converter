import init, { convert } from '@briank-dev/pptx2html-turbo';
import fs from 'fs';

async function test() {
  await init();
  const fileBytes = fs.readFileSync('test.pptx');
  const html = convert(new Uint8Array(fileBytes));
  fs.writeFileSync('output.html', html);
  console.log('done');
}

test().catch(console.error);
