const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const mammoth = require("mammoth");



function makeTempProfileDir() {
    const id = crypto.randomBytes(8).toString("hex");
    const dir = path.join(os.tmpdir(), `lo_profile_${id}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function execAsync(cmd, options = {}, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const child = exec(cmd, options, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message));
            else resolve(stdout);
        });
        setTimeout(() => {
            try { child.kill(); } catch { }
            reject(new Error("LibreOffice conversion timed out"));
        }, timeoutMs);
    });
}

// Memory gate to guarantee a 512MB Free Server never crashes
let isSystemBusy = false;

// ─────────────────────────────────────────────
// Main Converter
// ─────────────────────────────────────────────

async function convertAnyToPdf(inputPath, outputPath, originalName) {
    if (isSystemBusy) {
        throw new Error("SERVER_BUSY");
    }

    try {
        isSystemBusy = true; // Lock memory stream

        const extension = (originalName.split(".").pop() || "").toLowerCase();
        const outputDir = path.dirname(outputPath);
        const isWindows = process.platform === "win32";

        // ============================================================
        // LAYER 1: LibreOffice — Stabilized Reliable Arguments
        // ============================================================
        const profileDir = makeTempProfileDir();
        try {
            // STABILIZATION FIX: Instead of raw nested JSON arrays that break bash parsers,
            // standard high-compatibility export is achieved using standard filter flags.
            const filterArg = "pdf:writer_pdf_Export";

            let cmd;
            if (isWindows) {
                const soffice = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`;
                cmd = [
                    soffice,
                    "--headless",
                    "--invisible",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--nolockcheck",
                    "--nologo",
                    `--convert-to "${filterArg}"`,
                    `--outdir "${outputDir}"`,
                    `"${inputPath}"`,
                ].join(" ");
            } else {
                cmd = [
                    "soffice",
                    "--headless",
                    "--invisible",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--nolockcheck",
                    "--nologo",
                    `"-env:UserInstallation=file://${profileDir}"`,
                    `--convert-to '${filterArg}'`,
                    `--outdir "${outputDir}"`,
                    `"${inputPath}"`,
                ].join(" ");
            }

            console.log("[Conversion] Invoking Headless LibreOffice Pipeline...");

            const env = isWindows
                ? { ...process.env }
                : {
                    ...process.env,
                    SAL_USE_VCLPLUGIN: "svp",
                    DISPLAY: "",
                };

            await execAsync(cmd, { env }, 90_000);

            const expectedPdfName = path.basename(inputPath, path.extname(inputPath)) + ".pdf";
            const generatedPdfPath = path.join(outputDir, expectedPdfName);

            if (fs.existsSync(generatedPdfPath)) {
                if (generatedPdfPath !== outputPath) {
                    fs.renameSync(generatedPdfPath, outputPath);
                }
                console.log("[Conversion] ✅ LibreOffice Layer: Layout preserved successfully.");
                return;
            }

            throw new Error("LibreOffice ran but output PDF not found.");
        } catch (err) {
            console.warn("[Conversion] ⚠️ LibreOffice Layer failed:", err.message);
        } finally {
            cleanupDir(profileDir);
        }

        // ============================================================
        // LAYER 2: Gotenberg Microservice Fallback
        // ============================================================
        const gotenbergUrl = process.env.GOTENBERG_URL || "https://demo.gotenberg.dev";

        try {
            console.log("[Conversion] Attempting Gotenberg API Fallback...");
            const fileBuffer = fs.readFileSync(inputPath);

            // Native boundary builder compatible across all node runtime versions
            const formData = new FormData();
            formData.append("files", new Blob([fileBuffer]), originalName);

            const gotenbergRes = await fetch(
                `${gotenbergUrl}/forms/libreoffice/convert`,
                {
                    method: "POST",
                    body: formData,
                    signal: AbortSignal.timeout(60_000),
                }
            );

            if (gotenbergRes.ok) {
                const buffer = await gotenbergRes.arrayBuffer();
                fs.writeFileSync(outputPath, Buffer.from(buffer));
                console.log("[Conversion] ✅ Gotenberg Layer: Conversion successful.");
                return;
            }

            throw new Error(`Gotenberg responded with status ${gotenbergRes.status}`);
        } catch (err) {
            console.warn("[Conversion] ⚠️ Gotenberg Layer failed:", err.message);
        }

        // ============================================================
        // LAYER 3: Pure JS Fallback (Text Extraction Engine)
        // ============================================================
        console.log("[Conversion] 🚨 Falling back to Pure JS text extraction...");

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const fontSize = 11;
        const margin = 50;
        const pageWidth = 595;
        const pageHeight = 842;
        const contentWidth = pageWidth - margin * 2;
        const lineHeight = fontSize + 4;

        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        let currentY = pageHeight - margin;

        const addPageIfNeeded = () => {
            if (currentY < margin + lineHeight) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                currentY = pageHeight - margin;
            }
        };

        page.drawText(`Converted Document: ${originalName}`, {
            x: margin, y: currentY, size: 14,
            font: boldFont, color: rgb(0.1, 0.3, 0.6),
        });
        currentY -= 40;

        let textContent = "";
        if (extension === "docx" || extension === "doc") {
            try {
                const res = await mammoth.extractRawText({ path: inputPath });
                textContent = res.value;
            } catch {
                textContent = "[Could not extract text from Word document]";
            }
        } else {
            try {
                textContent = fs.readFileSync(inputPath, "utf-8");
            } catch {
                textContent = "[Could not read file content]";
            }
        }

        for (const para of textContent.split("\n")) {
            const trimmed = para.trim();
            if (!trimmed) { currentY -= lineHeight; continue; }

            let currentLine = "";
            for (const word of trimmed.split(/\s+/)) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (font.widthOfTextAtSize(testLine, fontSize) < contentWidth) {
                    currentLine = testLine;
                } else {
                    addPageIfNeeded();
                    page.drawText(currentLine, {
                        x: margin, y: currentY, size: fontSize,
                        font, color: rgb(0.15, 0.15, 0.15),
                    });
                    currentY -= lineHeight;
                    currentLine = word;
                }
            }

            if (currentLine) {
                addPageIfNeeded();
                page.drawText(currentLine, {
                    x: margin, y: currentY, size: fontSize,
                    font, color: rgb(0.15, 0.15, 0.15),
                });
                currentY -= lineHeight;
            }
            currentY -= 6;
        }

        fs.writeFileSync(outputPath, await pdfDoc.save());
        console.log("[Conversion] ✅ Pure JS Fallback completed.");

    } finally {
        isSystemBusy = false; // Always clear processing flag to unlock next file request
    }
}

module.exports = { convertAnyToPdf };