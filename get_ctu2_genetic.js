const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev';

mongoose.connect(MONGODB_URI);

const { Animal } = require('./database/models');

async function fetchCTU2FemaleAnimals() {
  try {
    const animals = await Animal.find({ 
      creatorId_public: 'CTU2', 
      gender: 'Female', 
      isOwned: true,
      species: 'Fancy Mouse'
    })
      .select('prefix name color coat markings geneticCode birthDate')
      .lean();
    
    console.log('Found ' + animals.length + ' female CTU2 Fancy Mouse animals with isOwned flag\n');
    
    console.log('| prefix/name | variety | genetic code | age |');
    console.log('|-------------|---------|--------------|-----|');
    
    animals.forEach(a => {
      const variety = [a.color, a.markings, a.coat].filter(Boolean).join(', ') || 'Unknown';
      
      let age = 'Unknown';
      if (a.birthDate) {
        const birth = new Date(a.birthDate);
        const today = new Date();
        const diffMs = today - birth;
        const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
        const months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
        const days = Math.floor((diffMs % (30.44 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        age = years + ' years ' + months + ' months ' + days + ' days';
      }
      
      console.log('| ' + (a.prefix || '') + '/' + a.name + ' | ' + variety + ' | ' + (a.geneticCode || 'N/A') + ' | ' + age + ' |');
    });
    
    console.log('\nTotal: ' + animals.length + ' animals');
    mongoose.disconnect();
  } catch (error) {
    console.error('Error: ' + error.message);
    mongoose.disconnect();
  }
}

fetchCTU2FemaleAnimals();