import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose, { model } from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { dirname } from 'path';
import StreamingStatusSchema from './models/StreamingStatus.js';
import AudioResponse from './models/AudioResponse.js';
import { GiftTransaction } from './models/GiftTransaction.js';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { UserProfile } from './models/UserProfile.js';
import { Filter } from 'bad-words';
import multer from 'multer';
import * as badwordsList from 'badwords-list';
import { uploadImgToBunnyCDN, getExtensionFromMimetype, uploadVrmToBunnyCDN, uploadAudioToBunnyCDN } from './upload/uploadCdn.ts';
import { web3Auth, authorizedPk } from './middleware/web3Auth.ts';
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Convert ESM module path to dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize environment variables
dotenv.config();

// Import models (with .js extension for ES modules)
import Comment from './models/Comment.js';
import Like from './models/Like.js';
import AIResponse from './models/AIResponse.js';
import RoomMessage from './models/RoomMessage.js';
import AgentMapSchema from './models/AgentMap.js';
import AvatarMarketplaceSchema from './models/AvatarMarketplace.js';

const StreamingStatus = mongoose.model('StreamingStatus', StreamingStatusSchema);
const AgentMap = mongoose.model('AgentMap', AgentMapSchema);
const AvatarMarketplace = mongoose.model('AvatarMarketplace', AvatarMarketplaceSchema);

const app = express();
const httpServer = createServer(app);

// Hardcoded MongoDB URI
const MONGO_URI = process.env.MONGODB_URI;

const storage = multer.memoryStorage(); 
const imageUpload = multer({ storage: storage }).single('image'); 
// New multer storage for VRM files
const vrmUpload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['model/vnd.vrm', 'application/octet-stream']; // Adjust types as needed
    const allowedExtensions = ['.vrm'];

    const fileExtension = file.originalname.split('.').pop();
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(`.${fileExtension}`)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only VRM files are allowed.') as any, false);
    }
  }
}).single('vrm');
const fileUpload = multer().fields([
  { name: 'vrmFile', maxCount: 1 }, // One .vrm file
  { name: 'imageFile', maxCount: 1 }, // One image
]);

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],  // Allow all headers
  credentials: true
}));
app.use(express.json());

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true
  }
});


// Initialize counters
let likeCount = 0;
let commentCount = 0;

// MongoDB connection
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      likeCount = await Like.countDocuments();
      commentCount = await Comment.countDocuments();
      console.log('Initial counts loaded - Likes:', likeCount, 'Comments:', commentCount);
    } catch (error) {
      console.error('Error initializing counts:', error);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Stats endpoints
app.get('/api/streams/:agentId/stats', async (req, res) => {
  const agentId = req.params.agentId;
  try {
    const likes = await Like.countDocuments({ agentId });
    const comments = await Comment.countDocuments({ agentId });
    console.log({ likes, comments, agentId });
    res.json({ likes, comments });
  } catch (error) {
    console.error('Error in /api/streams/:agentId/stats:', error);
    res.status(500).json({ error: 'Failed to get stream stats' });
  }
});


app.get('/api/comments', async (req, res) => {
  console.log("Fetching comments", req.query);
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const since = req.query.since ? new Date(req.query.since as string) : null;
    const agentId = req.query.agentId;

    // Build query object
    const query: any = {};
    
    // Add filters if provided
    if (since) {
      query.createdAt = { $gt: since };
    }
    if (agentId) {
      query.agentId = agentId;
    }

    const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userProfile', 'pfp handle'); // Populate the user profile with 'pfp' and 'handle'

    // Set the avatar field using the pfp from userProfile
    for (const comment of comments) {
      if (comment.userProfile && comment.userProfile.pfp) {
        comment.avatar = comment.userProfile.pfp; // Overwrite avatar with pfp
      }
    }

    res.json({ comments });

  } catch (error) {
    console.error('Error in /api/comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

app.get('/api/comments/paginated', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userProfile', 'pfp handle'), // Populate with 'pfp' and 'handle',
      Comment.countDocuments()
    ]);
    
    // Loop through comments to set the avatar field to pfp from the userProfile
    for (const comment of comments) {
      if (comment.userProfile && comment.userProfile.pfp) {
        comment.avatar = comment.userProfile.pfp; // Set avatar to pfp
      }
    }
    
    res.json({
      comments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalComments: total,
        hasMore: skip + comments.length < total
      }
    });
    
  } catch (error) {
    console.error('Error in /api/comments/paginated:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Count endpoints
app.get('/api/likeCounts', async (req, res) => {
  try {
    likeCount = await Like.countDocuments();
    res.json({ likes: likeCount });
  } catch (error) {
    console.error('Error in /api/likeCounts:', error);
    res.status(500).json({ error: 'Failed to get like count' });
  }
});

app.get('/api/commentCounts', async (req, res) => {
  try {
    commentCount = await Comment.countDocuments();
    res.json({ commentCount });
  } catch (error) {
    console.error('Error in /api/commentCounts:', error);
    res.status(500).json({ error: 'Failed to get comment count' });
  }
});

// Scene stats endpoint
app.get('/api/streams/:agentId/stats', async (req, res) => {
  const agentId = req.params.agentId;
  try {
    const likes = await Like.countDocuments({ agentId });
    const comments = await Comment.countDocuments({ agentId });

    console.log({ likes, comments, agentId });

    res.json({ likes, comments });
  } catch (error) {
    console.error('Error in /api/scenes/:sceneIndex/stats:', error);
    res.status(500).json({ error: 'Failed to get scene stats' });
  }
});

// Add these interfaces near the top with other interfaces
interface FetchCommentsResponse {
  success: boolean;
  comments?: any[];
  error?: string;
}

interface MarkCommentsReadResponse {
  success: boolean;
  modifiedCount?: number;
  error?: string;
}

// Add these functions before the routes
async function fetchComments(agentId: string, limit: number = 10): Promise<FetchCommentsResponse> {
  try {
    const comments = await Comment.find({
      agentId,
      readByAgent: false,
      $expr: {
        $and: [
          { $gt: [{ $strLenCP: "$message" }, 3] },
          { $lt: [{ $strLenCP: "$message" }, 200] }
        ]
      }
    })
      .sort({ createdAt: -1, readByAgent: 1 })
      .limit(limit);
    return { success: true, comments };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return { success: false, error: 'Failed to fetch comments' };
  }
}

async function markCommentsAsRead(commentIds: string[]): Promise<MarkCommentsReadResponse> {
  try {
    const result = await Comment.updateMany(
      { id: { $in: commentIds } },
      { $set: { readByAgent: true } }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'No comments found' };
    }

    return {
      success: true,
      modifiedCount: result.modifiedCount
    };
  } catch (error) {
    console.error('Error marking comments as read:', error);
    return { success: false, error: 'Failed to mark comments as read' };
  }
}

async function verifyTrustedUser(pk: string, agentId: string) {
    // find streaming status with agentId
    const streamingStatus = await StreamingStatus.findOne({ agentId });
    // check if pk matches dPublicKey and return boolean
    if (streamingStatus?.dPublicKey === pk) {
      return true;
    }
    return false;
}

app.get('/api/streams/:agentId/unread-comments', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const since = req.query.since ? new Date(req.query.since as string) : null;

    const query: any = {
      agentId,
      // readByAgent: false,
      $expr: {
        $and: [
          { $gt: [{ $strLenCP: "$message" }, 3] },
          { $lt: [{ $strLenCP: "$message" }, 200] }
        ]
      }
    };

    // Add since filter if provided
    if (since) {
      query.createdAt = { $gt: since };
    }

    const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userProfile', 'pfp handle'); // Populate user profile with 'pfp' and 'handle'

  // Loop through comments to set the avatar field to pfp from the userProfile
  for (const comment of comments) {
    if (comment.userProfile && comment.userProfile.pfp) {
      comment.avatar = comment.userProfile.pfp; // Set avatar to pfp
    }
  }

  res.json({
    comments,
    metadata: {
      count: comments.length,
      since: since?.toISOString(),
      hasMore: comments.length >= limit
    }
  });

  } catch (error) {
    console.error('Error fetching unread comments:', error);
    res.status(500).json({ error: 'Failed to fetch unread comments' });
  }
});


// Add this near the top where other state variables are defined
const agentViewers = new Map<string, Set<string>>();

// Add near top with other state variables
const socketToStream = new Map<string, string>();

// Helper function to emit stream counts
function emitStreamCounts() {
  const streamCounts = Object.fromEntries(
    Array.from(agentViewers.entries()).map(([agentId, viewers]) => [
      agentId,
      viewers.size
    ])
  );

  console.log('Emitting stream counts:', streamCounts);
  io.emit('stream_counts', streamCounts);
}



// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal');
  io.emit('server_shutdown', { message: 'Server is shutting down' });
  io.close(() => {
    console.log('All socket connections closed');
    process.exit(0);
  });
};






process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 6969;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
  console.log('Accepting connections from all origins');
});


// Get all gifts for a specific agent with optional pagination
app.get('/api/agents/:agentId/gifts', async (req, res) => {
  try {
    const { agentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const readByAgent = req.query.readByAgent === 'true';
    const skip = (page - 1) * limit;

    // Create filter object
    const filter = {
      recipientAgentId: agentId,
      ...(req.query.readByAgent !== undefined && { readByAgent })
    };

    const [gifts, total] = await Promise.all([
      GiftTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      GiftTransaction.countDocuments(filter)
    ]);

    res.json({
      gifts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalGifts: total,
        hasMore: skip + gifts.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching agent gifts:', error);
    res.status(500).json({ error: 'Failed to fetch agent gifts' });
  }
});

// Add a new endpoint to mark gifts as read
app.put('/api/agents/:agentId/gifts/mark-read', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { giftIds } = req.body;

    if (!Array.isArray(giftIds)) {
      return res.status(400).json({ error: 'giftIds must be an array' });
    }

    const result = await GiftTransaction.updateMany(
      {
        recipientAgentId: agentId,
        _id: { $in: giftIds }
      },
      {
        $set: { readByAgent: true }
      }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking gifts as read:', error);
    res.status(500).json({ error: 'Failed to mark gifts as read' });
  }
});

// Get top gift senders for a specific agent
app.get('/api/agents/:agentId/top-gifters', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const timeframe = req.query.timeframe || 'all';

    // Create date filter based on timeframe
    const dateFilter = {};
    const now = new Date();
    if (timeframe === 'day') {
      dateFilter['createdAt'] = { $gte: new Date(now.setDate(now.getDate() - 1)) };
    } else if (timeframe === 'week') {
      dateFilter['createdAt'] = { $gte: new Date(now.setDate(now.getDate() - 7)) };
    } else if (timeframe === 'month') {
      dateFilter['createdAt'] = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
    }

    const topGifters = await GiftTransaction.aggregate([
      {
        $match: {
          recipientAgentId: agentId,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$senderPublicKey',
          totalGifts: { $sum: '$giftCount' },
          totalCoins: { $sum: '$coinsTotal' },
          giftsSent: {
            $push: {
              giftName: '$giftName',
              count: '$giftCount',
              coins: '$coinsTotal',
              timestamp: '$createdAt'
            }
          }
        }
      },
      {
        $sort: { totalCoins: -1 }
      },
      {
        $limit: limit
      }
    ]);

    // Fetch user profiles for all gifters in parallel
    const giftersWithProfiles = await Promise.all(
      topGifters.map(async (gifter) => {
        const userProfile = await UserProfile.findOne({ publicKey: gifter._id });
        return {
          ...gifter,
          handle: userProfile?.handle || undefined,
          pfp: userProfile?.pfp || undefined
        };
      })
    );

    res.json({
      timeframe,
      topGifters: giftersWithProfiles
    });
  } catch (error) {
    console.error('Error fetching top gifters:', error);
    res.status(500).json({ error: 'Failed to fetch top gifters' });
  }
});

// Add RPC endpoint and connection configuration
const endpoint = process.env.SOLANA_RPC_URL;
const solanaConnection = new Connection(endpoint, 'confirmed');

// Common token decimals
const TOKEN_DECIMALS: { [key: string]: number } = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5, // BONK
};

// Add new routes before your existing routes
app.get('/balance/token/:walletAddress/:mintAddress', async (req, res) => {
  try {
    const { walletAddress, mintAddress } = req.params;
    console.log(`Fetching balance for wallet: ${walletAddress}, token: ${mintAddress}`);

    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);

    const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(wallet, {
      programId: TOKEN_PROGRAM_ID,
    });

    const tokenAccount = tokenAccounts.value.find(
      account => account.account.data.parsed.info.mint === mint.toString()
    );

    if (!tokenAccount) {
      console.log(`No token account found for ${mintAddress}`);
      return res.json({ balance: 0 });
    }

    const rawBalance = Number(tokenAccount.account.data.parsed.info.tokenAmount.amount);
    const decimals = TOKEN_DECIMALS[mint.toString()] ||
      tokenAccount.account.data.parsed.info.tokenAmount.decimals;

    const balance = rawBalance / Math.pow(10, decimals);

    res.json({
      balance,
      decimals,
      rawBalance,
      tokenAccount: tokenAccount.pubkey.toString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(400).json({ error: 'Invalid address or request failed' });
  }
});


// Add these helper functions before the route
const filter = new Filter();

// Remove overly strict words from the filter
filter.removeWords(
  'poop',
  'gay',
  'hell',
  'damn',
  'god',
  'jesus',
  'crap',
  'darn',
  'idiot',
  'stupid',
  'dumb',
  'weird',
  'sucks',
  'wtf',
  'omg',
  'butt',
  'fart',
  'sexy',
  'sex',
  'hate',
  'drunk',
  'drugs',
  'drug',
  'faggot'
);

function isValidHandle(handle: string): boolean {
  // Check if handle contains profanity
  // if (filter.isProfane(handle)) {
  //   return false;
  // }

  // Additional handle validation rules
  const validHandleRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return validHandleRegex.test(handle);
}

function isValidUUID(input: string): boolean {
  return uuidRegex.test(input);
}


// Get a user profile by public key
app.get('/api/user-profile/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    console.log('Fetching user profile for ', publicKey);
    const userProfile = await UserProfile.findOne({ publicKey });
    console.log('Fetched user profile for ', publicKey, userProfile);

    if (!userProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update a user profile by public key
app.put('/api/user-profile/:publicKey', imageUpload, async (req, res) => {
  try {
    console.log('updating user profile', req.body);
    const { publicKey } = req.params;
    const { handle, isUploading } = req.body;
    let pfp;
    let extension;
    // If the user is uploading a file
    if (isUploading === "true" && req.file) {
      console.log('uploading file', req.file);
      pfp = req.file.buffer;
      extension = getExtensionFromMimetype(req.file.mimetype);
    } 

    // Validate handle if it's being updated
    if (handle) {
      if (!isValidHandle(handle)) {
        return res.status(400).json({
          error: 'Invalid handle. Handle must be 3-20 characters long, contain only letters, numbers, underscores, and hyphens, and not contain inappropriate content.'
        });
      }

      // Check if the handle is already taken by another user
      const existingProfile = await UserProfile.findOne({ handle });
      if (existingProfile && existingProfile.publicKey !== publicKey) {
        return res.status(409).json({ error: 'Handle already taken' });
      }
    }
    // original file name
    const originalFileName = req.file?.originalname;
    if (isUploading === "false") {
      pfp = req.body.image;
    }

    const pfpUrl = await uploadImgToBunnyCDN(pfp, originalFileName || `${uuidv4()}.${extension}`, 'userImages');
    if (pfpUrl.status === 'error') {
      return res.status(400).json({ error: 'Failed to upload image' });
    }
    console.log('updating user profile', {
      ...(handle && { handle }),
      ...(isUploading === "true"
        ? pfp && { pfp: pfpUrl.url }
        : pfp && { pfp: pfpUrl.url })
    });
    // Update the user profile with the new handle and pfp (whether string or CDN URL)
    const updatedUserProfile = await UserProfile.findOneAndUpdate(
      { publicKey },
      {
        ...(handle && { handle }),
        ...(isUploading === "true"
          ? pfp && { pfp: pfpUrl.url }
          : pfp && { pfp: pfpUrl.url }) // If isUploading is false, just use the pfp directly
      },
      { new: true }
    );
    
    if (!updatedUserProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    res.json(updatedUserProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Delete a user profile by public key
app.delete('/api/user-profiles/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const deletedUserProfile = await UserProfile.findOneAndDelete({ publicKey });

    if (!deletedUserProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({ success: true, message: 'User profile deleted' });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({ error: 'Failed to delete user profile' });
  }
});

// Add these interfaces near the top with other interfaces
interface ChatMessage {
  id: string;
  type: 'comment' | 'ai_response';
  message: string;
  createdAt: Date;
  sender?: string;
  handle?: string;
  avatar?: string;
}

// Add this new endpoint before the export default app
app.get('/api/agents/:agentId/chat-history', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before ? new Date(req.query.before as string) : new Date();

    // Fetch comments and AI responses in parallel
    const [comments, aiResponses] = await Promise.all([
      Comment.find({
        agentId,
        createdAt: { $lt: before }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userProfile', 'pfp handle'), // Populate userProfile with pfp and handle
    
      AIResponse.find({
        agentId,
        createdAt: { $lt: before }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
    ]);
    
    // Transform and combine the results
    const chatHistory: ChatMessage[] = [
      ...comments.map(c => {
        // If userProfile is populated, set avatar to pfp
        const avatar = c.userProfile?.pfp || c.avatar; // Fallback to existing avatar if userProfile.pfp is not available
        return {
          id: c._id.toString(),
          type: 'comment' as const,
          message: c.message,
          createdAt: c.createdAt,
          sender: c.user,
          handle: c.handle,
          avatar: avatar // Use pfp from userProfile or the existing avatar
        };
      }),
      ...aiResponses.map(r => ({
        id: r._id.toString(),
        type: 'ai_response' as const,
        message: r.text,
        createdAt: r.createdAt,
        thought: r.thought
      }))
    ];
    
    // Sort by creation date, newest first
    chatHistory.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Trim to requested limit
    const trimmedHistory = chatHistory.slice(0, limit);
    
    res.json({
      chatHistory: trimmedHistory,
      pagination: {
        hasMore: chatHistory.length >= limit,
        oldestMessageDate: trimmedHistory[trimmedHistory.length - 1]?.createdAt
      }
    });
    

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Add a new endpoint to get current viewer count for an agent
app.get('/api/agents/:agentId/viewers', (req, res) => {
  const { agentId } = req.params;
  const viewerCount = agentViewers.get(agentId)?.size || 0;
  res.json({ count: viewerCount });
});




// Add periodic ping to keep counts accurate
setInterval(() => {
  for (const [agentId, viewers] of agentViewers.entries()) {
    io.emit(`${agentId}_viewer_count`, { count: viewers.size });
  }
}, 5000); // Update every 5 seconds

// Add this function near the top where other state variables are defined
function getConnectedPeers(): number {
  return io.engine.clientsCount;
}



// Add a cleanup job to mark agents as offline if no heartbeat received
setInterval(async () => {
  try {
    const heartbeatThreshold = Date.now() - (30 * 1000); // 30 seconds timeout

    const inactiveAgents = await StreamingStatus.find({
      isStreaming: true,
      lastHeartbeat: { $lt: heartbeatThreshold }
    });

    for (const agent of inactiveAgents) {
      agent.isStreaming = false;
      await agent.save();

      // Notify clients about status change
      io.emit('streaming_status_update', agent);
      io.emit(`${agent.agentId}_heartbeat`, {
        timestamp: agent.lastHeartbeat,
        isStreaming: false
      });
    }
  } catch (error) {
    console.error('Error in heartbeat cleanup job:', error);
  }
}, 15000); // Run every 15 seconds


app.get('/api/agents/:agentId/total-likes', async (req, res) => {
  try {
    const { agentId } = req.params;
    const totalLikes = await Like.countDocuments({ agentId });
    res.json({ totalLikes });
  } catch (error) {
    console.error('Error fetching total likes:', error);
    res.status(500).json({ error: 'Failed to fetch total likes' });
  }
});

app.get('/api/agents/:agentId/top-likers', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    const timeframe = req.query.timeframe || 'all';

    // Create date filter based on timeframea
    const dateFilter: any = { 
      agentId,
      user: { $exists: true, $ne: null }  // Only count non-anonymous likes
    };
    
    const now = new Date();
    if (timeframe === '5m') {
      dateFilter.createdAt = { $gte: new Date(now.getTime() - 5 * 60 * 1000) }; // Last 5 minutes
    } else if (timeframe === '1m') {
      dateFilter.createdAt = { $gte: new Date(now.getTime() - 2 * 60 * 1000) }; // Last 2 minutes
    } else if (timeframe === 'day') {
      dateFilter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 1)) };
    } else if (timeframe === 'week') {
      dateFilter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) };
    } else if (timeframe === 'month') {
      dateFilter.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
    }

    const topLikers = await Like.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$user',
          likeCount: { $sum: 1 },
          lastLiked: { $max: '$createdAt' }
        }
      },
      { $sort: { likeCount: -1, lastLiked: -1 } },
      { $limit: limit }
    ]);

    // Fetch user profiles for the top likers in parallel
    const likersWithProfiles = await Promise.all(
      topLikers.map(async (liker) => {
        const userProfile = await UserProfile.findOne({ publicKey: liker._id });
        return {
          publicKey: liker._id,
          likeCount: liker.likeCount,
          lastLiked: liker.lastLiked,
          handle: userProfile?.handle || 'Anonymous',
          pfp: userProfile?.pfp || null
        };
      })
    );

    res.json({
      timeframe,
      topLikers: likersWithProfiles
    });

  } catch (error) {
    console.error('Error fetching top likers:', error);
    res.status(500).json({ error: 'Failed to fetch top likers' });
  }
});

export default app;




// Add heartbeat endpoint with viewer count
// app.post('/api/agents/heartbeat', async (req, res) => {
//   // Check API key
//   // const apiKey = req.headers['api_key'];
//   // if (apiKey !== API_KEY) {
//   //   return res.status(401).json({ error: 'Invalid API key' });
//   // }

//   console.log('heartbeat', req.body);
//   try {
//     const { agentId, timestamp } = req.body;

//     if (!agentId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Missing required agentId'
//       });
//     }

//     // Get current viewer count
//     const viewerCount = agentViewers.get(agentId)?.size || 0;

//     const status = await StreamingStatus.findOneAndUpdate(
//       { agentId },
//       {
//         $set: {
//           lastHeartbeat: timestamp || Date.now(),
//           isStreaming: true,
//           updatedAt: new Date(),
//           stats: {
//             viewers: viewerCount
//           }
//         }
//       },
//       {
//         new: true,
//         upsert: true
//       }
//     );

//     // Emit status updates with viewer count
//     io.emit('streaming_status_update', {
//       ...status.toObject(),
//       stats: {
//         ...status.stats,
//         viewers: viewerCount
//       }
//     });

//     io.emit(`${agentId}_heartbeat`, {
//       timestamp: status.lastHeartbeat,
//       isStreaming: status.isStreaming,
//       viewers: viewerCount
//     });

//     res.json({
//       success: true,
//       status: {
//         ...status.toObject(),
//         stats: {
//           ...status.stats,
//           viewers: viewerCount
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Error handling agent heartbeat:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to process heartbeat'
//     });
//   }
// });



app.post('/api/user-profile', imageUpload, async (req, res) => {
  try {

    const { handle, isUploading, publicKey } = req.body;
    let pfp;
    let extension;
    // If the user is uploading a file
    if (isUploading && req.file) {
      console.log('uploading file', req.file);
      pfp = req.file.buffer;
      extension = getExtensionFromMimetype(req.file.mimetype);
    }

    // Validate handle
    if (!handle || !isValidHandle(handle)) {
      return res.status(400).json({
        error: 'Invalid handle. Handle must be 3-20 characters long, contain only letters, numbers, underscores, and hyphens, and not contain inappropriate content.'
      });
    }

    // Check if the handle is already taken by another user
    const existingProfile = await UserProfile.findOne({ handle });
    if (existingProfile && existingProfile.publicKey !== publicKey) {
      return res.status(409).json({ error: 'Handle already taken' });
    }
    const pfpUrl = await uploadImgToBunnyCDN(pfp, `${uuidv4()}.${extension}`, 'userImages');
    if (pfpUrl.status === 'error') {
      return res.status(400).json({ error: 'Failed to upload image' });
    }
    // Update the user profile with the new handle and pfp (whether string or CDN URL)
    const profile = await UserProfile.findOneAndUpdate(
      { publicKey },
      {
        ...(handle && { handle }),
        ...(isUploading
          ? pfp && { pfp: pfpUrl.url }
          : pfp && { pfp: pfpUrl.url }) // If isUploading is false, just use the pfp directly
      },
      { new: true, upsert: true }
    );

    res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating or updating user profile:', error);
    res.status(500).json({ error: 'Failed to create or update user profile' });
  }
});

app.post('/transaction/gift', async (req, res) => {
  try {
    const {
      senderAddress,
      coins,
      count,
      mintAddress = 'mdx5dxD754H8uGrz6Wc96tZfFjPqSgBvqUDbKycpump', // AIKO
      recipientAddress = '5voS9evDjxF589WuEub5i4ti7FWQmZCsAsyD5ucbuRqM', // STREAMER
      decimals = 6
    } = req.body;

    const sender = new PublicKey(senderAddress);
    const recipient = new PublicKey(recipientAddress);
    const mintPubkey = new PublicKey(mintAddress);

    const transaction = new Transaction();
    const { blockhash } = await solanaConnection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sender;

    const accounts = await solanaConnection.getParsedTokenAccountsByOwner(sender, {
      programId: TOKEN_PROGRAM_ID
    });

    const sourceAccount = accounts.value.find(
      account => account.account.data.parsed.info.mint === mintAddress
    );

    if (!sourceAccount) {
      throw new Error('Source token account not found');
    }

    const destinationAta = await getAssociatedTokenAddress(
      mintPubkey,
      recipient,
      false,
      TOKEN_PROGRAM_ID
    );

    try {
      await solanaConnection.getAccountInfo(destinationAta);
    } catch (e) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          sender,
          destinationAta,
          recipient,
          mintPubkey,
          TOKEN_PROGRAM_ID
        )
      );
    }

    const totalAmount = BigInt(Math.floor(coins * count * Math.pow(10, decimals)));

    transaction.add(
      createTransferInstruction(
        sourceAccount.pubkey,
        destinationAta,
        sender,
        totalAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }).toString('base64');

    res.json({
      transaction: serializedTransaction,
      message: 'Transaction created successfully'
    });

  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(400).json({ error: 'Failed to create transaction' });
  }
});






app.post('/api/agents/audio', async (req, res) => {
  // Check API key
  // const apiKey = req.headers['api_key'];
  // if (apiKey !== API_KEY) {
  //   return res.status(401).json({ error: 'Invalid API key' });
  // }

  try {
    const { audioUrl, agentId, messageId } = req.body;

    console.log(req.params, req.body)

    if (!audioUrl || !agentId || !messageId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['audioUrl', 'agentId', 'messageId']
      });
    }

    // Emit the audio response event for the specific agent
    io.emit(`${agentId}_audio_response`, {
      agentId,
      audioUrl,
      messageId
    });

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error emitting audio response:', error);
    res.status(500).json({ error: 'Failed to emit audio response' });
  }
});

// Animation and Expression endpoints
app.post('/api/update-animation', async (req, res) => {
  // Check API key
  // const apiKey = req.headers['api_key'];
  // if (apiKey !== API_KEY) {
  //   console.log('Invalid API key', apiKey, 'expected:', API_KEY, { headers: req?.headers });
  //   return res.status(401).json({ error: 'Invalid API key' });
  // }

  try {
    console.log('update-animation', req.body);
    const animation = req.body.animation;
    const agentId = req.body.agentId;
    console.log(`Requested animation: ${animation} for agentId: ${agentId}`);

    io.emit('update_animation', animation);

    if (agentId) {
      io.emit(`${agentId}_update_animation`, animation);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating animation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/update-expression', async (req, res) => {
  // Check API key
  // const apiKey = req.headers['api_key'];
  // if (apiKey !== API_KEY) {
  //   return res.status(401).json({ error: 'Invalid API key' });
  // }

  try {
    const expression = req.body.expression;
    console.log('Requested expression:', expression)

    if (!expression) {
      return res.status(400).json({ error: 'No expression specified' });
    }

    io.emit('update_expression', expression);
    console.log('Sent expression:', expression);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating expression:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/update-emotion', async (req, res) => {
  try {
    const expression = req.body.expression;
    const animation = req.body.animation;
    const emotion = req.body.emotion;
    console.log('Requested expression:', emotion, animation, expression)

    if (!expression) {
      return res.status(400).json({ error: 'No expression specified' });
    }

    io.emit('update_expression', expression);
    io.emit('update_animation', animation);
    io.emit('update_emotion', emotion);
    console.log('Sent expression:', expression);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating emotion:', error);
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/ai-responses', async (req, res) => {
  // Check API key
  // const apiKey = req.headers['api_key'];
  // if (apiKey !== API_KEY) {
  //   console.log('Invalid API key', apiKey, 'expected:', API_KEY, { headers: req?.headers });
  //   return res.status(401).json({ error: 'Invalid API key' });
  // }

  const { agentId, ...requestBody } = req.body;
  try {

    console.log('ai-responses', req.body);

    // Type validation
    // const validateAIResponse = (input: any): input is AIResponseInput => {
    //   return (
    //     // Required fields
    //     typeof input.id === 'string' &&
    //     typeof input.text === 'string' &&

    //     // Optional reply fields
    //     (input.replyToUser === undefined || typeof input.replyToUser === 'string') &&
    //     (input.replyToMessageId === undefined || typeof input.replyToMessageId === 'string') &&
    //     (input.replyToMessage === undefined || typeof input.replyToMessage === 'string') &&
    //     (input.replyToHandle === undefined || typeof input.replyToHandle === 'string') &&
    //     (input.replyToPfp === undefined || typeof input.replyToPfp === 'string') &&
    //     // Optional metadata
    //     (input.intensity === undefined || typeof input.intensity === 'number') &&
    //     (input.thought === undefined || typeof input.thought === 'boolean') &&

    //     // Gift-specific fields
    //     (input.isGiftResponse === undefined || typeof input.isGiftResponse === 'boolean') &&
    //     (input.giftId === undefined || typeof input.giftId === 'string') &&


    //     // Animation field
    //     (input.animation === undefined || typeof input.animation === 'string')
    //   );
    // };

    // if (!validateAIResponse(requestBody)) {
    //   return res.status(400).json({
    //     error: 'Invalid request body format',
    //     required: {
    //       id: 'string',
    //       text: 'string'
    //     },
    //     optional: {
    //       // Reply fields
    //       replyToUser: 'string',
    //       replyToMessageId: 'string',
    //       replyToMessage: 'string',
    //       replyToHandle: 'string',
    //       replyToPfp: 'string',

    //       // Metadata
    //       intensity: 'number',
    //       thought: 'boolean',

    //       // Gift fields
    //       isGiftResponse: 'boolean',
    //       giftId: 'string',

    //       // Animation
    //       animation: 'string'
    //     }
    //   });
    // }


    // const savedResponse = await new AIResponse(requestBody).save();

    // Get user profile if replyToUser is provided
    let handle;
    let pfp;

    if (requestBody.replyToUser) {
      try {
        const userProfile = await UserProfile.findOne({ publicKey: requestBody.replyToUser });
        handle = userProfile?.handle;
        pfp = userProfile?.pfp;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Continue execution without the profile info rather than failing the whole request
      }
    }

    // // Emit animation update if provided
    // if (requestBody.animation) {
    //   console.log('AI_RESPONSE: EMIT update_animation', { agentId, requestBody });
    //   if (agentId) {
    //     io.emit(`${agentId}_update_animation`, requestBody.animation);
    //   } else {
    //     io.emit('update_animation', requestBody.animation);
    //   }
    // }

    // // Emit audio response if provided
    // if (requestBody.audioUrl) {
    //   console.log('AI_RESPONSE: EMIT audio_response', { agentId, audioUrl: requestBody.audioUrl });
    //   io.emit(`${agentId}_audio_response`, {
    //     messageId: requestBody.id,
    //     audioUrl: requestBody.audioUrl
    //   });
    // }

    // Emit response with appropriate channel
    if (!agentId) {
      io.emit('ai_response', {
        id: requestBody.id,
        agentId: agentId || undefined,
        // aiResponse: savedResponse,
        text: requestBody.text,
        animation: requestBody.animation,
        handle,
        pfp,
        replyToUser: requestBody.replyToUser,
        replyToMessageId: requestBody.replyToMessageId,
        replyToMessage: requestBody.replyToMessage,
        replyToHandle: requestBody.replyToHandle,
        replyToPfp: requestBody.replyToPfp,
        isGiftResponse: requestBody.isGiftResponse,
        giftId: requestBody.giftId,
        audioUrl: requestBody.audioUrl,
        thought: requestBody.thought,
      });
    } else {
      console.log('EMIT ai_response', { agentId, requestBody });
      io.emit(`${agentId}_ai_response`, {
        id: requestBody.id,
        agentId,
        // aiResponse: savedResponse,
        text: requestBody.text,
        animation: requestBody.animation,
        handle,
        pfp,
        replyToUser: requestBody.replyToUser,
        replyToMessageId: requestBody.replyToMessageId,
        replyToMessage: requestBody.replyToMessage,
        replyToHandle: requestBody.replyToHandle,
        replyToPfp: requestBody.replyToPfp,
        isGiftResponse: requestBody.isGiftResponse,
        giftId: requestBody.giftId,
        audioUrl: requestBody.audioUrl,
        thought: requestBody.thought,
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error generating AI response:', error);
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/comments/mark-read', async (req, res) => {
  try {
    const { commentIds } = req.body;

    if (!Array.isArray(commentIds)) {
      return res.status(400).json({ error: 'commentIds must be an array' });
    }

    const result = await markCommentsAsRead(commentIds);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking comments as read:', error);
    res.status(500).json({ error: 'Failed to mark comments as read' });
  }
});


// Update the socket connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('initial_state', {
    peerCount: getConnectedPeers(),
    likes: likeCount,
    commentCount
  });

  io.emit('peer_count', { count: getConnectedPeers() });

  socket.on('request_peer_count', () => {
    socket.emit('peer_count', { count: getConnectedPeers() });
  });

  socket.on('update_streaming_status', async (data) => {
    try {
      const { agentId, isStreaming, title } = data;
      const status = await StreamingStatus.findOneAndUpdate(
        { agentId },
        {
          isStreaming,
          title,
          startedAt: isStreaming ? new Date() : null,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      io.emit('streaming_status_update', status);
    } catch (error) {
      console.error('Error handling streaming status:', error);
    }
  });


  socket.on('audio_response', async (data) => {
    try {
      console.log('Received audio response socket event:', data);
      const { messageId, agentId, audioUrl } = data;

      const audioResponse = new AudioResponse({
        messageId,
        agentId,
        audioUrl
      });

      await audioResponse.save();

      // Emit to all clients
      io.emit(`${agentId}_audio_response`, {
        messageId,
        agentId,
        audioUrl
      });

    } catch (error) {
      console.error('Error handling audio response socket event:', error);
    }
  });

  socket.on('new_gift', async (data) => {
    console.log('new_gift', data);
    const { gift, agentId } = data;

    try {
      // Save the gift transaction to the database
      const giftTransaction = new GiftTransaction({
        senderPublicKey: data.senderPublicKey,
        recipientAgentId: data.recipientAgentId,
        recipientWallet: data.recipientWallet,
        giftName: data.giftName,
        giftCount: data.giftCount,
        coinsTotal: data.coinsTotal,
        txHash: data.txHash,
        handle: data.handle,
        avatar: data.avatar,
        pfp: data.pfp
      });

      await giftTransaction.save();

      // Prepare the enriched gift data for emission
      const enrichedGiftData = {
        ...data,
        txHash: data.txHash,
        icon: data.icon || gift.icon,
        timestamp: Date.now(),
        handle: data.handle || 'Anonymous',
        avatar: data.avatar || 'default-avatar-url'
      };

      // Emit the enriched gift event to all clients
      io.emit(`${data.recipientAgentId}_gift_received`, enrichedGiftData);
    } catch (error) {
      console.error('Error handling gift transaction:', error);
    }
  });


  // COMMENTS
  // Write me a function to censor this
  

  socket.on('new_comment', async (data) => {
    console.log('new_comment', {data});
    const { comment, agentId } = data;
    try {
      commentCount++;
      
      // Filter the comment text
      const filteredMessage = filterProfanity(comment.message);
      console.log('filteredMessage', filteredMessage, comment.message);

      
      const newComment = new Comment({
        ...comment,
        message: filteredMessage, // Use filtered message
        agentId,
        avatar: comment.avatar,
        handle: comment.handle
      });
      console.log('newComment', newComment);
      await newComment.save();
      io.emit('comment_received', { newComment, commentCount });
      if (agentId) {
        io.emit(`${agentId}_comment_received`, { newComment, commentCount });
      }
    } catch (error) {
      console.error('Error handling new_comment:', error);
    }
  });

  socket.on('new_like', async (data) => {
    console.log('new_like', data);
    const { agentId, user } = data;
    try {
      likeCount++;
      const like = new Like({ agentId, user });
      await like.save();
      io.emit('like_received', { likes: likeCount });
      if (agentId) {
        io.emit(`${agentId}_like_received`, like);
      }
    } catch (error) {
      console.error('Error handling new_like:', error);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Add these new socket event handlers
  socket.on('join_agent_stream', (agentId: string) => {
    const previousStream = socketToStream.get(socket.id);
    if (previousStream) {
      agentViewers.get(previousStream)?.delete(socket.id);
    }

    socketToStream.set(socket.id, agentId);
    if (!agentViewers.has(agentId)) {
      agentViewers.set(agentId, new Set());
    }
    agentViewers.get(agentId)?.add(socket.id);

    emitStreamCounts(); // Emit updated counts to all clients
  });

  socket.on('leave_agent_stream', (agentId: string) => {
    // Remove this socket from the agent's viewers
    agentViewers.get(agentId)?.delete(socket.id);

    // Emit updated viewer count
    const viewerCount = agentViewers.get(agentId)?.size || 0;
    io.emit(`${agentId}_viewer_count`, { count: viewerCount });

    // Clean up empty sets
    if (viewerCount === 0) {
      agentViewers.delete(agentId);
    }
  });

  // Update the disconnect handler
  socket.on('disconnect', () => {
    const agentId = socketToStream.get(socket.id);
    if (agentId) {
      agentViewers.get(agentId)?.delete(socket.id);
      socketToStream.delete(socket.id);
      emitStreamCounts(); // Emit updated counts to all clients
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Create a custom filter function
function filterProfanity(text: string): string {
  // Get the bad words array from the list
  const badWords = badwordsList.array;
  
  // Convert text to lowercase for checking
  let filteredText = text;
  
  // Replace bad words with asterisks
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filteredText = filteredText.replace(regex, '*'.repeat(word.length));
  });
  
  return filteredText;
}

async function saveAgentMap(walletAddress: string, name: string, agentId: string) {
  const agentMap = await AgentMap.findOne({ _id: "global_agent_map" });
  if (agentMap) {
    if (!agentMap.agents.has(agentId)) {
      // If the walletAddress is not already in the agents map, add the new agent
      await AgentMap.findOneAndUpdate(
        { _id: "global_agent_map" },
        { $set: { [`agents.${agentId}`]: {
          name: name,
          walletAddress: walletAddress
        } } },
        { upsert: true, new: true }
      );
      return true;
    } else {
      // update the agent name and wallet address
      agentMap.agents.set(agentId, { name, walletAddress });
      await agentMap.save();
      return true;
    }
  } else {
    // Handle the case where the agent map document does not exist
    console.log('Agent map document not found.');
    return false;
  }
}


// Interface for scene configuration
interface SceneConfig {
  id: number;
  name: string;
  description: string;
  clothes: string;
  model?: string;
  environmentURL?: string;
  defaultAnimation: string;
  cameraPosition: number[];
  cameraRotation: number;
  modelPosition: number[];
  modelRotation: number[];
  modelScale: number[];
  environmentScale: number[];
  environmentPosition: number[];
  environmentRotation: number[];
  cameraPitch: number;
}

// Interface for creator info
interface Creator {
  avatar: string;
  title: string;
  username: string;
}

// Interface for stream statistics
interface StreamStats {
  likes: number;
  comments: number;
  bookmarks: number;
  shares: number;
}

// Interface for scene/stream data
interface Scene {
  id: number;
  title: string;
  agentId: string;
  sceneId: string;
  twitter?: string | null;
  modelName?: string | null;
  identifier: string;
  description: string;
  color: string;
  type: string;
  component: string;
  walletAddress?: string;
  creator: Creator;
  sceneConfigs: SceneConfig[];
  stats: StreamStats;
}

app.get('/api/scenes', async (req: express.Request, res: express.Response) => {
  try {
    // Get all active streams from the database (changed isStreaming to true)
    const activeStreams = await StreamingStatus.find({
      $or: [
        { isAiko: true },
        { isBall: true },
        { isDegenSpartanAI: true },
        { isOn: true },
        {
          $and: [
            { isStreaming: true },
            { lastHeartbeat: { $gte: new Date(Date.now() - 10 * 1000) } },
            { sceneConfigs: { $elemMatch: { model: { $exists: true, $ne: null } } } }
          ]
        }
      ]
    }).lean();        
    // Transform streams into the required format
    const formattedScenes: Scene[] = activeStreams.map((stream, index) => ({
      id: stream.id,
      title: stream.title || 'Untitled Stream',
      agentId: stream.agentId,
      sceneId: stream.sceneId,
      twitter: stream.twitter,
      modelName: stream.modelName,
      identifier: stream.identifier || stream.agentId,
      bgm: stream.bgm,
      description: stream.description,
      color: stream.color,
      type: stream.type || 'stream',
      component: stream.component || "ThreeScene",
      walletAddress: stream.walletAddress,
      creator: stream.creator || {
        avatar: "https://www.aikotv.com/pfp_pink.png",
        title: "Virtual Streamer",
        username: "Anonymous"
      },
      sceneConfigs: stream.sceneConfigs?.map(config => {
        // Get the actual config data, handling potential nesting
        const configData = config.__parentArray?.[0] || config;
        
        return {
          id: configData.id || 0,
          name: configData.name || "Default Scene",
          description: configData.description || "Interactive Scene",
          models: configData.models,
          clothes: configData.clothes || "casual",
          model: configData.model,
          environmentURL: configData.environmentURL,
          defaultAnimation: configData.defaultAnimation || "idle",
          cameraPosition: configData.cameraPosition || [0, 1.15, -2.5],
          cameraRotation: configData.cameraRotation || 0,
          modelPosition: configData.modelPosition || [0, 0, -4],
          modelRotation: configData.modelRotation || [0, 0, 0],
          modelScale: configData.modelScale || [1, 1, 1],
          environmentScale: configData.environmentScale || [1, 1, 1],
          environmentPosition: configData.environmentPosition || [0, -1, -5],
          environmentRotation: configData.environmentRotation || [0, 1.5707963267948966, 0],
          cameraPitch: configData.cameraPitch || 0
        };
      }),
      stats: stream.stats || {
        likes: 0,
        comments: 0,
        bookmarks: 0,
        shares: 0
      }
    }));

    res.json(formattedScenes);
  } catch (error) {
    console.error('Error fetching scenes:', error);
    res.status(500).json({ error: 'Failed to fetch scenes' });
  }
});

app.post('/api/scenes', async (req: express.Request, res: express.Response) => {
  try {
    const {
      agentId,
      title,
      sceneConfigs,
      characterName,
      ...otherData
    } = req.body;

    // Validate required fields
    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Validate sceneConfigs if provided
    if (sceneConfigs) {
      const hasInvalidConfig = sceneConfigs.some((config: any) => 
        !config.model || !config.environmentURL
      );
      if (hasInvalidConfig) {
        return res.status(400).json({ 
          error: 'Each sceneConfig must include model and environmentURL' 
        });
      }
    }
    // Create new streaming status with proper defaults
    const newStream = new StreamingStatus({
      agentId,
      title: title || 'Untitled Stream',
      isStreaming: true,
      characterName: characterName || 'Eliza',  
      lastHeartbeat: new Date(),
      startedAt: new Date(),
      ...otherData,
      // Only set sceneConfigs if provided, otherwise schema defaults will be used
      ...(sceneConfigs && { sceneConfigs })
    });

    await newStream.save();
    res.status(201).json(newStream);

  } catch (error) {
    console.error('Error creating scene:', error);
    res.status(500).json({ error: 'Failed to create scene' });
  }
});
// Add the put endpoint ('/api/agents/:agentId')

app.put('/api/scenes/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const updateData = req.body;

    // Validate agentId
    if (!agentId || !isValidUUID(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required agentId parameter'
      });
    }

    // Get the current document
    const currentDoc = await StreamingStatus.findOne({ agentId });

    // Handle sceneConfigs updates
    if (updateData.sceneConfigs) {
      updateData.sceneConfigs = updateData.sceneConfigs.map((newConfig: any, index: number) => {
        const currentConfig = currentDoc?.sceneConfigs?.[index] || {};
        
        // Handle models array if it exists in the new config
        if (newConfig.models) {
          newConfig.models = newConfig.models.map((newModel: any, modelIndex: number) => {
            const currentModel = currentConfig.models?.[modelIndex] || {};
            return {
              ...currentModel,
              ...newModel
            };
          });
        } else if (currentConfig.models) {
          // Keep existing models if not provided in update
          newConfig.models = currentConfig.models;
        }

        // Merge the current config with the new config
        return {
          ...currentConfig,
          ...newConfig
        };
      });
    }

    const now = new Date();
    
    // Create an update object that preserves existing fields
    const updateFields = Object.keys(updateData).reduce((acc, key) => {
      if (updateData[key] !== undefined) {
        acc[key] = updateData[key];
      }
      return acc;
    }, {} as Record<string, any>);

    // Always update lastHeartbeat and updatedAt
    updateFields.lastHeartbeat = now;
    updateFields.updatedAt = now;

    const status = await StreamingStatus.findOneAndUpdate(
      { agentId },
      { $set: updateFields },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    const viewerCount = agentViewers.get(agentId)?.size || 0;
    const response = {
      ...status.toObject(),
      stats: {
        ...status.stats,
        viewers: viewerCount
      }
    };

    io.emit('streaming_status_update', response);
    io.emit(`${agentId}_heartbeat`, {
      timestamp: status.lastHeartbeat,
      isStreaming: status.isStreaming,
      viewers: viewerCount
    });

    res.json({
      success: true,
      status: response
    });

  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update agent status'
    });
  }
});

// Room Message endpoints
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 15;
    const since = req.query.since ? new Date(req.query.since as string) : new Date(0);

    const messages = await RoomMessage.find({
      roomId,
      createdAt: { $gt: since }
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      messages: messages.reverse() // Return in chronological order
    });

  } catch (error) {
    console.error('Error fetching room messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room messages'
    });
  }
});

app.post('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { agentId, agentName, message, speechUrl } = req.body;

    // Validate required fields
    if (!agentId || !agentName || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Emit using the ai_response pattern with speechUrl
    io.emit(`${agentId}_ai_response`, {
      id: messageId,
      agentId,
      text: message,
      thought: false,
      roomId,
      isRoomMessage: true,
      audioUrl: speechUrl
    });

    // Save to database with speechUrl
    const newMessage = new RoomMessage({
      id: messageId,
      roomId,
      agentId,
      agentName,
      message,
      // speechUrl,
      createdAt: new Date(),
      readByAgent: false
    });

    await newMessage.save();

    res.status(201).json({
      success: true,
      message: newMessage
    });

  } catch (error) {
    console.error('Error creating room message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create room message'
    });
  }
});

// Mark messages as read
app.put('/api/rooms/:roomId/messages/mark-read', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'messageIds must be an array'
      });
    }

    const result = await RoomMessage.updateMany(
      {
        roomId,
        id: { $in: messageIds }
      },
      {
        $set: { readByAgent: true }
      }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});

// Add or updates agent in map
app.put('/api/agentmap/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { name, walletAddress } = req.body;

  if (!agentId || !isValidUUID(agentId)) {
    return res.status(400).json({ error: 'Not a valid agentId' });
  }
  if (!walletAddress || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const success = await saveAgentMap(walletAddress, name, agentId);
  if (!success) {
    return res.status(400).json({ error: 'Agent with this wallet address already exists in map.' });
  }
  res.json({ success: true });
});

app.get('/api/agents', async (req, res) => {
  try {
    // Fetch the agent map document
    const agentMap = await AgentMap.findOne({ _id: "global_agent_map" });

    // If agentMap exists, return only the 'agents' field
    if (agentMap && agentMap.agents) {
      res.json(agentMap.agents);
    } else {
      res.status(404).json({ error: 'Agent map not found' });
    }
  } catch (error) {
    console.error('Error fetching agent map:', error);
    res.status(500).json({ error: 'Failed to fetch agent map' });
  }
});

// Needs some testing from aiko-client to see if it works
app.post('/api/upload/audio', async (req, res) => {
  try {
    // check if req is the audio stream
    console.log('TESTING IF THIS IS BEING CALLED');
    if (req.headers['isAudioStream'] !== 'true' && req.headers['content-type'] !== 'audio/mpeg') {
      return res.status(400).json({ error: 'Not an audio stream' });
    }
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', (err) => reject(err));
    });
    const url = await uploadAudioToBunnyCDN(audioBuffer);
    res.json({ message: 'Upload successful', url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Validate agentId
    if (!agentId || !isValidUUID(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required agentId parameter'
      });
    }
    const status = await StreamingStatus.findOne({ agentId });

    // return agent info
    const response = {
      name: status?.modelName,
      description: status?.creator?.description || 'No description set',
      avatar: status?.creator?.avatar || 'https://aiko-tv.b-cdn.net/images/pfp_pink.png',
      aikoHandle: status?.creator?.username || `${agentId.slice(0, 6)}`,
      twitter: status?.twitter,
      isStreaming: status?.isStreaming
    }

    res.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update agent status'
    });
  }
});

app.post('/api/upload/vrm', 
  vrmUpload, 
  web3Auth({ action: 'vrm:post', allowSkipCheck: true }), 
  async (req, res) => {
    try {
      // get the public key from the request
      const { agentId, isUploading, environmentURL, vrmPicked } = req.body;
      console.log('req.body:', req.body);
      const vrmUploaded = req.file;
      const pk = authorizedPk(res);
      console.log('pk:', pk);
      if (!pk) {
        return res.status(400).json({ error: 'No public key found' });
      }
      const isTrustedUser = await verifyTrustedUser(pk, agentId);
      if (!isTrustedUser) {
        return res.status(400).json({ error: 'Not a trusted user' });
      }

      if (!agentId || !isValidUUID(agentId)) {
        return res.status(400).json({ error: 'Not a valid agentId' });
      }

      let modelName = '';
      if (isUploading === 'true') {
        if (!vrmUploaded) {
          return res.status(400).json({ error: 'No VRM file uploaded' });
        }
        const fileExtension = vrmUploaded.originalname.split('.').pop();
        if (fileExtension !== 'vrm') {
          return res.status(400).json({ error: 'Invalid file type. Only .vrm files are allowed.' });
        }
  
        const vrmBuffer = vrmUploaded.buffer;
        // the originaal file name
        modelName = vrmUploaded.originalname;
        const vrmResponse = await uploadVrmToBunnyCDN(vrmBuffer, modelName);
        if (vrmResponse.status === 'error') {
          return res.status(400).json({ error: 'Failed to upload vrm' });
        }
      } else {
        modelName = '';
      }

      const updateStatus = await StreamingStatus.findOneAndUpdate(
        { agentId },
        { $set: { 
          sceneConfigs: [{
              model: isUploading === 'true' ? modelName : vrmPicked,
              models: [{
                model: isUploading === 'true' ? modelName : vrmPicked,
                agentId
              }]
            }]
          }
        },
        {
          new: true,
          upsert: true,
          runValidators: true // Enable schema validation on update
        }
      );
      if (!updateStatus) {
        return res.status(400).json({ error: 'Failed to update streaming status' });
      }
      //console.log('updateStatus from upload vrm', updateStatus);
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error uploading vrm:', error);
      res.status(500).json({ error: 'Failed to upload vrm' });
    }
  
});

// Avatar Marketplace endpoints
app.post('/api/create/vrm', 
  fileUpload, 
  async (req, res) => {
    try {
      const vrmFile = req.files?.['vrmFile']?.[0];
      const imageFile = req.files?.['imageFile']?.[0];
      if (!vrmFile || !imageFile) {
        return res.status(400).json({ success: false, error: 'No VRM or image file uploaded' });
      }
      const fileExtension = vrmFile.originalname.split('.').pop();
      if (fileExtension !== 'vrm') {
        return res.status(400).json({ success: false, error: 'Invalid file type. Only .vrm files are allowed.' });
      }

      const vrmBuffer = vrmFile.buffer;
      // the originaal file name
      const modelName = vrmFile.originalname;
      const vrmResponse = await uploadVrmToBunnyCDN(vrmBuffer, modelName);
      if (vrmResponse.status === 'error') {
        return res.status(400).json({ success: false, error: 'Failed to upload vrm' });
      }

      const imageBuffer = imageFile.buffer;
      const imageResponse = await uploadImgToBunnyCDN(imageBuffer, imageFile.originalname, 'avatarImages');
      if (imageResponse.status === 'error') {
        return res.status(400).json({ success: false, error: 'Failed to upload image' });
      }
      // add to avatar marketplace
      const avatarMarketplace = await AvatarMarketplace.create({
        filename: modelName,
        screenshot: imageResponse.url,
        createdAt: new Date(),
      })
      console.log('avatarMarketplace:', avatarMarketplace);
      if (!avatarMarketplace) {
        return res.status(400).json({ success: false, error: 'Failed to create avatar marketplace' });
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error uploading vrm:', error);
      res.status(500).json({ success: false, error: 'Failed to upload vrm' });
    }
  
});

// Get all avatars in the marketplace
app.get('/api/avatars', async (req, res) => {
  const avatars = await AvatarMarketplace.find();
  if (!avatars) {
    return res.status(400).json({ success: false, error: 'No avatars found' });
  }

  // Return the avatars array directly without the "avatars" key
  res.status(200).json(avatars);
});
