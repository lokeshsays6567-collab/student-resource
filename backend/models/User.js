const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  status: {
    type: String,
    enum: ['Active', 'Banned'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  messageRestricted: {
    type: Boolean,
    default: false
  },
  restrictedUntil: {
    type: Date,
    default: null
  },
  offensiveCount: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('User', userSchema);
