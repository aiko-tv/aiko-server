import mongoose from 'mongoose';
import AgentMapSchema from '../models/AgentMap.js';
const AgentMap = mongoose.model('AgentMap', AgentMapSchema);

export const AGENT_MAP = {
    data: {
        "a9f3105f-7b14-09bd-919f-a1482637a374": {
            name: "Aiko",
            walletAddress: "AM84n1iLdxgVTAyENBcLdjXoyvjentTbu5Q6EpKV1PeG",
        },
        "b850bc30-45f8-0041-a00a-83df46d8555d": {
            name: "Eliza",
            walletAddress: "AM84n1iLdxgVTAyENBcLdjXoyvjentTbu5Q6EpKV1PeG",
        },
        "ffc1faee-704d-0c1e-abc4-2198dfb8eda8": {
            name: "Eliza's Sister",
            walletAddress: "AM84n1iLdxgVTAyENBcLdjXoyvjentTbu5Q6EpKV1PeG",
        }
    }
}

export async function seedAgentMap() {
    try {
      // Merge agents into a single "agents" map
      const agentsMap = AGENT_MAP.data;
  
      // Update or create a single AgentMap document with all agents
      await AgentMap.findOneAndUpdate(
        { _id: "global_agent_map" }, // A fixed ID for this document
        { $set: { agents: agentsMap } }, // Set the entire agents map
        { upsert: true, new: true }
      );
  
      console.log("Agent map seeded successfully.");
    } catch (error) {
      console.error("Error seeding agent map:", error);
    }
  }
