import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ModelSchema = new mongoose.Schema({
  model: {
    type: String,
  },
  name: {
    type: String,
    default: "Cafe"
  },
  description: {
    type: String,
    default: "In the Cafe"
  },
  agentId: {
    type: String,
    required: true
  },
  clothes: {
    type: String,
    default: "casual" // Default value for clothes
  },
  defaultAnimation: {
    type: String,
    default: "sitting_legs_swinging" // Default animation
  },
  modelPosition: {
    type: [Number],
    default: [0, 0, 0] // Default position
  },
  modelRotation: {
    type: [Number],
    default: [0, 0, 0] // Default rotation
  },
  modelScale: {
    type: [Number],
    default: [1, 1, 1] // Default scale
  }
});

const SceneConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "Default Scene"
  },
  description: {
    type: String,
    default: "Interactive Scene"
  },
  model: {
    type: String,
    default: "Default Model"
  },
  environmentURL: {
    type: String,
    required: true
  },
  defaultAnimation: {
    type: String,
    default: "sitting_legs_swinging"
  },
  models: [ModelSchema],
  clothes: {
    type: String,
    default: "casual"
  },

  environmentScale: {
    type: [Number],
    default: [1, 1, 1]
  },
  environmentPosition: {
    type: [Number],
    default: [0, -1, -5]
  },
  environmentRotation: {
    type: [Number],
    default: [0, 1.5707963267948966, 0]
  },
  cameraPitch: {
    type: Number,
    default: 0
  },
  cameraPosition: {
    type: [Number],
    default: [0, 1.15, -2.5]
  },
  cameraRotation: {
    type: Number,
    default: 0
  }
  
});

const StreamingStatusSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: false,
  },
  title: {
    type: String,
    required: false
  },
  agentId: {
    type: String,
    required: true,
    unique: true,
  },
  sceneId: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4 
  },
  twitter: {
    type: String,
    required: false
  },
  modelName: {
    type: String,
    required: false
  },
  identifier: {
    type: String,
    required: false
  },
  description: {
    type: String,
    default: "Interactive Scene"
  },
  color: {
    type: String,
    default: "#FE2C55"
  },
  type: {
    type: String,
    enum: ['default', 'coming-soon', '3d', 'stream'],
    default: 'stream'
  },
  component: {
    type: String,
    default: "ThreeScene"
  },
  walletAddress: {
    type: String,
    required: false
  },
  creator: {
    username: String,
    title: String,
    avatar: String
  },
  bgm: {
    type: String,
    required: false
  },
  sceneConfigs: [SceneConfigSchema],
  stats: {
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    bookmarks: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    }
  },
  isStreaming: {
    type: Boolean,
    required: true,
    default: false
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now,
    index: true
  },
  startedAt: {
    type: Date,
    required: false
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
StreamingStatusSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const StreamingStatus = mongoose.model('StreamingStatus', StreamingStatusSchema);
export default StreamingStatusSchema;