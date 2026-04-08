const mongoose = require('mongoose');

const activityTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  section: {
    type: String,
    enum: ['homepage', 'documents', 'groups', 'chat', 'profile', 'learning_hub'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number,
    default: 0
  },
  action: {
    type: String,
    default: 'view'
  },
  resourceId: {
    type: String,
    default: null
  },
  metadata: {
    type: Object,
    default: {}
  }
});

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  totalTimeSpent: {
    type: Number,
    default: 0
  },
  sectionBreakdown: {
    homepage: { type: Number, default: 0 },
    documents: { type: Number, default: 0 },
    groups: { type: Number, default: 0 },
    chat: { type: Number, default: 0 },
    profile: { type: Number, default: 0 },
    learning_hub: { type: Number, default: 0 }
  },
  mostVisitedSection: {
    type: String,
    default: null
  },
  activityLog: [activityTrackingSchema],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  personalizationPreferences: {
    preferredDocumentType: [String],
    preferredGroups: [mongoose.Schema.Types.ObjectId],
    suggestedResources: [{
      resourceId: mongoose.Schema.Types.ObjectId,
      resourceType: String,
      title: String,
      relevanceScore: Number,
      suggestedAt: Date
    }],
    interestedTopics: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActivityTracking', activitySchema);
