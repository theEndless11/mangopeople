import { connectToDatabase } from '../utils/db';  
import mongoose from 'mongoose';
import { publishToAbly } from '../utils/ably';  

const postSchema = new mongoose.Schema({
    message: String,
    timestamp: Date,
    username: String,
    sessionId: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    likedBy: [String],  
    dislikedBy: [String],  
    comments: [{ username: String, comment: String, timestamp: Date }]
});

const Post = mongoose.model('Post', postSchema);

const setCorsHeaders = (res) => {
    const allowedOrigin = 'https://latestnewsandaffairs.site';  // Replace with your allowed domain
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    console.log('CORS headers set to:', allowedOrigin);  // Log the origin being set
};

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    setCorsHeaders(res);

    if (req.method === 'POST') {
        const { message, username, sessionId } = req.body;

        // Validate request body
        if (!message || message.trim() === '') {
            console.error('Message cannot be empty');
            return res.status(400).json({ message: 'Message cannot be empty' });
        }
        if (!username || !sessionId) {
            console.error('Username and sessionId are required');
            return res.status(400).json({ message: 'Username and sessionId are required' });
        }

        try {
            console.log('Connecting to database...');
            await connectToDatabase();
            console.log('Database connected successfully.');

            const newPost = new Post({ message, timestamp: new Date(), username, sessionId });
            console.log('New Post data:', newPost);

            try {
                const savedPost = await newPost.save();
                console.log('Post saved:', savedPost);

                try {
                    // Publish to Ably for real-time updates
                    await publishToAbly('newOpinion', savedPost);
                    console.log('Post published to Ably:', savedPost);
                } catch (ablyError) {
                    console.error('Error publishing to Ably:', ablyError);
                    // Still return the post to client, even if Ably fails
                }

                const cleanPost = {
                    _id: savedPost._id,
                    message: savedPost.message,
                    timestamp: savedPost.timestamp,
                    username: savedPost.username,
                    likes: savedPost.likes,
                    dislikes: savedPost.dislikes,
                    comments: savedPost.comments,
                };

                return res.status(201).json(cleanPost);
            } catch (saveError) {
                console.error('Error saving post to database:', saveError);
                return res.status(500).json({ message: 'Error saving post', error: saveError.message });
            }
        } catch (dbError) {
            console.error('Database connection failed:', dbError);
            return res.status(500).json({ message: 'Database connection error', error: dbError.message });
        }
    } else {
        console.error('Method Not Allowed');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
}

