#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');
const { Animal } = require('../database/models');

console.log('Starting minimal migration...');
console.log('MONGODB_URI set:', !!process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('Connected!');
    
    // Just find 5 Fancy Mouse with Unknown lifeStage and birthDate
    return Animal.find({ species: 'Fancy Mouse', lifeStage: 'Unknown', birthDate: { $exists: true, $ne: null } })
      .limit(5)
      .lean();
  })
  .then(animals => {
    console.log('Found', animals.length, 'animals');
    animals.forEach((a, i) => {
      const stage = calculateLifeStageFromBirthDate(a.birthDate, a.species || 'Unknown');
      console.log(`Animal ${i}: id=${a.id_public}, birthDate=${a.birthDate}, currentStage=${a.lifeStage}, newStage=${stage}`);
    });
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
    process.exit(1);
  });