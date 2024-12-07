// models/AgentMap.js
import mongoose from 'mongoose';


const AvatarMarketplaceSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  screenshot: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  price: {
    type: Number,
  },
  isSold: {
    type: Boolean,
  },
});

export default AvatarMarketplaceSchema;
