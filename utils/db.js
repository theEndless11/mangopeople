import mongoose from 'mongoose';

export const connectToDatabase = async () => {
    if (mongoose.connections[0].readyState) {
        return; // Use existing connection
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw new Error('MongoDB connection failed');
    }
};