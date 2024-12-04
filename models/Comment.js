const mongoose = require('mongoose');


const CommentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  agentId: {
    type: String,
    required: true
  },
  user: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  avatar: { // This field can now be ignored, as it will be overwritten
    type: String,
    required: false
  },
  handle: { // Add handle field
    type: String,
    required: false
  },
  readByAgent: {
    type: Boolean,
    default: false
  }
});

// Virtual population for user profile data
CommentSchema.virtual('userProfile', {
  ref: 'UserProfile',
  localField: 'user', // This refers to the publicKey in Comment
  foreignField: 'publicKey', // This is the publicKey in UserProfile
  justOne: true, // Only one user profile per comment
});

CommentSchema.set('toObject', { virtuals: true });
CommentSchema.set('toJSON', { virtuals: true });

// Add a custom method to overwrite avatar and handle from UserProfile
CommentSchema.methods.setAvatarAndHandleFromUserProfile = async function() {
  if (this.userProfile) {
    if (this.userProfile.pfp) {
      this.avatar = this.userProfile.pfp;  // Set the avatar to pfp
    }
    if (this.userProfile.handle) {
      this.handle = this.userProfile.handle; // Set the handle from userProfile
    }
  }
};

module.exports = mongoose.model('Comment', CommentSchema);
