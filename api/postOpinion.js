import { connectToDatabase } from '../utils/db';  // Corrected path
import mongoose from 'mongoose';
import { publishToAbly } from '../utils/ably';  // Corrected path

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
const Post = mongoose.model('Post', postSchema);

// Set CORS headers with dynamic domain handling (Allow all origins for testing)
const setCorsHeaders = (req, res) => {
    // Allow all origins for testing, or specify a dynamic list of allowed origins
    res.setHeader('Access-Control-Allow-Origin', '*');  // Allow all domains (use with caution in production)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');  // Allowing additional headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');  // Allow credentials (cookies or authentication)
    res.setHeader('Cache-Control', 'no-cache');  // Prevent caching of OPTIONS requests

    console.log('CORS headers set:', req.headers.origin);  // Log the origin of the request
};

// Serverless API handler for creating/editing posts
export default async function handler(req, res) {
    // Handle pre-flight OPTIONS request
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        setCorsHeaders(req, res);  // Include CORS headers for OPTIONS requests
        return res.status(200).end(); // Respond with 200 OK for OPTIONS pre-flight
    }

    // Set CORS headers for all other requests
    console.log('Handling method:', req.method);
    setCorsHeaders(req, res);

    if (req.method === 'POST') {
        const { message, username, sessionId } = req.body;

        // Validate input
        if (!message || message.trim() === '') {
            console.log('Validation error: Message cannot be empty');
            return res.status(400).json({ message: 'Message cannot be empty' });
        }
        if (!username || !sessionId) {
            console.log('Validation error: Username and sessionId are required');
            return res.status(400).json({ message: 'Username and sessionId are required' });
        }

        try {
            console.log('Connecting to database...');
            await connectToDatabase();  // Ensure this step completes
            console.log('Database connected successfully.');

            const newPost = new Post({ message, timestamp: new Date(), username, sessionId });
            await newPost.save();

            console.log('New post saved:', newPost);

            // Publish to Ably
            try {
                await publishToAbly('newOpinion', newPost);
                console.log('Post published to Ably:', newPost);
            } catch (error) {
                console.error('Error publishing to Ably:', error);
            }

            // Send only necessary data, not the full Mongoose document
            const cleanPost = {
                _id: newPost._id,
                message: newPost.message,
                timestamp: newPost.timestamp,
                username: newPost.username,
                likes: newPost.likes,
                dislikes: newPost.dislikes,
                comments: newPost.comments,
            };

            console.log('Sending response with new post:', cleanPost);
            res.status(201).json(cleanPost);  // Send clean post data
        } catch (error) {
            console.error('Error saving post:', error);
            res.status(500).json({ message: 'Error saving post', error });
        }
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
        // Handle post edit
        const { postId, message, likes, dislikes, comments } = req.body;

        if (!postId) {
            console.log('Validation error: Post ID is required');
            return res.status(400).json({ message: 'Post ID is required' });
        }

        try {
            console.log('Connecting to database...');
            await connectToDatabase();
            console.log('Database connected successfully.');

            const post = await Post.findById(postId);
            if (!post) {
                console.log('Post not found with ID:', postId);
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

            await post.save();

            console.log('Post updated:', post);

            // Publish to Ably
            try {
                await publishToAbly('editOpinion', post);
                console.log('Post updated in Ably:', post);
            } catch (error) {
                console.error('Error publishing to Ably:', error);
            }

            const updatedPost = {
                _id: post._id,
                message: post.message,
                timestamp: post.timestamp,
                username: post.username,
                likes: post.likes,
                dislikes: post.dislikes,
                comments: post.comments,
            };

            console.log('Sending response with updated post:', updatedPost);
            res.status(200).json(updatedPost);  // Send updated post data

        } catch (error) {
            console.error('Error editing post:', error);
            res.status(500).json({ message: 'Error editing post', error });
        }
    } else {
        console.log('Method not allowed:', req.method);
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}
