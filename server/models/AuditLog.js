const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  action: { type: String, required: true }, // e.g. 'SIGNATURE_ADDED', 'PDF_FINALIZED'
  ip: { type: String },
  timestamp: { type: Date, default: Date.now },
  meta: { type: Object }, // Any extra info (signature ID, page, etc.)
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
