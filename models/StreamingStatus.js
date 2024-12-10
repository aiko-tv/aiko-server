import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ModelSchema = new mongoose.Schema({
  model: {
    type: String,
  },
  name: {
    type: String,
    default: "Aiko"
  },
  description: {
    type: String,
    default: "Aiko"
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
    default: "idle_dwarf" // Default animation
  },
  modelPosition: {
    type: [Number],
    default: [
      -0.7999999999999999,
      -0.4999999999999999,
      -8.700000000000014
      ] // Default position
  },
  modelRotation: {
    type: [Number],
    default: [
      0,
      1.9000000000000004,
      0
    ] // Default rotation
  },
  modelScale: {
    type: [Number],
    default: [
      0.9605960100000004,
      0.9605960100000004,
      0.9605960100000004
    ] // Default scale
  }
});

const SceneConfigSchema = new mongoose.Schema({

  name: {
    type: String,
    default: "Cafe"
  },
  description: {
    type: String,
    default: "In the Cafe"
  },
  model: {
    type: String,
  },
  environmentURL: {
    type: String,
    default: "modern_bedroom_compressed.glb"
  },
  defaultAnimation: {
    type: String,
    default: "idle-2"
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
    default: [
      0.5927640990168481,
    0.749999999999999,
    -9.904625062460699
    ]
  },
  cameraRotation: {
    type: Number,
    default: -4.1197096184536335
  }
  
});

const StreamingStatusSchema = new mongoose.Schema({
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
    unique: true,
    default: uuidv4 
  },
  twitter: {
    type: String,
    required: false,
    default: "watch_aiko"
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
    avatar: String,
    description: String
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
  },
  hasUploadedVrm: {
    type: Boolean,
    default: false
  },
  isAiko: {
    type: Boolean,
  },
  isBall: {
    type: Boolean,
  },
  dPublicKey: {
    type: String,
    required: false
  },
  isDegenSpartanAI: {
    type: Boolean,
  },
  isOn: {
    type: Boolean,
  }
});

StreamingStatusSchema.pre('save', async function (next) {
  if (this.isAiko) {
    const existingAiko = await mongoose.model('StreamingStatus').findOne({ isAiko: true, _id: { $ne: this._id } });
    if (existingAiko) {
      return next(new Error('Only one document can have isAiko set to true.'));
    }
  }

  if (this.isBall) {
    const existingBall = await mongoose.model('StreamingStatus').findOne({ isBall: true, _id: { $ne: this._id } });
    if (existingBall) {
      return next(new Error('Only one document can have isBall set to true.'));
    }
  }

  if (this.isDegenSpartanAI) {
    const existingDegenSpartanAI = await mongoose.model('StreamingStatus').findOne({ isDegenSpartanAI: true, _id: { $ne: this._id } });
    if (existingDegenSpartanAI) {
      return next(new Error('Only one document can have isDegenSpartanAI set to true.'));
    }
  }

  next();
});

// Update timestamp on save
StreamingStatusSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const StreamingStatus = mongoose.model('StreamingStatus', StreamingStatusSchema);
export default StreamingStatusSchema;