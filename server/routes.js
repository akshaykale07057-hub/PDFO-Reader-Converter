const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const mammoth = require("mammoth");
const { upload, UPLOADS_DIR } = require("./config");
const { convertAnyToPdf } = require("./converter");

// Save json DB inside the system temporary directory to guarantee write permissions on cloud hosts
const SHARES_DB_PATH = path.join(process.env.TMPDIR || "/tmp", "shares.json");

// Local DB Helpers
function getShares() { try { return JSON.parse(fs.readFileSync(SHARES_DB_PATH, "utf-8")); } catch { return {}; } }
function saveShares(shares) { fs.writeFileSync(SHARES_DB_PATH, JSON.stringify(shares, null, 2)); }

// Auto-convert uploading
router.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const pdfFilename = `${path.basename(req.file.filename, path.extname(req.file.filename))}.pdf`;
    const outputPath = path.join(UPLOADS_DIR, pdfFilename);

    try {
        // Execute conversion using our multi-layer protected engine
        await convertAnyToPdf(req.file.path, outputPath, req.file.originalname);

        // Success! Return payload data to mobile client
        res.json({
            success: true,
            filename: req.file.filename,
            pdfFilename,
            viewUrl: `/api/view/${pdfFilename}`
        });
    } catch (err) {
        console.error("[Route Error] Conversion issue:", err.message);

        // CLEANUP TRAILING FILES: Wipe out the uploaded raw file immediately if conversion fails
        // This stops bad/corrupted files from permanently eating your free server storage.
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch { }
        }

        // Catch the memory lock exception we wrote in converter.js
        if (err.message === "SERVER_BUSY") {
            return res.status(429).json({
                error: "SERVER_BUSY",
                message: "The server is processing another document. Please try again in 3 seconds."
            });
        }

        // Standard fallback error
        res.status(500).json({ error: "Could not process document template." });
    }
});

// Direct conversion streaming endpoint (used by frontend converters)
router.post("/convert/pdf", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const pdfFilename = `${path.basename(req.file.filename, path.extname(req.file.filename))}.pdf`;
    const outputPath = path.join(UPLOADS_DIR, pdfFilename);

    try {
        // Run conversion using our multi-layer protected engine
        await convertAnyToPdf(req.file.path, outputPath, req.file.originalname);

        // Send PDF back directly as binary stream
        res.sendFile(outputPath, (err) => {
            // Cleanup files immediately after transmission to conserve disk space
            try {
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (cleanupErr) {
                console.error("Cleanup error after direct conversion sendFile:", cleanupErr);
            }
        });
    } catch (err) {
        console.error("[Route Error] Direct PDF conversion issue:", err.message);

        // Cleanup files if any exist
        try {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupErr) { }

        if (err.message === "SERVER_BUSY") {
            return res.status(429).json({
                error: "SERVER_BUSY",
                message: "The server is processing another document. Please try again."
            });
        }
        res.status(500).json({ error: "Could not process document template." });
    }
});

// Inline PDF Viewing stream
router.get("/view/:file", (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.file);
    if (!fs.existsSync(filePath)) return res.status(404).send("Not Found");

    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
});

// Download links
router.get("/files/:file", (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.file);
    if (!fs.existsSync(filePath)) return res.status(404).send("Not Found");
    res.sendFile(filePath);
});

// Generate expiring share links
router.post("/share/generate", (req, res) => {
    const { filename, method, expiryHours, recipientEmail } = req.body;
    if (!filename) return res.status(400).json({ error: "Filename is required." });

    const shareId = crypto.randomBytes(16).toString("hex");
    const expiryTime = Date.now() + (expiryHours || 24) * 60 * 60 * 1000;

    const shares = getShares();
    shares[shareId] = { filename, expiryTime };
    saveShares(shares);

    const shareLink = `${req.protocol}://${req.get("host")}/api/share/download/${shareId}`;

    // Optional email sending using nodemailer if configured
    if (method === "email" && recipientEmail) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || "smtp.mailtrap.io",
                port: process.env.SMTP_PORT || 2525,
                auth: {
                    user: process.env.SMTP_USER || "",
                    pass: process.env.SMTP_PASS || ""
                }
            });

            const mailOptions = {
                from: `"PDF Reader Pro Share" <noreply@pdforeader.app>`,
                to: recipientEmail,
                subject: `Secure Document Shared With You`,
                text: `You have been shared a secure document link: ${shareLink}\nThis link will expire in ${expiryHours} hours.`,
                html: `<p>You have been shared a secure document link: <a href="${shareLink}">${shareLink}</a></p><p>This link will expire in <b>${expiryHours} hours</b>.</p>`
            };

            transporter.sendMail(mailOptions).catch(err => {
                console.error("Nodemailer async send error:", err.message);
            });
        } catch (emailErr) {
            console.error("Failed to setup email transporter:", emailErr.message);
        }
    }

    res.json({
        success: true,
        shareLink
    });
});

// Download shared expiring files
router.get("/share/download/:shareId", (req, res) => {
    const shares = getShares();
    const share = shares[req.params.shareId];
    if (!share) return res.status(404).send("Share link not found or invalid.");

    if (Date.now() > share.expiryTime) {
        // Cleanup expired entry
        delete shares[req.params.shareId];
        saveShares(shares);
        return res.status(410).send("This share link has expired.");
    }

    const filePath = path.join(UPLOADS_DIR, share.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found on server.");

    res.sendFile(filePath);
});

module.exports = router;