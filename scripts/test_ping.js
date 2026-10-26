const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

console.log('Step 1: env loaded');

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
}).then(async () => {
    console.log('Step 2: connected');
    
    const query = {
        species: 'Fancy Mouse',
        lifeStage: { $in: ['Unknown', ''] },
        birthDate: { $exists: true, $ne: null }
    };
    
    // Test skip at various positions
    console.log('Step 3: testing skip=0...');
    const a0 = await Animal.find(query).skip(0).limit(10).lean();
    console.log('skip=0 found:', a0.length);
    
    console.log('Step 4: testing skip=500...');
    const a500 = await Animal.find(query).skip(500).limit(10).lean();
    console.log('skip=500 found:', a500.length);
    
    console.log('Step 5: testing skip=1000...');
    const a1000 = await Animal.find(query).skip(1000).limit(10).lean();
    console.log('skip=1000 found:', a1000.length);
    
    console.log('All skip tests passed!');
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
