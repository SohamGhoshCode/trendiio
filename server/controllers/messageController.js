import imagekit from '../configs/imagekit.js';
import Message from '../models/Message.js';
import { WebSocketServer, WebSocket } from 'ws';

// Map of userId → WebSocket connection
const clients = new Map();

// Initialize the WebSocket server (attached to HTTP server in server.js)
export const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, userId) => {
    // Store the client connection keyed by userId
    clients.set(userId, ws);
    console.log(`WebSocket connected: ${userId}`);

    // Send confirmation to the client
    ws.send(JSON.stringify({ event: 'connected', message: 'WebSocket connected' }));

    // Remove client when they disconnect
    ws.on('close', () => {
        clients.delete(userId);
        console.log(`WebSocket disconnected: ${userId}`);
    });

    ws.on('error', (err) => {
        console.error(`WebSocket error for ${userId}:`, err.message);
        clients.delete(userId);
    });
});

// Upgrade handler — call this from server.js on the 'upgrade' event
export const handleUpgrade = (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, userId);
    });
};

//Send Message
export const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { to_user_id, text } = req.body
    const image = req.file

    let media_url = ''
    const message_type = image ? 'image' : 'text'

    if (image) {
      const fileBuffer = image.buffer
      const base64 = fileBuffer.toString('base64')
      const file = `data:${image.mimetype};base64,${base64}`

      const response = await imagekit.upload({
        file,
        fileName: image.originalname
      })

      media_url = imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: 'auto' },
          { format: 'webp' },
          { width: '1280' }
        ]
      })
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text,
      message_type,
      media_url
    })

    const messageWithUserData = await Message
      .findById(message._id)
      .populate('from_user_id to_user_id')

    // Push message in real-time if the recipient is connected via WebSocket
    const recipientWs = clients.get(to_user_id);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify(messageWithUserData));
    }

    return res.status(201).json({
      success: true,
      message: messageWithUserData
    })

  } catch (error) {
    console.error('sendMessage error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}


//Get Chat Messages

export const getChatMessages = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id } = req.body;

        const messages = await Message.find({
            $or: [
                {from_user_id: userId, to_user_id},
                {from_user_id: to_user_id, to_user_id: userId},
            ]
        }).sort({createdAt: -1})
        //mark messages as seen
        await Message.updateMany({from_user_id: to_user_id, to_user_id: userId}, {seen: true})
        res.json({success: true, messages})


        
    } catch (error) {
        res.json({success: false, message: error.message})
        
    }
}



export const getUserRecentMessages = async (req, res) => {
    try {
        const {userId} = req.auth();
        const messages = await Message.find({ to_user_id: userId }).populate('from_user_id to_user_id').sort({ createdAt: -1 })

        res.json({success: true, messages})

        
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}