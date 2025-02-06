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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
};

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    setCorsHeaders(res);

    if (req.method === 'POST') {
        const { message, username, sessionId } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }
        if (!username || !sessionId) {
            return res.status(400).json({ message: 'Username and sessionId are required' });
        }

        try {
            console.log('Connecting to database...');
            await connectToDatabase();
            console.log('Database connected successfully.');

            const newPost = new Post({ message, timestamp: new Date(), username, sessionId });
            try {
                await newPost.save();
                console.log('New post saved:', newPost);

                try {
                    await publishToAbly('newOpinion', newPost);
                    console.log('Post published to Ably:', newPost);
                } catch (ablyError) {
                    console.error('Error publishing to Ably:', ablyError);
                }

                const cleanPost = {
                    _id: newPost._id,
                    message: newPost.message,
                    timestamp: newPost.timestamp,
                    username: newPost.username,
                    likes: newPost.likes,
                    dislikes: newPost.dislikes,
                    comments: newPost.comments,
                };

                res.status(201).json(cleanPost);
            } catch (saveError) {
                console.error('Error saving post:', saveError);
                res.status(500).json({ message: 'Error saving post', error: saveError });
            }
        } catch (dbError) {
            console.error('Database connection failed:', dbError);
            res.status(500).json({ message: 'Database connection error', error: dbError });
        }
    } else {
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}

