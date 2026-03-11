import fs from 'fs'
import imagekit from '../configs/imagekit.js';
import Message from '../models/Message.js';


//Create an empty object to store SS Event Connections
const connections = {};

//Controller function for the SSE endpoint
export const sseController = (req, res)=>{
    const { userId } = req.params
    

    //Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const origin = req.headers.origin || 'https://trendiio.vercel.app'
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    //Add the client's respose object to the connections object
    connections[userId] = res

    //Send an initial event to the client
    res.write(`event: connected\ndata: Connected to SSE stream\n\n`)


    //Handle client disconnection
    req.on('close',()=>{
        //Remove the client's response object from the connections array
        delete connections[userId]
        console.log('Client disconnected')
    })

}

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

    if (connections[to_user_id]) {
      connections[to_user_id].write(
        `data: ${JSON.stringify(messageWithUserData)}\n\n`
      )
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