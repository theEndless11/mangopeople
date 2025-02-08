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

    // Handle POST requests for creating a post
    if (req.method === 'POST') {
        const { message, username, sessionId } = req.body;

        // Validate request body
        if (!message || message.trim() === '') {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }
        if (!username || !sessionId) {
            return res.status(400).json({ message: 'Username and sessionId are required' });
        }

        try {
            await connectToDatabase();
            const newPost = new Post({ message, timestamp: new Date(), username, sessionId });
            const savedPost = await newPost.save();

            // Respond with the clean post data
            res.status(201).json({
                _id: savedPost._id,
                message: savedPost.message,
                timestamp: savedPost.timestamp,
                username: savedPost.username,
                likes: savedPost.likes,
                dislikes: savedPost.dislikes,
                comments: savedPost.comments,
            });
        } catch (error) {
            console.error('Error saving post to database:', error);
            return res.status(500).json({ message: 'Error saving post', error: error.message });
        }
    }

    // Handle PUT requests for liking a post
    else if (req.method === 'PUT' && req.query.action === 'like') {
        const { postId, username } = req.body;

        if (!postId || !username) {
            return res.status(400).json({ message: 'Post ID and username are required' });
        }

        try {
            await connectToDatabase();

            const post = await Post.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            if (!post.likedBy.includes(username)) {
                post.likes += 1;
                post.likedBy.push(username); // Track who liked it
                await post.save();
            }

            res.status(200).json({
                message: 'Post liked successfully',
                likes: post.likes,
                dislikes: post.dislikes,
            });
        } catch (error) {
            console.error('Error liking post:', error);
            return res.status(500).json({ message: 'Error liking post', error: error.message });
        }
    }

    // Handle PUT requests for disliking a post
    else if (req.method === 'PUT' && req.query.action === 'dislike') {
        const { postId, username } = req.body;

        if (!postId || !username) {
            return res.status(400).json({ message: 'Post ID and username are required' });
        }

        try {
            await connectToDatabase();

            const post = await Post.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            if (!post.dislikedBy.includes(username)) {
                post.dislikes += 1;
                post.dislikedBy.push(username); // Track who disliked it
                await post.save();
            }

            res.status(200).json({
                message: 'Post disliked successfully',
                likes: post.likes,
                dislikes: post.dislikes,
            });
        } catch (error) {
            console.error('Error disliking post:', error);
            return res.status(500).json({ message: 'Error disliking post', error: error.message });
        }
    }

    // Method Not Allowed
    else {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
}


