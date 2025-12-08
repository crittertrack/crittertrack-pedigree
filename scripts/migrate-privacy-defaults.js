/**
 * Migration script to update privacy defaults for existing users
 * 
 * IMPORTANT: This script changes ALL users' showPersonalName from true to false.
 * Only run this if you want to apply the new privacy defaults (private by default)
 * to ALL existing users.
 * 
 * Users can still change their preferences after this migration by going to
 * their profile settings and checking the visibility options they want.
 * 
 * Run with: node scripts/migrate-privacy-defaults.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function migratePrivacyDefaults() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Get the User and PublicProfile models
        const User = mongoose.model('User');
        const PublicProfile = mongoose.model('PublicProfile');

        // Count how many users currently have showPersonalName: true
        const usersToUpdate = await User.countDocuments({ showPersonalName: true });
        const profilesToUpdate = await PublicProfile.countDocuments({ showPersonalName: true });
        
        console.log(`\n📊 Found ${usersToUpdate} users and ${profilesToUpdate} public profiles with showPersonalName: true`);
        console.log('⚠️  This will change them ALL to showPersonalName: false (private by default)\n');

        // Update User collection
        const userUpdateResult = await User.updateMany(
            { showPersonalName: true },
            { $set: { showPersonalName: false } }
        );
        console.log(`✅ Updated ${userUpdateResult.modifiedCount} users in User collection`);

        // Update PublicProfile collection
        const publicProfileUpdateResult = await PublicProfile.updateMany(
            { showPersonalName: true },
            { $set: { showPersonalName: false } }
        );
        console.log(`✅ Updated ${publicProfileUpdateResult.modifiedCount} profiles in PublicProfile collection`);

        console.log('\n🎉 Privacy defaults migration completed!');
        console.log('📝 Users can change their visibility preferences in Profile Settings.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the migration
migratePrivacyDefaults();
