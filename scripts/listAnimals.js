// List all animals with their IDs
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function listAnimals() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    const animals = await Animal.find({}).select('id_public name species ownerId').sort({ id_public: 1 });
    
    console.log(`Found ${animals.length} animal(s):\n`);
    
    for (const animal of animals) {
      const owner = await User.findById(animal.ownerId).select('id_public');
      console.log(`${animal.id_public} - ${animal.name} (${animal.species}) - Owner: ${owner?.id_public}`);
    }

    // Extract numeric IDs
    const numericIds = animals
      .map(a => parseInt(a.id_public.replace('CTC', '')))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    console.log('\n───────────────────────────────────');
    console.log('Numeric IDs in use:', numericIds.join(', '));
    console.log('Highest ID:', Math.max(...numericIds));
    console.log('Expected next counter value:', Math.max(...numericIds));
    console.log('Next animal should be: CTC' + (Math.max(...numericIds) + 1));
    console.log('───────────────────────────────────\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

listAnimals();
