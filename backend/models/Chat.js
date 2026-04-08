const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['public', 'private'],
    default: 'private'
  },
  password: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: {
    type: String,
    unique: true
  },
  messages: [{
    sender: String,
    text: String,
    fileName: String,
    fileUrl: String,
    type: {
      type: String,
      enum: ['text', 'file'],
      default: 'text'
    },
    timestamp: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', chatSchema);
