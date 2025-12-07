// List and clean up PublicProfiles
require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile, User } = require('../database/models');

async function cleanupPublicProfiles() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    // Get all public profiles
    const profiles = await PublicProfile.find({});
    console.log(`Found ${profiles.length} public profile(s):\n`);
    
    for (const profile of profiles) {
      // Check if corresponding user exists
      const user = await User.findById(profile.userId_backend);
      
      if (!user) {
        console.log(`❌ ORPHANED: ${profile.id_public} - ${profile.personalName} (${profile.breederName || 'no breeder name'})`);
        console.log(`   User ID ${profile.userId_backend} not found`);
        console.log(`   Deleting orphaned profile...`);
        await PublicProfile.deleteOne({ _id: profile._id });
        console.log(`   ✓ Deleted\n`);
      } else {
        console.log(`✓ VALID: ${profile.id_public} - ${profile.personalName} (${profile.breederName || 'no breeder name'})`);
        console.log(`   Linked to user: ${user.email}\n`);
      }
    }

    // Verify final state
    const remainingProfiles = await PublicProfile.find({});
    console.log('═══════════════════════════════════════');
    console.log(`Final count: ${remainingProfiles.length} public profile(s)`);
    console.log('═══════════════════════════════════════\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

cleanupPublicProfiles();
