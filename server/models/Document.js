const mongoose = require('mongoose');
const path = require('path');

const documentSchema = new mongoose.Schema({
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader user ID is required'],
    immutable: true // Once set, cannot be changed
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true,
    maxlength: [255, 'Filename cannot exceed 255 characters'],
    validate: {
      validator: function(v) {
        // Basic validation to ensure filename ends with .pdf
        return /\.pdf$/i.test(v);
      },
      message: props => `${props.value} is not a valid PDF filename`
    }
  },
  filepath: {
    type: String,
    required: [true, 'File path is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Validate path format and prevent directory traversal
        const normalized = path.normalize(v).replace(/\\/g, '/');
        return normalized === v && 
               v.startsWith('/uploads/') && 
               !v.includes('../') &&
               v.endsWith('.pdf');
      },
      message: props => `${props.value} is not a valid file path`
    }
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be at least 1 byte'],
    max: [50 * 1024 * 1024, 'File size cannot exceed 50MB'] // 50MB max
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    default: 'application/pdf',
    enum: {
      values: ['application/pdf'],
      message: 'Only PDF files are allowed'
    }
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  publicToken: {
  type: String,
  unique: true,
  sparse: true,
  trim: true,
  maxlength: 128,
  validate: {
    validator: function (v) {
      return typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v);
    },
    message: props => `${props.value} is not a valid public token`
  }
},

    finalizedUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        // Ensure it starts with /uploads/finalized and ends with .pdf
        return typeof v === 'string' &&
               v.startsWith('/uploads/finalized/') &&
               v.endsWith('.pdf');
      },
      message: props => `${props.value} is not a valid finalized PDF path`
    }
  },

  isFinalized: {
    type: Boolean,
    default: false
  },
  signatureCount: {
    type: Number,
    default: 0,
    min: 0
  },
  metadata: {
    title: String,
    author: String,
    pages: Number
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for public URL (doesn't persist in database)
documentSchema.virtual('url').get(function() {
  return `${process.env.BASE_URL || 'http://localhost:5000'}${this.filepath}`;
});

// Indexes for better query performance
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ filename: 'text' });
documentSchema.index({ uploadedAt: -1 });
documentSchema.index({ isFinalized: 1 });

// Middleware to update lastAccessedAt
documentSchema.pre('findOneAndUpdate', function(next) {
  this.set({ lastAccessedAt: Date.now() });
  next();
});

// Static method to validate file path
documentSchema.statics.isValidFilePath = function(filepath) {
  const normalized = path.normalize(filepath).replace(/\\/g, '/');
  return normalized === filepath && 
         filepath.startsWith('/uploads/') && 
         !filepath.includes('../') &&
         filepath.endsWith('.pdf');
};

// Instance method to get file extension
documentSchema.methods.getFileExtension = function() {
  return path.extname(this.filename).toLowerCase();
};

// Query helper for finalized documents
documentSchema.query.byFinalized = function(finalized) {
  return this.where({ isFinalized: finalized });
};

module.exports = mongoose.model('Document', documentSchema);