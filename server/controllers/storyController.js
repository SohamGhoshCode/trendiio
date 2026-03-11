import fs from 'fs'
import imagekit from "../configs/imagekit.js"
import Story from '../models/Story.js'
import User from '../models/User.js'
import { inngest } from '../inngest/index.js'


//Add User Story
export const addUserStory = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { content, media_type, background_color } = req.body;
        const media = req.file;
        let media_url = '';

        // Handle media upload if type is image or video
        if ((media_type === 'image' || media_type === 'video') && media) {
            try {
                // Use buffer from memoryStorage instead of fs.readFileSync
                const fileBuffer = media.buffer;
                const response = await imagekit.upload({
                    file: fileBuffer,
                    fileName: media.originalname,
                });
                media_url = response.url;
            } catch (err) {
                console.error('ImageKit upload failed:', err);
                return res.status(500).json({ success: false, message: 'Failed to upload media' });
            }
        }

        // If media_type is image/video but no file provided
        if ((media_type === 'image' || media_type === 'video') && !media) {
            return res.status(400).json({ success: false, message: 'Media file is required for this media type' });
        }

        // Create Story (text-only or with media)
        const story = await Story.create({
            user: userId,
            content,
            media_url,
            media_type,   
            background_color
        });

        // Schedule story deletion after 24 hours
        await inngest.send({
            name: 'app/story.delete',
            data: { storyId: story._id }
        });

        res.status(200).json({ success: true, story });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};


//Get User Story
export const getStories = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await User.findById(userId);

        const userIds = [userId, ...(user.connections || []), ...(user.following || [])];

        const stories = await Story.find({ user: { $in: userIds } })
            .populate('user', 'username profile_picture')  // only fetch required fields
            .sort({ createdAt: -1 });

        // Return stories with fallback values to prevent blank cards
        const formattedStories = stories.map(story => ({
            _id: story._id,
            content: story.content || '',
            media_url: story.media_url || '',
            media_type: story.media_type || 'text',
            background_color: story.background_color || '#4f46e5',
            createdAt: story.createdAt,
            user: {
                _id: story.user?._id || '',
                username: story.user?.username || 'Unknown',
                profile_picture: story.user?.profile_picture || '/default-avatar.png'
            }
        }));

        res.json({ success: true, stories: formattedStories });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};
