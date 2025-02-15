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

// Set CORS headers with dynamic domain handling
const setCorsHeaders = (req, res) => {
    // Allow requests from a specific origin (adjust this for production environment)
    res.setHeader('Access-Control-Allow-Origin', '*');  // Update with your allowed domain
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');  // Adjust based on your needs (set to true if using cookies or sessions)
};

// Serverless API handler for creating/editing posts
export default async function handler(req, res) {
    // Handle pre-flight OPTIONS request
    if (req.method === 'OPTIONS') {
        setCorsHeaders(req, res);  // Include CORS headers for OPTIONS requests
        return res.status(200).end(); // Respond with 200 OK for OPTIONS pre-flight
    }

    // Set CORS headers for other requests (POST, PUT, PATCH, etc.)
    setCorsHeaders(req, res);

    if (req.method === 'POST') {
        const { message, username, sessionId } = req.body;

        // Validate input
        if (!message || message.trim() === '') {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }
        if (!username || !sessionId) {
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

            res.status(201).json(cleanPost);  // Send clean post data
        } catch (error) {
            console.error('Error saving post:', error);
            res.status(500).json({ message: 'Error saving post', error });
        }
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
        // Handle post edit
        const { postId, message, likes, dislikes, comments } = req.body;

        if (!postId) {
            return res.status(400).json({ message: 'Post ID is required' });
        }

        try {
            console.log('Connecting to database...');
            await connectToDatabase();
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

            res.status(200).json(updatedPost);  // Send updated post data

        } catch (error) {
            console.error('Error editing post:', error);
            res.status(500).json({ message: 'Error editing post', error });
        }
    } else {
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}
