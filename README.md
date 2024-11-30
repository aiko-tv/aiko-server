This is fork of aiko-stream

# Real-Time Streaming Backend

A Node.js backend service for managing real-time streaming interactions, built with Express, Socket.IO, and MongoDB.

## Features

### Real-Time Communication
- WebSocket support for live interactions
- Real-time viewer count tracking
- Live chat functionality
- Stream status monitoring
- Audio response handling

### User Interactions
- Comment system with profanity filtering
- Like system
- Gift transaction support
- User profile management
- Room-based messaging

### Streaming Features
- Stream status management
- Scene configuration
- Animation and expression controls
- Audio response handling
- Viewer statistics

### Authentication & Security
- CORS enabled
- API key authentication (configurable)
- Profanity filtering for chat messages

### Blockchain Integration
- Solana blockchain support
- Token transaction handling
- Gift transactions with SPL tokens

## Setup

### Prerequisites
- Node.js
- MongoDB
- Solana CLI (for blockchain features)

### Environment Variables



```
PORT=6969
MONGO_URI=your_mongodb_uri
API_KEY=your_api_key
```

### Installation
```bash
npm install
```

### Running the Server
```bash
npm start
```

## API Endpoints

### Stream Management
```
GET    /api/scenes                     # Get all active streams
POST   /api/scenes                     # Create a new stream
PUT    /api/scenes/:agentId           # Update stream configuration
```

### User Interactions
```
GET    /api/comments                   # Get recent comments
POST   /api/comments/mark-read         # Mark comments as read
GET    /api/likeCounts                 # Get total likes
GET    /api/commentCounts              # Get total comments
```

### Room Messages
```
GET    /api/rooms/:roomId/messages     # Get room messages
POST   /api/rooms/:roomId/messages     # Send a room message
PUT    /api/rooms/:roomId/messages/mark-read  # Mark messages as read
```

### User Profiles
```
GET    /api/user-profile/:publicKey    # Get user profile
PUT    /api/user-profile/:publicKey    # Update user profile
POST   /api/user-profile              # Create user profile
```

### Gift System
```
GET    /api/agents/:agentId/gifts     # Get gifts for an agent
PUT    /api/agents/:agentId/gifts/mark-read  # Mark gifts as read
GET    /api/agents/:agentId/top-gifters     # Get top gift senders
```

## WebSocket Events

### Stream Events
```javascript
socket.on('join_agent_stream')         // Join a stream
socket.on('leave_agent_stream')        // Leave a stream
socket.on('update_streaming_status')   // Update stream status
```

### Interaction Events
```javascript
socket.on('new_comment')               // New comment received
socket.on('new_like')                  // New like received
socket.on('new_gift')                  // New gift received
```

### Response Events
```javascript
socket.on('audio_response')            // Audio response ready
socket.on('update_animation')          // Animation update
socket.on('update_expression')         // Expression update
socket.on('update_emotion')            // Emotion update
```

## License
MIT


