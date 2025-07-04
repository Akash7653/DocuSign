const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Signature = require('../models/Signature');
const Document = require('../models/Document');
const { PDFDocument, rgb } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const hexToRgb = (hex) => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
};

// ✅ GET: Fetch public doc metadata
router.get('/public-doc/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.EXTERNAL_JWT_SECRET);
    const doc = await Document.findById(decoded.documentId || decoded.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    res.json({
      documentId: doc._id,
      filename: doc.filename,
      filepath: '/' + doc.filepath.replace(/\\/g, '/')
    });
  } catch (err) {
    console.error('Invalid external sign token:', err);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// ✅ POST: Place public signature
router.post('/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.EXTERNAL_JWT_SECRET);
    const { x, y, page, type, content } = req.body;

    const signature = new Signature({
      userId: 'external',
      documentId: decoded.documentId || decoded.id,
      x, y, page, type, content,
    });
    await signature.save();

    res.json({ message: 'Signature added externally', signature });
  } catch (err) {
    console.error('Error in external POST:', err);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// ✅ POST: Finalize document
router.post('/finalize/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.EXTERNAL_JWT_SECRET);
    const documentId = decoded.documentId || decoded.id;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const signatures = await Signature.find({ documentId });

    const pdfPath = path.join(__dirname, '..', doc.filepath);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const sig of signatures) {
      const page = pages[sig.page - 1];
      const { x, y, type, content } = sig;

      if (type === 'Typed') {
        const { text, fontSize, color } = content;
        const { r, g, b } = hexToRgb(color || '#000000');
        page.drawText(text || 'Signed', {
          x: x * page.getWidth(),
          y: y * page.getHeight(),
          size: fontSize || 18,
          color: rgb(r, g, b),
        });
      }
    }

    const finalizedPdfBytes = await pdfDoc.save();
    const finalizedPath = path.join(__dirname, '..', 'uploads', 'pdfs', `finalized-${Date.now()}-${doc.filename}`);
    fs.writeFileSync(finalizedPath, finalizedPdfBytes);

    doc.isFinalized = true;
    await doc.save();

    res.json({
      message: 'Document finalized!',
      url: `/uploads/pdfs/${path.basename(finalizedPath)}`
    });
  } catch (err) {
    console.error('Error finalizing public doc:', err);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;
