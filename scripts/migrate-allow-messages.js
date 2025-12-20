/**
 * Migration script to enable allowMessages for all existing users
 * Run with: node scripts/migrate-allow-messages.js
 */

const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

async function migrateAllowMessages() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Update all Users where allowMessages is not set or is null
        const userResult = await User.updateMany(
            { allowMessages: { $in: [null, undefined, false] } },
            { allowMessages: true }
        );
        console.log(`Updated ${userResult.modifiedCount} User documents to enable allowMessages`);

        // Update all PublicProfiles where allowMessages is not set or is null
        const profileResult = await PublicProfile.updateMany(
            { allowMessages: { $in: [null, undefined, false] } },
            { allowMessages: true }
        );
        console.log(`Updated ${profileResult.modifiedCount} PublicProfile documents to enable allowMessages`);

        // Verify the updates
        const userCount = await User.countDocuments({ allowMessages: true });
        const profileCount = await PublicProfile.countDocuments({ allowMessages: true });
        console.log(`Verification: ${userCount} Users have allowMessages enabled`);
        console.log(`Verification: ${profileCount} PublicProfiles have allowMessages enabled`);

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateAllowMessages();
