const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  type: {
    type: String,
    enum: ['Typed', 'Drawn', 'Image'],
    required: true,
  },
  content: {
    type: Object,
    required: true,
  },
  page: {
    type: Number,
    required: true,
  },
  x: {
    type: Number,
    required: true,
  },
  y: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'signed'],
    default: 'pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Signature', signatureSchema);
