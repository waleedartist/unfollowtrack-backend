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
        // Step 1: Exchange code for access token via Facebook Graph API
        const tokenResponse = await axios.get(
            `https://graph.facebook.com/v21.0/oauth/access_token`, {
            params: {
                client_id: process.env.INSTAGRAM_CLIENT_ID,
                client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
                redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
                code,
            }
        }
        );

        const accessToken = tokenResponse.data.access_token;
        console.log('Step 1 OK: Got Facebook access token');

        // Step 2: Get user's Facebook Pages
        const pagesResponse = await axios.get(
            `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
        );
        console.log('Step 2 OK: Got pages:', pagesResponse.data.data?.length || 0);

        let instagramUserId = null;
        let igAccessToken = accessToken;
        let username = 'unknown';

        // Step 3: Find Instagram Business Account linked to a page
        if (pagesResponse.data.data && pagesResponse.data.data.length > 0) {
            for (const page of pagesResponse.data.data) {
                try {
                    const igResponse = await axios.get(
                        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
                    );

                    if (igResponse.data.instagram_business_account) {
                        instagramUserId = igResponse.data.instagram_business_account.id;
                        console.log('Step 3 OK: Found IG Business Account:', instagramUserId);

                        // Step 4: Get Instagram user details
                        const igUserResponse = await axios.get(
                            `https://graph.facebook.com/v21.0/${instagramUserId}?fields=id,username,profile_picture_url,followers_count,follows_count&access_token=${accessToken}`
                        );

                        username = igUserResponse.data.username || 'unknown';
                        console.log('Step 4 OK: Got IG profile:', username);

                        // Save/Update User
                        let user = await User.findOne({ instagramId: instagramUserId });
                        if (!user) {
                            user = new User({
                                instagramId: instagramUserId,
                                username,
                                accessToken: accessToken,
                                profilePicture: igUserResponse.data.profile_picture_url || '',
                                followersCount: igUserResponse.data.followers_count || 0,
                                followingCount: igUserResponse.data.follows_count || 0,
                            });
                        } else {
                            user.accessToken = accessToken;
                            user.username = username;
                            user.profilePicture = igUserResponse.data.profile_picture_url || user.profilePicture;
                            user.followersCount = igUserResponse.data.followers_count || user.followersCount;
                            user.followingCount = igUserResponse.data.follows_count || user.followingCount;
                        }
                        await user.save();
                        console.log('Step 5 OK: User saved to DB');

                        // Create JWT
                        const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '7d' });

                        // Show success page instead of redirecting to app scheme  
                        return res.send(`
                            <html>
                            <head><title>Login Successful</title></head>
                            <body style="font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: white;">
                                <h1>✅ Login Successful!</h1>
                                <p>Welcome, <strong>@${username}</strong>!</p>
                                <p>Followers: ${igUserResponse.data.followers_count || 0}</p>
                                <p>Following: ${igUserResponse.data.follows_count || 0}</p>
                                <p style="color: #00d4aa; margin-top: 30px;">Your account has been connected successfully.</p>
                                <p style="color: #888; font-size: 12px;">You can close this window.</p>
                            </body>
                            </html>
                        `);
                    }
                } catch (pageErr) {
                    console.log('Page', page.id, 'has no IG account, trying next...');
                }
            }
        }

        // If no Instagram Business Account found
        // Try to get basic Facebook profile info instead
        const fbProfile = await axios.get(
            `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
        );

        return res.send(`
            <html>
            <head><title>Login Partial</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: white;">
                <h1>⚠️ No Instagram Business Account Found</h1>
                <p>Hi ${fbProfile.data.name}, you logged in successfully but we couldn't find an Instagram Business Account linked to your Facebook Pages.</p>
                <p style="color: #ffa500;">Make sure you have:</p>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto; color: #ccc;">
                    <li>An Instagram Professional/Business account</li>
                    <li>Your Instagram account linked to a Facebook Page</li>
                </ul>
            </body>
            </html>
        `);

    } catch (err) {
        console.error('Callback Error:', err.response?.data || err.message);
        res.status(500).send(`
            <html>
            <head><title>Login Error</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: white;">
                <h1>❌ Authentication Error</h1>
                <p style="color: #ff6b6b;">${err.response?.data?.error?.message || err.message || 'Unknown error during authentication'}</p>
                <a href="/api/auth/instagram/login" style="color: #00d4aa;">Try Again</a>
            </body>
            </html>
        `);
    }
};

