import mongoose from 'mongoose';
import { connectToDatabase } from '../utils/db'; // Your connection utility

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

// Serverless API handler for getting posts
export default async function handler(req, res) {
    // Set CORS headers before processing the request
    setCorsHeaders(res);

    // Handle pre-flight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end(); // Respond with a 200 OK for OPTIONS pre-flight
    }

    // Handle GET requests to fetch posts
    if (req.method === 'GET') {
        try {
            await connectToDatabase(); // Connect to MongoDB

            // Fetch posts from the database, sorted by the timestamp in descending order
            const posts = await Post.find().sort({ timestamp: -1 });
            res.status(200).json(posts); // Send posts as a JSON response
        } catch (error) {
            console.error("Error retrieving posts:", error);
            res.status(500).json({ message: 'Error retrieving posts', error }); // Handle any errors
        }
    } else {
        // If the request is not a GET request, respond with 405 Method Not Allowed
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}
