const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const AuditLog = require('../models/AuditLog');

router.get('/:documentId', verifyToken, async (req, res) => {
  try {
    const logs = await AuditLog.find({ documentId: req.params.documentId })
      .populate('userId', 'email')
      .sort({ timestamp: -1 });

    res.json(logs);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ message: 'Failed to fetch audit trail' });
  }
});

module.exports = router;
