// Sync PublicProfile with User data
require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile, User } = require('../database/models');

async function syncPublicProfile() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    // Get the user
    const user = await User.findOne({ email: 'crittertrackowner@gmail.com' });
    
    if (!user) {
      console.log('User not found!');
      mongoose.connection.close();
      return;
    }

    console.log('User found:');
    console.log('  Backend ID:', user._id);
    console.log('  Public ID:', user.id_public);
    console.log('  Email:', user.email);
    console.log('  Personal Name:', user.personalName);
    console.log('  Breeder Name:', user.breederName);
    console.log('  Show Breeder Name:', user.showBreederName);

    // Check public profile
    const profile = await PublicProfile.findOne({ userId_backend: user._id });
    
    if (!profile) {
      console.log('\n❌ No PublicProfile found for this user!');
      console.log('Creating new profile...');
      
      await PublicProfile.create({
        userId_backend: user._id,
        id_public: user.id_public,
        personalName: user.personalName,
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        showGeneticCodePublic: user.showGeneticCodePublic,
        showRemarksPublic: user.showRemarksPublic
      });
      
      console.log('✓ Created new PublicProfile');
    } else {
      console.log('\nCurrent PublicProfile:');
      console.log('  Public ID:', profile.id_public);
      console.log('  Personal Name:', profile.personalName);
      console.log('  Breeder Name:', profile.breederName);
      
      // Update if mismatched
      if (profile.id_public !== user.id_public) {
        console.log('\n⚠ ID mismatch! Updating...');
        profile.id_public = user.id_public;
        profile.personalName = user.personalName;
        profile.breederName = user.breederName;
        profile.showBreederName = user.showBreederName;
        await profile.save();
        console.log('✓ Updated PublicProfile to match User');
      } else {
        console.log('\n✓ PublicProfile is in sync');
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

syncPublicProfile();
