const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    instagramId: {
        type: String,
        required: true,
        unique: true,
    },
    username: {
        type: String,
        required: true,
    },
    accessToken: {
        type: String,
        required: true,
    },
    profilePicture: {
        type: String,
    },
    followerCount: {
        type: Number,
        default: 0,
    },
    followingCount: {
        type: Number,
        default: 0,
    },
    lastSync: {
        type: Date,
        default: Date.now,
    },
    // We store lists of IDs for diffing
    followers: [String],
    following: [String],
    // Analytics snapshots
    history: [
        {
            timestamp: { type: Date, default: Date.now },
            followerCount: Number,
            gained: [String],
            lost: [String],
        },
    ],
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
