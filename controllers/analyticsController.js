const axios = require('axios');
const User = require('../models/User');

exports.syncFollowers = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // 1. Fetch current followers from Instagram Graph API
        // Note: In a real app, you'd handle pagination for large lists.
        // Instagram Graph API for Business/Creator accounts provides this data.
        const response = await axios.get(
            `https://graph.instagram.com/me/followers?access_token=${user.accessToken}`
        );

        const currentFollowerIds = response.data.data.map(f => f.id);

        // 2. Smart Diff Algorithm
        const oldFollowers = new Set(user.followers);
        const newFollowers = new Set(currentFollowerIds);

        const gained = currentFollowerIds.filter(id => !oldFollowers.has(id));
        const lost = user.followers.filter(id => !newFollowers.has(id));

        // 3. Update User Data
        user.followers = currentFollowerIds;
        user.followerCount = currentFollowerIds.length;
        user.lastSync = Date.now();

        // 4. Record history if there are changes
        if (gained.length > 0 || lost.length > 0) {
            user.history.unshift({
                followerCount: user.followerCount,
                gained,
                lost,
            });
            // Keep only last 50 history entries
            if (user.history.length > 50) user.history.pop();
        }

        await user.save();

        res.json({
            followerCount: user.followerCount,
            gainedCount: gained.length,
            lostCount: lost.length,
            lastSync: user.lastSync,
        });
    } catch (err) {
        console.error('Sync Error:', err.response?.data || err.message);
        res.status(500).send('Server Error during follower sync');
    }
};

exports.getAnalyticsSummary = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('followerCount followingCount history lastSync');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server Error fetching analytics');
    }
};
