import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

console.log("====================================================");
console.log("🔍 Diagnostic Script: Document Conversion Framework");
console.log("====================================================");

async function runDiagnostics() {
  // 1. Check if LibreOffice is installed
  const hasLibreOffice = await new Promise((resolve) => {
    exec("soffice --version", (err, stdout) => {
      if (err) {
        console.log("⚠️ System LibreOffice not found. System will automatically direct all server-side document conversions to the high-fidelity Pure JS fallback engines (mammoth + pdf-lib).");
        resolve(false);
      } else {
        console.log(`✅ System LibreOffice detected: ${stdout.trim()}`);
        resolve(true);
      }
    });
  });

  // 2. Generate a perfectly valid, uncorrupt DOCX file dynamically for accurate testing
  console.log("📝 Generating a valid test DOCX file...");
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "System Test Document",
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "This document was generated programmatically by the diagnostic runner to verify the document conversion API.",
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "If LibreOffice is absent from this system, the backend uses an advanced pure-JS engine to extract this text and format it into a standard A4 PDF document securely.",
              size: 22,
            }),
          ],
        }),
      ],
    }],
  });

  const docBytes = await Packer.toBuffer(doc);
  const testFile = "test_generated.docx";
  fs.writeFileSync(testFile, docBytes);
  console.log(`📂 Valid test document created: "${testFile}" (${docBytes.length} bytes)`);

  const inputPath = path.resolve(testFile);
  const outDir = path.resolve('./server/uploads');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, 'test_diagnostic_output.pdf');

  // Ensure output is clean before start
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  console.log("⏳ Running document-to-pdf conversion stream...");

  try {
    const isDocx = testFile.endsWith('.docx') || testFile.endsWith('.doc');
    let textContent = "";

    if (hasLibreOffice) {
      console.log("🛠️ Invoking system head-less converting subprocess...");

      const isWindows = os.platform() === 'win32';
      let cmd = "";

      if (isWindows) {
        // ✨ FIXED FOR WINDOWS: No broken Linux /tmp paths, letting Windows native engine allocate profiles safely
        cmd = `soffice --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to pdf --outdir "${outDir}" "${inputPath}"`;
      } else {
        // Safe container mode layout fallback for Linux deployments
        const loProfile = `/tmp/lo_test_v_${Date.now()}`;
        cmd = `soffice --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo "-env:UserInstallation=file://${loProfile}" --convert-to pdf --outdir "${outDir}" "${inputPath}"`;
      }

      await new Promise((resolve, reject) => {
        // Pass system profile paths cleanly if on non-windows containers
        const execOptions = isWindows ? {} : { env: { ...process.env, HOME: '/tmp' } };

        exec(cmd, execOptions, (ex) => {
          if (ex) reject(ex);
          else resolve();
        });
      });

      const genericOutput = path.join(outDir, path.basename(inputPath, path.extname(inputPath)) + '.pdf');
      if (fs.existsSync(genericOutput)) {
        fs.renameSync(genericOutput, outputPath);
      }
    } else {
      console.log("🚀 Emulating Pure JS converting engine backup routine...");
      if (isDocx) {
        const docResult = await mammoth.extractRawText({ path: inputPath });
        textContent = docResult.value || "Empty Word content.";
      } else {
        textContent = fs.readFileSync(inputPath, 'utf8');
      }

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const fontSize = 11;
      const margin = 50;
      const pageHeight = 842;
      const pageWidth = 595;
      const contentWidth = pageWidth - (margin * 2);
      const lineHeight = fontSize + 4;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let currentY = pageHeight - margin;

      page.drawText(`Converted Document Output`, {
        x: margin,
        y: currentY,
        size: 14,
        font: boldFont,
        color: rgb(0.1, 0.3, 0.6)
      });
      currentY -= 20;

      page.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8)
      });
      currentY -= 20;

      const paragraphs = textContent.split('\n');
      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed) {
          currentY -= lineHeight / 2;
          continue;
        }

        const words = trimmed.split(/\s+/);
        let currentLine = "";
        const lines = [];

        for (const w of words) {
          const testL = currentLine ? `${currentLine} ${w}` : w;
          const wSize = font.widthOfTextAtSize(testL, fontSize);
          if (wSize < contentWidth) {
            currentLine = testL;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = w;
          }
        }
        if (currentLine) lines.push(currentLine);

        for (const l of lines) {
          if (currentY < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          page.drawText(l, {
            x: margin,
            y: currentY,
            size: fontSize,
            font: font,
            color: rgb(0.15, 0.15, 0.15)
          });
          currentY -= lineHeight;
        }
        currentY -= 4;
      }

      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);
    }

    if (fs.existsSync(outputPath)) {
      console.log(`\n🎉 SUCCESS! Converted file generated successfully:`);
      console.log(`👉 File location: ${outputPath}`);
      console.log(`👉 File size: ${fs.statSync(outputPath).size} bytes`);
    } else {
      console.error("\n❌ FAILED: Output file was not found under the expected destination.");
    }

    // Clean up temporary generated DOCX
    try {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (_) { }

  } catch (error) {
    console.error("\n❌ CRITICAL: Test diagnostic run received an exception:", error);
  }
}

runDiagnostics();