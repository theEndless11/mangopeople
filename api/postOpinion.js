import mongoose from 'mongoose';
import { connectToDatabase } from '../utils/db'; // Your connection utility
import { publishToAbly } from '../utils/ably';  // Assuming you have an Ably utility

// Define the schema for the post
const postSchema = new mongoose.Schema({
    message: String,
    timestamp: Date,
    username: String,
    sessionId: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    likedBy: [String],  // Store usernames or user IDs of users who liked the post
    dislikedBy: [String],  // Store usernames or user IDs of users who disliked the post
    comments: [{ username: String, comment: String, timestamp: Date }]
});

// Create the model for posts
const Post = mongoose.model('Post', postSchema);

// Set CORS headers for all methods
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');  // Allow all origins or set a specific domain
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');  // Allowed methods
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');  // Allowed headers
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // Enable cookies if needed
};

// Serverless API handler for creating/editing posts
export default async function handler(req, res) {
    // Ensure CORS headers are set before sending the response
    setCorsHeaders(res);

    // Handle pre-flight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end(); // Respond with 200 OK for OPTIONS pre-flight
    }

    try {
        if (req.method === 'POST') {
            // Handle new post creation
            const { message, username, sessionId } = req.body;

            if (!message || message.trim() === '') {
                return res.status(400).json({ message: 'Message cannot be empty' });
            }
            if (!username || !sessionId) {
                return res.status(400).json({ message: 'Username and sessionId are required' });
            }

            console.log('Connecting to database...');
            await connectToDatabase();  // Ensure this step completes
            console.log('Database connected successfully.');

            const newPost = new Post({ message, timestamp: new Date(), username, sessionId });
            await newPost.save();

            console.log('New post saved:', newPost);

            // Publish to Ably (optional, as per your requirement)
            try {
                await publishToAbly('newOpinion', newPost);
                console.log('Post published to Ably:', newPost);
            } catch (error) {
                console.error('Error publishing to Ably:', error);
            }

            // Send only the necessary data (not the full Mongoose document)
            const cleanPost = {
                _id: newPost._id,
                message: newPost.message,
                timestamp: newPost.timestamp,
                username: newPost.username,
                likes: newPost.likes,
                dislikes: newPost.dislikes,
                comments: newPost.comments,
            };

            return res.status(201).json(cleanPost);  // Send clean post data without Mongoose metadata
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
            // Handle post edit
            const { postId, message, likes, dislikes, comments } = req.body;

            if (!postId) {
                return res.status(400).json({ message: 'Post ID is required' });
            }

            console.log('Connecting to database...');
            await connectToDatabase();  // Ensure this step completes
            console.log('Database connected successfully.');

            const post = await Post.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Update the fields (message, likes, dislikes, comments)
            if (message && message.trim() !== '') {
                post.message = message;
            }
            if (likes !== undefined) {
                post.likes = likes;
            }
            if (dislikes !== undefined) {
                post.dislikes = dislikes;
            }
            if (comments !== undefined) {
                post.comments = comments;
            }

            // Save the updated post
            await post.save();

            console.log('Post updated:', post);

            // Publish to Ably (optional)
            try {
                await publishToAbly('editOpinion', post);
                console.log('Post updated in Ably:', post);
            } catch (error) {
                console.error('Error publishing to Ably:', error);
            }

            // Send only the necessary data (not the full Mongoose document)
            const updatedPost = {
                _id: post._id,
                message: post.message,
                timestamp: post.timestamp,
                username: post.username,
                likes: post.likes,
                dislikes: post.dislikes,
                comments: post.comments,
            };

            return res.status(200).json(updatedPost);  // Send updated post data

        } else {
            return res.status(405).json({ message: 'Method Not Allowed' });  // Method not allowed response
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({ message: 'Internal Server Error', error });
    }
}

