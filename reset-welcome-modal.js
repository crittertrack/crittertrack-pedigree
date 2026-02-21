// Script to reset welcome modal for a specific user
// Usage: node reset-welcome-modal.js CTU8

require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('./database/models');

const userIdPublic = process.argv[2] || 'CTU8';

async function resetWelcomeModal() {
    try {
        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');

        // Find the user profile
        const userProfile = await PublicProfile.findOne({ id_public: userIdPublic });
        
        if (!userProfile) {
            console.error(`User profile not found for: ${userIdPublic}`);
            process.exit(1);
        }

        console.log(`Found user: ${userProfile.breederName || userProfile.personalName || userIdPublic}`);
        console.log(`Current hasSeenProfileSetupGuide: ${userProfile.hasSeenProfileSetupGuide}`);
        console.log(`Current hasSeenWelcomeBanner: ${userProfile.hasSeenWelcomeBanner}`);

        // Reset both welcome flags
        userProfile.hasSeenProfileSetupGuide = false;
        userProfile.hasSeenWelcomeBanner = false;
        
        await userProfile.save();

        console.log('\n✅ Successfully reset welcome modal flags!');
        console.log(`New hasSeenProfileSetupGuide: ${userProfile.hasSeenProfileSetupGuide}`);
        console.log(`New hasSeenWelcomeBanner: ${userProfile.hasSeenWelcomeBanner}`);

        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting welcome modal:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

resetWelcomeModal();
