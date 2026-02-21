const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Only load .env file in development (Railway provides env vars natively)
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

app.get('/', (req, res) => {
    res.send('UnfollowTrack API is running... v2');
});

// Temporary debug endpoint - REMOVE AFTER TESTING
const DEPLOY_TIME = new Date().toISOString();
app.get('/debug', (req, res) => {
    const clientId = process.env.INSTAGRAM_CLIENT_ID || 'NOT SET';
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || 'NOT SET';
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'NOT SET';
    const mongoUri = process.env.MONGO_URI || 'NOT SET';

    res.json({
        DEPLOY_TIME: DEPLOY_TIME,
        INSTAGRAM_CLIENT_ID: clientId ? `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}` : 'NOT SET',
        INSTAGRAM_CLIENT_SECRET: clientSecret ? `${clientSecret.substring(0, 4)}...${clientSecret.substring(clientSecret.length - 4)} (length: ${clientSecret.length})` : 'NOT SET',
        INSTAGRAM_REDIRECT_URI: redirectUri,
        MONGO_URI: mongoUri ? `${mongoUri.substring(0, 20)}...` : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV || 'not set',
        PORT: process.env.PORT || 'not set',
    });
});

// Connect to Database
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('Database connection error:', err.message);
        // Exit process with failure
        process.exit(1);
    }
};

const PORT = process.env.PORT || 5000;

// Connect to DB first, then start server
connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
});
