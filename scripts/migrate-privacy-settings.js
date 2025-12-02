/**
 * Migration script to sync privacy settings from User to PublicProfile
 * Run this once to update existing PublicProfile records with privacy settings
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

const UserSchema = new mongoose.Schema({
    id_public: Number,
    showGeneticCodePublic: { type: Boolean, default: false },
    showRemarksPublic: { type: Boolean, default: false },
});

const PublicProfileSchema = new mongoose.Schema({
    userId_backend: mongoose.Schema.Types.ObjectId,
    id_public: Number,
    showGeneticCodePublic: { type: Boolean, default: false },
    showRemarksPublic: { type: Boolean, default: false },
});

const User = mongoose.model('User', UserSchema, 'users');
const PublicProfile = mongoose.model('PublicProfile', PublicProfileSchema, 'publicprofiles');

async function migratePrivacySettings() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected successfully');

        // Get all users
        const users = await User.find({});
        console.log(`Found ${users.length} users to migrate`);

        let updated = 0;
        let failed = 0;

        for (const user of users) {
            try {
                const result = await PublicProfile.updateOne(
                    { userId_backend: user._id },
                    {
                        $set: {
                            showGeneticCodePublic: user.showGeneticCodePublic ?? false,
                            showRemarksPublic: user.showRemarksPublic ?? false,
                        }
                    }
                );

                if (result.matchedCount > 0) {
                    updated++;
                    console.log(`✓ Updated PublicProfile for user CT${user.id_public}`);
                } else {
                    console.log(`! No PublicProfile found for user CT${user.id_public}`);
                }
            } catch (error) {
                failed++;
                console.error(`✗ Failed to update user CT${user.id_public}:`, error.message);
            }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`Total users: ${users.length}`);
        console.log(`Successfully updated: ${updated}`);
        console.log(`Failed: ${failed}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

migratePrivacySettings();
