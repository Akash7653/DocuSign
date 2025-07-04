const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const Document = require('../models/Document');
const Signature = require('../models/Signature');
const verifyToken = require('../middleware/authMiddleware');
const logAudit = require('../middleware/auditLogger');
const authController = require('../controllers/authController');
// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/pdfs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and ensure .pdf extension
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}-${sanitizedName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Helper function to resolve file paths consistently
const resolveFilePath = (filepath) => {
  // Remove leading slash if present to avoid absolute path issues
  const normalizedPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
  return path.join(__dirname, '..', normalizedPath);
};

// ✅ Upload PDF
// ✅ Upload PDF
router.post('/upload', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded or invalid file type.' });
    }

    // Store relative path from server root
    const relativePath = `/uploads/pdfs/${req.file.filename}`;

    const newDocument = new Document({
      uploadedBy: req.user.id,
      filename: req.file.originalname,
      filepath: relativePath, // Store consistent relative path
      fileSize: req.file.size // ✅ Added this line to satisfy schema requirement
    });

    await newDocument.save();
    await logAudit(req, 'DOCUMENT_UPLOADED', newDocument._id, { 
      filename: newDocument.filename,
      filepath: relativePath
    });

    res.status(201).json({ 
      message: 'PDF uploaded successfully', 
      document: {
        ...newDocument.toObject(),
        url: `http://${req.headers.host}${relativePath}` // Provide full URL
      }
    });
  } catch (err) {
    console.error('Error uploading document:', err);
    
    // Clean up the uploaded file if document saving failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      message: 'Failed to upload PDF',
      error: err.message 
    });
  }
});

// ✅ Get all documents for authenticated user
// ✅ Get all documents for authenticated user
router.get('/', verifyToken, async (req, res) => {
  try {
    const documents = await Document.find({ uploadedBy: req.user.id })
      .sort({ uploadedAt: -1 })
      .lean();

    const documentsWithUrls = documents.map(doc => ({
      ...doc,
      url: `http://${req.headers.host}${doc.filepath.startsWith('/') ? '' : '/'}${doc.filepath}`,
      finalizedUrl: doc.finalizedUrl 
        ? `http://${req.headers.host}${doc.finalizedUrl}` 
        : null
    }));

    res.status(200).json(documentsWithUrls);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({
      message: 'Failed to fetch documents',
      error: err.message
    });
  }
});

// ✅ Get document by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).lean();

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (doc.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this document.' });
    }

    // Verify the file exists
    const absolutePath = resolveFilePath(doc.filepath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ 
        message: 'PDF file not found on server',
        details: {
          storedPath: doc.filepath,
          resolvedPath: absolutePath
        }
      });
    }

    res.status(200).json({
      ...doc,
      url: `http://${req.headers.host}${doc.filepath}`
    });
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ 
      message: 'Failed to fetch document',
      error: err.message 
    });
  }
});

// ✅ Finalize and download signed PDF
// ✅ Finalize and save signed PDF
router.get('/finalize/:id', verifyToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const pdfPath = resolveFilePath(doc.filepath);
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        message: 'Original PDF not found',
        storedPath: doc.filepath,
        resolvedPath: pdfPath
      });
    }

    const signatures = await Signature.find({ documentId: req.params.id });
    const pdfBytes = await fsPromises.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Apply signatures
    signatures.forEach((sig) => {
      try {
        const page = pages[sig.page];
        if (page) {
          const text = sig.content?.text || sig.content || '';
          if (text.trim() !== '') {
            page.drawText(text, {
              x: sig.x * page.getWidth(),
              y: sig.y * page.getHeight(),
              size: sig.content?.fontSize || 14,
              font: font,
              color: rgb(1, 0, 0)
            });
          }
        }
      } catch (sigErr) {
        console.error(`Signature failed: ${sig._id}`, sigErr);
      }
    });

    const finalizedBytes = await pdfDoc.save();

    // Finalized directory
    const finalizedDir = path.join(__dirname, '../uploads/finalized');
    if (!fs.existsSync(finalizedDir)) fs.mkdirSync(finalizedDir, { recursive: true });

    const sanitizedName = `signed_${Date.now()}_${doc.filename.replace(/\s+/g, '_')}`;
    const finalizedPath = path.join(finalizedDir, sanitizedName);
    const finalizedUrl = `/uploads/finalized/${sanitizedName}`;

    await fsPromises.writeFile(finalizedPath, finalizedBytes);

    // Update doc
    doc.isFinalized = true;
    doc.finalizedUrl = finalizedUrl;
    await doc.save();

    res.status(200).json({
      message: 'Document finalized and saved successfully',
      document: {
        _id: doc._id,
        filename: doc.filename,
        isFinalized: doc.isFinalized,
        finalizedUrl: `http://${req.headers.host}${finalizedUrl}`,
        originalUrl: `http://${req.headers.host}${doc.filepath}`
      }
    });

  } catch (err) {
    console.error('Finalize error:', err);
    res.status(500).json({ message: 'Failed to finalize document', error: err.message });
  }
});


// ✅ Delete document by ID
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not own this document.' });
    }

    const filePath = resolveFilePath(document.filepath);

    // Delete the file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    } else {
      console.warn(`File not found during deletion: ${filePath}`);
    }

    // Delete document and associated signatures
    await document.deleteOne();
    await Signature.deleteMany({ documentId: req.params.id });

    await logAudit(req, 'DOCUMENT_DELETED', req.params.id, { 
      filename: document.filename,
      filepath: document.filepath
    });

    res.json({ 
      message: 'Document and associated signatures deleted successfully',
      deletedCount: 1
    });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ 
      message: 'Failed to delete document',
      error: err.message 
    });
  }
});

// other routes...
router.post('/generate-public-link', authController.generatePublicLink);

module.exports = router;