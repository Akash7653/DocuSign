const express = require('express');
const router = express.Router();
const Signature = require('../models/Signature');
const verifyToken = require('../middleware/authMiddleware');
const Document = require('../models/Document');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const logAudit = require('../middleware/auditLogger');

// ================== HELPERS ==================
console.log('[DEBUG] signatureRoutes.js file loaded.');

const resolveFilePath = (filepath) => {
  const normalizedPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
  return path.join(__dirname, '..', normalizedPath);
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const hexToRgb = (hex) => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
};

// ================== ✅ PUBLIC ROUTES FIRST ==================

// GET public document with signatures
router.get('/public-doc/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const document = await Document.findById(docId).lean();
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const signatures = await Signature.find({ documentId: docId }).sort({ createdAt: 1 }).lean();

    res.status(200).json({ filename: document.filename, filepath: document.filepath, signatures,finalized: document.isFinalized || false });
  } catch (err) {
    console.error('❌ Error fetching public document:', err);
    res.status(500).json({ message: 'Failed to load public document', error: err.message });
  }
});

// POST public signature
router.post('/public-sign', async (req, res) => {
  console.log('✅ /public-sign hit:', req.body);
  try {
    const { token, x, y, page, type, content } = req.body;
    if (!token || x == null || y == null || !content || !type || page == null) {
      return res.status(400).json({ 
        message: 'All fields including token are required',
        required: ['token', 'x', 'y', 'page', 'type', 'content']
      });
    }

    const doc = await Document.findOne({ publicToken: token });
    if (!doc) return res.status(404).json({ message: 'Invalid or expired token' });

    const signature = new Signature({
      documentId: doc._id,
      userId: null,
      x, y, page, type, content
    });

    await signature.save();
    await logAudit(req, 'PUBLIC_SIGNATURE_CREATED', signature._id, {
      documentId: doc._id, page, type
    });

    res.status(201).json({ message: 'Signature added successfully', signature });

  } catch (err) {
    console.error('❌ Error saving public signature:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST public finalize
router.post('/public-finalize', async (req, res) => {
  console.log('✅ /public-finalize hit:', req.body);
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    const doc = await Document.findOne({ publicToken: token });
    if (!doc) return res.status(404).json({ message: 'Invalid or expired token' });

    const pdfPath = resolveFilePath(doc.filepath);
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'Original PDF not found', storedPath: doc.filepath, resolvedPath: pdfPath });
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    const signatures = await Signature.find({ documentId: doc._id });

    for (const sig of signatures) {
      try {
        const contentText = sig.content?.text || sig.content || '';
        if (!contentText.trim()) continue;

        const pageIndex = sig.page - 1;
        const page = pages[pageIndex];
        const fontSize = sig.content?.fontSize || 18;
        const colorHex = sig.content?.color || '#000000';
        const { r, g, b } = hexToRgb(colorHex);

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        const safeX = Math.max(0, Math.min(sig.x, 1));
        const safeY = Math.max(0, Math.min(sig.y, 1));

        const normalizedX = safeX * pageWidth;
        const normalizedY = (1 - safeY) * pageHeight - fontSize / 2;

        page.drawText(contentText, {
          x: normalizedX,
          y: normalizedY,
          size: fontSize,
          font,
          color: rgb(r, g, b),
        });

      } catch (sigErr) {
        console.error(`Signature ${sig._id} failed`, sigErr);
      }
    }

    const finalizedBytes = await pdfDoc.save();
    const finalizedDir = path.join(__dirname, '../uploads/finalized');
    ensureDirectoryExists(finalizedDir);

    const filename = `signed_public_${Date.now()}_${doc.filename}`;
    const finalizedPath = path.join(finalizedDir, filename);
    const urlPath = `/uploads/finalized/${filename}`;

    fs.writeFileSync(finalizedPath, finalizedBytes);

    doc.isFinalized = true;
    doc.finalizedUrl = urlPath;
    doc.signatureCount = signatures.length;
    await doc.save();

    res.status(200).json({ message: 'Public PDF finalized successfully', url: urlPath, filename, signatureCount: signatures.length });

  } catch (err) {
    console.error('❌ Error in public-finalize:', err);
    res.status(500).json({ message: 'Failed to finalize public document', error: err.message });
  }
});

// DELETE public signature
router.delete('/public-delete/:id', async (req, res) => {
  console.log('✅ /public-delete hit:', req.params.id, req.body.token);
  try {
    const { id } = req.params;
    const { token } = req.body;

    if (!token) return res.status(400).json({ message: 'Token required' });

    const doc = await Document.findOne({ publicToken: token });
    if (!doc) return res.status(404).json({ message: 'Invalid or expired token' });

    const signature = await Signature.findById(id);
    if (!signature || signature.documentId.toString() !== doc._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this signature' });
    }

    await signature.deleteOne();
    await logAudit(req, 'PUBLIC_SIGNATURE_DELETED', signature._id, {
      documentId: doc._id
    });

    res.json({ message: 'Signature deleted successfully' });

  } catch (err) {
    console.error('❌ Error deleting public signature:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ================== ✅ AUTH ROUTES AFTER ==================

// POST add new signature
router.post('/', verifyToken, async (req, res) => {
  try {
    const { documentId, x, y, content, type, page } = req.body;
    if (!documentId || x == null || y == null || !content || !type || page == null) {
      return res.status(400).json({
        message: 'All signature fields are required',
        requiredFields: ['documentId', 'x', 'y', 'content', 'type', 'page']
      });
    }

    const document = await Document.findById(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });
    if (document.uploadedBy.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized access to document' });

    const signature = new Signature({ documentId, userId: req.user.id, x, y, content, type, page });

    await signature.save();
    await logAudit(req, 'SIGNATURE_CREATED', signature._id, { documentId, page, type });

    res.status(201).json({ message: 'Signature saved successfully', signature });

  } catch (err) {
    console.error('Error adding signature:', err);
    res.status(500).json({ message: 'Failed to save signature', error: err.message });
  }
});

// GET signatures for a document
router.get('/:documentId', verifyToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findById(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });
    if (document.uploadedBy.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized access to document' });

    const signatures = await Signature.find({ documentId }).sort({ createdAt: 1 }).lean();
    res.status(200).json(signatures);

  } catch (err) {
    console.error(`Error fetching signatures for document ${documentId}:`, err);
    res.status(500).json({ message: 'Failed to fetch signatures', error: err.message });
  }
});

// DELETE a signature
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const signature = await Signature.findById(req.params.id);
    if (!signature) return res.status(404).json({ message: 'Signature not found' });

    const document = await Document.findById(signature.documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });
    if (signature.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized to delete this signature' });

    await signature.deleteOne();
    await logAudit(req, 'SIGNATURE_DELETED', signature._id, { documentId: signature.documentId });

    res.json({ message: 'Signature deleted successfully', signatureId: signature._id });

  } catch (err) {
    console.error('Error deleting signature:', err);
    res.status(500).json({ message: 'Failed to delete signature', error: err.message });
  }
});

// POST finalize PDF
router.post('/finalize', verifyToken, async (req, res) => {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required', details: 'Provide documentId in request body' });
    }

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.uploadedBy.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized access to document' });

    const originalPdfPath = resolveFilePath(doc.filepath);
    if (!fs.existsSync(originalPdfPath)) {
      return res.status(404).json({
        message: 'Original PDF file not found',
        details: { storedPath: doc.filepath, resolvedPath: originalPdfPath }
      });
    }

    const existingPdfBytes = fs.readFileSync(originalPdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const signatures = await Signature.find({ documentId });

    for (const sig of signatures) {
      try {
        const contentText = sig.content?.text || sig.content || '';
        if (!contentText.trim()) continue;

        const pageIndex = sig.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        const fontSize = sig.content?.fontSize || 18;
        const colorHex = sig.content?.color || '#000000';
        const { r, g, b } = hexToRgb(colorHex);

        const safeX = Math.max(0, Math.min(sig.x, 1));
        const safeY = Math.max(0, Math.min(sig.y, 1));

        const normalizedX = Math.max(10, Math.min(pageWidth - 10, safeX * pageWidth));
        const normalizedY = Math.max(10, Math.min(pageHeight - 10, (1 - safeY) * pageHeight - fontSize / 2));

        page.drawText(contentText, {
          x: normalizedX,
          y: normalizedY,
          size: fontSize,
          font,
          color: rgb(r, g, b),
        });

      } catch (sigErr) {
        console.error(`Error processing signature ${sig._id}:`, sigErr);
      }
    }

    const finalizedPdfBytes = await pdfDoc.save();
    const finalizedDir = path.join(__dirname, '../uploads/finalized');
    ensureDirectoryExists(finalizedDir);

    const filename = `signed_${doc.filename.replace('.pdf', '')}_${Date.now()}.pdf`;
    const finalizedPath = path.join(finalizedDir, filename);
    const urlPath = `/uploads/finalized/${filename}`;

    fs.writeFileSync(finalizedPath, finalizedPdfBytes);

    doc.finalizedUrl = urlPath;
    doc.isFinalized = true;
    doc.signatureCount = signatures.length;
    await doc.save();

    await logAudit(req, 'DOCUMENT_FINALIZED', doc._id, {
      originalFilename: doc.filename,
      finalizedFilename: filename,
      signatureCount: signatures.length
    });

    res.status(200).json({ message: 'PDF finalized successfully!', url: urlPath, filename, signatureCount: signatures.length });

  } catch (err) {
    console.error('Error finalizing PDF:', err);
    res.status(500).json({ message: 'Failed to finalize PDF', error: err.message });
  }
});

module.exports = router;
