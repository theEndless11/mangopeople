import mongoose from 'mongoose';
import { connectToDatabase } from '../utils/db';
import { publishToAbly } from '../utils/ably';

// Define the schema for the post
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

// Set CORS headers for all methods
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');  // Allow all origins (or specify a specific domain)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');  // Allowed methods
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');  // Allowed headers
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // Enable cookies if needed
};

// Serverless API handler for creating/editing posts
export default async function handler(req, res) {
    setCorsHeaders(res); // Ensure headers are set before sending the response

    if (req.method === 'OPTIONS') {
        return res.status(200).end(); // Respond with 200 OK for OPTIONS pre-flight request
    }

    try {
        if (req.method === 'POST') {
            const { message, username, sessionId } = req.body;

            if (!message || message.trim() === '') {
                return res.status(400).json({ message: 'Message cannot be empty' });
            }
            if (!username || !sessionId) {
                return res.status(400).json({ message: 'Username and sessionId are required' });
            }

            // Connect to database and save the new post
            await connectToDatabase();

            const newPost = new Post({ message, timestamp: new Date(), username, sessionId });
            await newPost.save();

            // Optional: Publish to Ably (if you need to notify clients in real time)
            try {
                await publishToAbly('newOpinion', newPost);
            } catch (error) {
                console.error('Error publishing to Ably:', error);
            }

            // Return the new post data
            const cleanPost = {
                _id: newPost._id,
                message: newPost.message,
                timestamp: newPost.timestamp,
                username: newPost.username,
                likes: newPost.likes,
                dislikes: newPost.dislikes,
                comments: newPost.comments,
            };

            return res.status(201).json(cleanPost);  // Send the created post data
        } else {
            return res.status(405).json({ message: 'Method Not Allowed' });  // Method not allowed response
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({ message: 'Internal Server Error', error });
    }
}

