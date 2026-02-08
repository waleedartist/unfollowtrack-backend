const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.instagramLoginRedirect = (req, res) => {
    // Use Facebook OAuth for Instagram Graph API (Business accounts)
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${process.env.INSTAGRAM_REDIRECT_URI}&scope=instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement&response_type=code`;
    console.log('---------------------------------------------------');
    console.log('DEBUG: Generated Auth URL:', authUrl);
    console.log('DEBUG: Expected Redirect URI:', process.env.INSTAGRAM_REDIRECT_URI);
    console.log('---------------------------------------------------');

    res.redirect(authUrl);
};

exports.instagramLogin = async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ msg: 'Auth code is required' });
    }

    try {
        // 1. Exchange code for short-lived access token
        const tokenResponse = await axios.post(
            'https://api.instagram.com/oauth/access_token',
            new URLSearchParams({
                client_id: process.env.INSTAGRAM_CLIENT_ID,
                client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
                code,
            })
        );

        const { access_token, user_id } = tokenResponse.data;

        // 2. Exchange for long-lived access token (60 days)
        const longLivedTokenResponse = await axios.get(
            `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${access_token}`
        );

        const longLivedAccessToken = longLivedTokenResponse.data.access_token;

        // 3. Get user profile details
        const userProfileResponse = await axios.get(
            `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${longLivedAccessToken}`
        );

        const { username } = userProfileResponse.data;

        // 4. Find or create user in DB
        let user = await User.findOne({ instagramId: user_id });

        if (!user) {
            user = new User({
                instagramId: user_id,
                username,
                accessToken: longLivedAccessToken,
            });
        } else {
            user.accessToken = longLivedAccessToken;
            user.username = username;
        }

        await user.save();

        // 5. Create JWT
        const payload = {
            user: {
                id: user.id,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, username: user.username } });
            }
        );
    } catch (err) {
        console.error('Auth Error:', err.response?.data || err.message);
        res.status(500).send('Server Error during authentication');
    }
};

exports.instagramCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Authentication failed: No code provided');
    }

    try {
        // Exchange code for short-lived access token
        const tokenResponse = await axios.post(
            'https://api.instagram.com/oauth/access_token',
            new URLSearchParams({
                client_id: process.env.INSTAGRAM_CLIENT_ID,
                client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
                code,
            })
        );

        const { access_token, user_id } = tokenResponse.data;

        // Get long-lived token
        const longLivedTokenResponse = await axios.get(
            `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${access_token}`
        );
        const longLivedAccessToken = longLivedTokenResponse.data.access_token;

        // Get profile
        const userProfileResponse = await axios.get(
            `https://graph.instagram.com/me?fields=id,username&access_token=${longLivedAccessToken}`
        );
        const { username } = userProfileResponse.data;

        // Save/Update User
        let user = await User.findOne({ instagramId: user_id });
        if (!user) {
            user = new User({ instagramId: user_id, username, accessToken: longLivedAccessToken });
        } else {
            user.accessToken = longLivedAccessToken;
            user.username = username;
        }
        await user.save();

        // Create JWT
        const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Redirect back to the mobile app
        // We use the custom scheme 'unfollowtrack://'
        res.redirect(`unfollowtrack://auth?token=${token}&username=${username}`);
    } catch (err) {
        console.error('Callback Error:', err.response?.data || err.message);
        res.status(500).send('Server Error during callback');
    }
};
