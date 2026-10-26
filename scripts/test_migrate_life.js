#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('Connected!'))
  .then(async () => {
    const count = await Animal.countDocuments({ species: 'Fancy Mouse', lifeStage: 'Unknown' });
    console.log('Fancy Mouse Unknown count:', count);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => { console.error('Error:', err); process.exit(1); });