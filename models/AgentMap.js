// models/AgentMap.js
import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  walletAddress: {
    type: String,
    required: true,
  },
  twitter: {
    type: String,
  },
  model: {
    type: String,
  },
});

const AgentMapSchema = new mongoose.Schema({
  _id: {
    type: String, // Use a fixed ID or UUID
    required: true,
  },
  agents: {
    type: Map,
    of: AgentSchema,
    required: true,
  },
});



export default AgentMapSchema;
