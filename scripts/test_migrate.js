const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');
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
    
    const speciesCount = await Animal.countDocuments(query);
    console.log('Step 3: count =', speciesCount);
    
    const batchSize = 100;
    
    // Do 3 batches
    for (let batch = 0; batch < 3; batch++) {
        const skip = batch * batchSize;
        console.log(`Step 4: fetch batch skip=${skip}...`);
        const animals = await Animal.find(query).skip(skip).limit(batchSize).lean();
        console.log(`  Got ${animals.length} animals`);
        
        let updated = 0;
        for (const animal of animals) {
            const stage = calculateLifeStageFromBirthDate(animal.birthDate, animal.species || 'Unknown');
            if (stage !== 'Unknown') {
                updated++;
            }
        }
        console.log(`  Would update ${updated} animals`);
    }
    
    console.log('Done!');
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
