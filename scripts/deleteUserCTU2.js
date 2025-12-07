// Script to delete user CTU2 (Admin Debug Breeder)
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicProfile } = require('../database/models');

async function deleteUser() {
  try {
    // Connect using Railway environment variable if available, otherwise use .env
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully');

    // Find user CTU2
    const user = await User.findOne({ id_public: 'CTU2' });
    
    if (!user) {
      console.log('User CTU2 not found in database');
      mongoose.connection.close();
      return;
    }

    console.log('\nFound user to delete:');
    console.log('- Public ID:', user.id_public);
    console.log('- Email:', user.email);
    console.log('- Personal Name:', user.personalName);
    console.log('- Breeder Name:', user.breederName);
    console.log('- Backend ID:', user._id);

    // Find associated data
    const animalCount = await Animal.countDocuments({ ownerId: user._id });
    const publicProfile = await PublicProfile.findOne({ userId_backend: user._id });

    console.log('\nAssociated data:');
    console.log('- Animals owned:', animalCount);
    console.log('- Public profile exists:', !!publicProfile);

    // Delete in order: animals, public profile, then user
    console.log('\nDeleting associated data...');
    
    if (animalCount > 0) {
      const deletedAnimals = await Animal.deleteMany({ ownerId: user._id });
      console.log('✓ Deleted', deletedAnimals.deletedCount, 'animals');
    }

    if (publicProfile) {
      await PublicProfile.deleteOne({ userId_backend: user._id });
      console.log('✓ Deleted public profile');
    }

    // Finally delete the user
    await User.deleteOne({ _id: user._id });
    console.log('✓ Deleted user CTU2');

    console.log('\n✅ User CTU2 and all associated data successfully deleted');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

deleteUser();
