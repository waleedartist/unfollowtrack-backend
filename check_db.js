const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if needed
require('dotenv').config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connection Successful!');
        
        const users = await User.find({});
        console.log(`\n📊 Found ${users.length} users in database:`);
        
        users.forEach(user => {
            console.log('-------------------');
            console.log(`ID: ${user._id}`);
            console.log(`Instagram ID: ${user.instagramId}`);
            console.log(`Username: ${user.username}`);
            // Add other fields you want to see here
        });
        
        if (users.length === 0) {
            console.log('No users found. Try logging in again to create a user.');
        }

    } catch (error) {
        console.error('❌ MongoDB Connection Failed:', error.message);
    } finally {
        mongoose.connection.close();
    }
};

checkDB();
