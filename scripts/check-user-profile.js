const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Import models
const { User, PublicProfile } = require('../database/models');

async function checkUserProfile() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        const targetUserId = '6935d64d9a5a8b31e51a4826';
        
        console.log('\n=== Checking User ===');
        console.log('Target userId:', targetUserId);
        
        // Find user by _id
        const user = await User.findById(targetUserId);
        console.log('\nUser found:', user ? 'YES' : 'NO');
        if (user) {
            console.log('User details:');
            console.log('  _id:', user._id.toString());
            console.log('  id_public:', user.id_public);
            console.log('  email:', user.email);
            console.log('  personalName:', user.personalName);
            console.log('  breederName:', user.breederName);
        }
        
        // Find PublicProfile by userId_backend
        console.log('\n=== Checking PublicProfile ===');
        const profile = await PublicProfile.findOne({ userId_backend: targetUserId });
        console.log('PublicProfile found:', profile ? 'YES' : 'NO');
        if (profile) {
            console.log('Profile details:');
            console.log('  userId_backend:', profile.userId_backend.toString());
            console.log('  id_public:', profile.id_public);
            console.log('  personalName:', profile.personalName);
            console.log('  breederName:', profile.breederName);
        } else {
            console.log('\nTrying alternate lookup...');
            // Try finding with ObjectId
            const profileAlt = await PublicProfile.findOne({ userId_backend: new mongoose.Types.ObjectId(targetUserId) });
            console.log('PublicProfile found (ObjectId):', profileAlt ? 'YES' : 'NO');
            if (profileAlt) {
                console.log('Profile details:');
                console.log('  userId_backend:', profileAlt.userId_backend.toString());
                console.log('  id_public:', profileAlt.id_public);
            }
        }

        // List all PublicProfiles
        console.log('\n=== All PublicProfiles ===');
        const allProfiles = await PublicProfile.find({});
        console.log(`Total profiles: ${allProfiles.length}`);
        allProfiles.forEach(p => {
            console.log(`  ${p.id_public}: userId_backend=${p.userId_backend.toString()}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

checkUserProfile();
