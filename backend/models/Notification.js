const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String,
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'request', 'completion_request'],
    default: 'info',
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel',
  },
  relatedModel: {
    type: String,
    enum: ['Session', 'User', 'Skill'],
  },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  actionRequired: {
    type: Boolean,
    default: false,
  },
  actionType: {
    type: String,
    enum: ['confirm_completion', 'request_response'],
    required: function() { return this.actionRequired; }
  },
  actionData: {
    type: Object,
    required: function() { return this.actionRequired; }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: function() {
      return this.actionRequired ? 'pending' : undefined;
    }
  },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
