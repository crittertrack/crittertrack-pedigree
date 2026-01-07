const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Import models
const { User, PublicProfile } = require('../database/models');

async function createMissingPublicProfiles() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        // Find all users
        const users = await User.find({});
        console.log(`Found ${users.length} users`);

        let created = 0;
        let existing = 0;

        for (const user of users) {
            // Check if PublicProfile exists
            const existingProfile = await PublicProfile.findOne({ userId_backend: user._id });

            if (!existingProfile) {
                console.log(`Creating PublicProfile for user ${user.id_public} (${user.email})`);
                
                const publicProfile = new PublicProfile({
                    userId_backend: user._id,
                    id_public: user.id_public,
                    personalName: user.personalName,
                    showPersonalName: user.showPersonalName !== undefined ? user.showPersonalName : true,
                    breederName: user.breederName,
                    showBreederName: user.showBreederName,
                    profileImage: user.profileImage,
                    createdAt: user.creationDate || new Date(),
                    email: user.email,
                    showEmailPublic: user.showEmailPublic || false,
                    websiteURL: user.websiteURL || null,
                    showWebsiteURL: user.showWebsiteURL || false,
                });
                
                await publicProfile.save();
                console.log(`  ✓ Created PublicProfile with id_public: ${publicProfile.id_public}`);
                created++;
            } else {
                existing++;
            }
        }

        console.log('\n=== Summary ===');
        console.log(`Total users: ${users.length}`);
        console.log(`Existing profiles: ${existing}`);
        console.log(`Created profiles: ${created}`);
        console.log('✓ Migration complete!');

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

createMissingPublicProfiles();
