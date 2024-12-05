const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true  // user is now required
  },
  agentId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  handle: String,
  pfp: String
});

// Removed the unique constraint to allow multiple likes per user
LikeSchema.index({ user: 1, agentId: 1 }, {
  partialFilterExpression: { user: { $exists: true } }
});

module.exports = mongoose.model('Like', LikeSchema);