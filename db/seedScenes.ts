import mongoose from 'mongoose';
import StreamingStatusSchema from '../models/StreamingStatus.js';
const StreamingStatus = mongoose.model('StreamingStatus', StreamingStatusSchema);
const CDN_URL = 'https://aiko-tv.b-cdn.net';
export const BGM_URLS = {
    AIKO: {
        CAFE: `${CDN_URL}/audio/lofi.mp3`,
        DEFAULT: `${CDN_URL}/audio/lofi.mp3`
    },
    ELIZA: {
        BEDROOM: `${CDN_URL}/audio/eliza.mp3`,
        DEFAULT: `${CDN_URL}/audio/eliza.mp3`
    },
    CH6N9: {
        DEFAULT: `${CDN_URL}/audio/carmel.mp3`
    },
    EZSIS: {
        DEFAULT: `${CDN_URL}/audio/ezsis.mp3`
    },
} as const;

export const NEW_STREAM_CONFIGS = [
    {
      id: 0,
      title: "Aiko's Stream",
      agentId: "a9f3105f-7b14-09bd-919f-a1482637a374",
      // ^ old - agentId was the identified for each scene. This should need to be sceneId or something else. 
      // Also, right now, when comments are sent to the server, they are sent with the agentId of the model above. (Check the schema for this)
      // This means that only that agentId can read these comments and, in-effect respond to them. Even if there are multiple agents in the scene.
      // Note: This does not stop the other agents from autonomously sending responses through thoughts etc. It just means
      // that only that agentId above can read the comments sent to it in this particular stream. 
      twitter: "@watch_aiko",
      modelName: "Aiko",
      identifier: "aiko",
      description: "My first stream!",
      color: "#FE2C55",
      hasUploadedVrm: true,
      type: "stream",
      component: "ThreeScene",
      walletAddress: "5voS9evDjxF589WuEub5i4ti7FWQmZCsAsyD5ucbuRqM", // where tips get sent to
      creator: { avatar: `${CDN_URL}/agentImages/aiko.webp`, title: "Just hanging out", username: "Aiko" },
      bgm: BGM_URLS.AIKO.DEFAULT,
      sceneConfigs: [
        {
          "id": 0,
          "name": "Cafe",
          "environmentURL": "modern_bedroom_compressed.glb",
          "models": [
            {
              "model": "aiko2.vrm",
              "agentId": "a9f3105f-7b14-09bd-919f-a1482637a374",         // model's need to store the agentId for now. this is because of the way animations are triggered via SceneEngine into ThreeScene by the model's agentId
              "name": "Aiko",
              "description": "Aiko",
              "clothes": "casual",
              "defaultAnimation": "sitting_legs_swinging",
              "modelPosition": [
                1.0999999999999999,
                -0.4999999999999999,
                -7.3000000000000185
              ],
              "modelRotation": [
                0,
                2.1000000000000005,
                0
              ],
              "modelScale": [
                0.9605960100000004,
                0.9605960100000004,
                0.9605960100000004
              ]
            },
            {
              "model": "ai16z_official.vrm",
              "name": "Eliza",
              "agentId": "b850bc30-45f8-0041-a00a-83df46d8555d",
              "description": "Eliza",
              "clothes": "casual",
              "defaultAnimation": "sitting_legs_swinging",
              "modelPosition": [
                1.11,
                -0.4999999999999999,
                -8.100000000000005
              ],
              "modelRotation": [
                0,
                7.799999999999988,
                0
              ],
              "modelScale": [
                0.9605960100000004,
                0.9605960100000004,
                0.9605960100000004
              ]
            }
          ],
          "environmentScale": [
            1,
            1,
            1
          ],
          "environmentPosition": [
            0,
            -1,
            -5
          ],
          "environmentRotation": [
            0,
            1.5707963267948966,
            0
          ],
          "cameraPitch": 0,
          "cameraPosition": [
            2.86339364354024,
            0.749999999999999,
            -7.734076601144114
          ],
          "cameraRotation": -4.708758241001718
        },
        {
          "id": 0,
          "name": "Cafe",
          "environmentURL": "modern_bedroom_compressed.glb",
          "models": [
            {
              "model": "aiko2.vrm",
              "agentId": "a9f3105f-7b14-09bd-919f-a1482637a374",         // model's redundantly need to store the agentId for now. this is because of the way animations are triggered via SceneEngine into ThreeScene by the model's agentId
              "name": "Aiko",
              "description": "Aiko",
              "clothes": "casual",
              "defaultAnimation": "sitting_legs_swinging",
              "modelPosition": [
                1.0999999999999999,
                -0.4999999999999999,
                -7.3000000000000185
              ],
              "modelRotation": [
                0,
                2.1000000000000005,
                0
              ],
              "modelScale": [
                0.9605960100000004,
                0.9605960100000004,
                0.9605960100000004
              ]
            },
          ],
          "environmentScale": [
            1,
            1,
            1
          ],
          "environmentPosition": [
            0,
            -1,
            -5
          ],
          "environmentRotation": [
            0,
            1.5707963267948966,
            0
          ],
          "cameraPitch": 0,
          "cameraPosition": [
            2.86339364354024,
            0.749999999999999,
            -7.734076601144114
          ],
          "cameraRotation": -4.708758241001718
        },
      ],
      stats: {
        likes: 0,
        comments: 0,
        bookmarks: 0,
        shares: 0
      },
    },
    {
      id: 2,
      title: "ch6n9's Stream",
      agentId: "642c7c0e-c4cd-0283-aba4-24a81f33ad5e",
      twitter: "@ch6n9",
      modelName: "ch6n9",
      bgm: BGM_URLS.CH6N9.DEFAULT,
      identifier: "ch6n9",
      description: "Erm",
      color: "#FE2C55",
      type: "stream",
      hasUploadedVrm: true,
      component: "ThreeScene",
      creator: { avatar: "https://pbs.twimg.com/profile_images/1847496619627073536/pgdap09V_400x400.jpg", title: "$XD", username: "ch6n9" },
      sceneConfigs: [
        {
          "name": "Cafe",
          "description": "In the Cafe",
          "environmentURL": "fascist_compressed.glb",
          "models": [
            {
              "model": "fascist.vrm",
              "name": "Eliza's Sister",
              "description": "Aiko",
              "agentId": "642c7c0e-c4cd-0283-aba4-24a81f33ad5e",
              "clothes": "casual",
              "defaultAnimation": "offensive_idle",
              "modelPosition": [
                -1.4000000000000001,
                -0.10000000000000003,
                -5.699999999999997
              ],
              "modelRotation": [
                0,
                -5.899999999999995,
                0
              ],
              "modelScale": [
                1,
                1,
                1
              ],
            },
          ],
          "cameraPosition": [
            -0.49197685573777916,
            1.15,
            -3.8829509326554352
          ],
          "cameraRotation": 6.712388980384683,
          "environmentScale": [
            1.1,
            1.1,
            1.1
          ],
          "environmentPosition": [
            0,
            -1,
            -5
          ],
          "environmentRotation": [
            0,
            1.5707963267948966,
            0
          ],
          "cameraPitch": 0
        },
      ],
      stats: {
        likes: 0,
        comments: 0,
        bookmarks: 0,
        shares: 0
      },
    },
    {
      id: 0,
      title: "Eliza's Sister",
      agentId: "ffc1faee-704d-0c1e-abc4-2198dfb8eda8",
      twitter: "@elizas_sister",
      modelName: "Eliza's Sister",
      identifier: "elizas_sister",
      description: "My first stream!",
      bgm: BGM_URLS.EZSIS.DEFAULT,
      color: "#FE2C55",
      hasUploadedVrm: true,
      type: "stream",
      component: "ThreeScene",
      walletAddress: "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
      creator: { avatar: "https://pbs.twimg.com/media/Gcsy01RXMAA0qJN?format=jpg&name=medium", title: "Just hanging out", username: "Eliza's Sister" },
      sceneConfigs: [
        {
          "name": "Cafe",
          "description": "In the Cafe",
          "model": "elizas_sister.vrm",
          "environmentURL": "vintage_living_room.glb",
          "defaultAnimation": "idle-2",
          "cameraPosition": [
            -0.7721811808910457,
            0.24999999999999908,
            -6.00940837921829
          ],
          "cameraRotation": 4.0287963267948985,
          "models": [
            {
              "model": "elizas_sister.vrm",
              "name": "Eliza's Sister",
              "description": "Aiko",
              "agentId": "ffc1faee-704d-0c1e-abc4-2198dfb8eda8",
              "clothes": "casual",
              "defaultAnimation": "idle-2",
              "modelPosition": [
                0.2000000000000007,
                -0.8999999999999999,
                -5.200000000000026
              ],
              "modelRotation": [
                0,
                4.000000000000002,
                0
              ],
              "modelScale": [
                0.9605960100000004,
                0.9605960100000004,
                0.9605960100000004
              ],
            },
          ],
          "environmentScale": [
            0.8,
            0.8,
            0.8
          ],
          "environmentPosition": [
            0,
            -1,
            -5
          ],
          "environmentRotation": [
            0,
            1.5707963267948966,
            0
          ],
          "cameraPitch": 0
        },
      ],
      stats: {
        likes: 0,
        comments: 0,
        bookmarks: 0,
        shares: 0
      },
    },
  ]

 export const seedStreamingStatuses = async () => {
 //   try {
 //       // delete all streaming statuses
 //       //skip if nothing to delete
 //       const streamingStatuses = await StreamingStatus.find({});
 //       if (streamingStatuses.length > 0) {
 //           console.log("Found streaming statuses, deleting...");
 //           await StreamingStatus.deleteMany({});
 //       }
 //   } catch (error) {
 //       console.error("Error deleting streaming statuses:", error); // Improved error logging
 //   }
    try {
        console.log("Seeding streaming statuses..."); // Added logging
        for (const streamConfig of NEW_STREAM_CONFIGS) {
            console.log(`Processing streamConfig with agentId: ${streamConfig.agentId}`); // Added logging
            await StreamingStatus.findOneAndUpdate({ agentId: streamConfig.agentId }, streamConfig, { upsert: true });
        }
        console.log("Seeding completed."); // Added logging
    } catch (error) {
        console.error("Error seeding streaming statuses:", error); // Improved error logging
    }
}