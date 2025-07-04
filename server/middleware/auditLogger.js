const AuditLog = require('../models/AuditLog');

const logAudit = async (req, action, documentId, meta = {}) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    await AuditLog.create({
      userId: req.user.id,
      documentId,
      action,
      ip,
      meta,
    });
  } catch (err) {
    console.error('Failed to log audit trail:', err.message);
  }
};

module.exports = logAudit;
