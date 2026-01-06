require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

async function fetchAnimalNames() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    const animalIds = [
      'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564', 'CTC565',
      'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
    ];

    const animals = await Animal.find({
      id_public: { $in: animalIds }
    }).select('id_public name species gender');

    console.log('Transferred Animals:\n');
    console.log('ID\t\tName\t\t\tSpecies\t\tGender');
    console.log('='.repeat(80));
    
    animals.forEach(animal => {
      console.log(`${animal.id_public}\t\t${(animal.name || 'Unnamed').padEnd(20)}\t${(animal.species || '—').padEnd(8)}\t${animal.gender || '—'}`);
    });

    console.log('\nTotal: ' + animals.length + ' animals');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

fetchAnimalNames();
