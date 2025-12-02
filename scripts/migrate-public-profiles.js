// Migration script to update existing PublicProfile documents with personalName and showBreederName
const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

async function migratePublicProfiles() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Get all public profiles
        const publicProfiles = await PublicProfile.find({});
        console.log(`Found ${publicProfiles.length} public profiles to migrate`);

        let updated = 0;
        let failed = 0;

        for (const profile of publicProfiles) {
            try {
                // Get corresponding user
                const user = await User.findById(profile.userId_backend);
                
                if (!user) {
                    console.log(`Warning: No user found for public profile ${profile.id_public}`);
                    failed++;
                    continue;
                }

                // Update the public profile with missing fields
                await PublicProfile.updateOne(
                    { _id: profile._id },
                    {
                        personalName: user.personalName,
                        showBreederName: user.showBreederName || false,
                        // Also ensure breederName is set properly
                        breederName: user.breederName || null
                    }
                );

                updated++;
                console.log(`Updated profile ${profile.id_public} (${user.personalName})`);
            } catch (error) {
                console.error(`Error updating profile ${profile.id_public}:`, error.message);
                failed++;
            }
        }

        console.log(`\nMigration complete!`);
        console.log(`Updated: ${updated}`);
        console.log(`Failed: ${failed}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

migratePublicProfiles();
