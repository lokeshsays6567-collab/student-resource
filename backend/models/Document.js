const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    default: 'General'
  },
  class: {
    type: String,
    default: 'N/A'
  },
  type: {
    type: String,
    enum: ['Notes', 'Assignment', 'Question Paper', 'Lab Record', 'Other'],
    default: 'Notes'
  },
  description: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploaderName: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  downloads: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Document', documentSchema);
