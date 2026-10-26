#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');
    
    // Count Fancy Mouse with Unknown lifeStage
    const unknownCount = await Animal.countDocuments({ species: 'Fancy Mouse', lifeStage: 'Unknown' });
    console.log('Fancy Mouse with lifeStage=Unknown:', unknownCount);
    
    // Count Fancy Mouse total
    const totalCount = await Animal.countDocuments({ species: 'Fancy Mouse' });
    console.log('Total Fancy Mouse:', totalCount);
    
    // Count with other lifeStages
    const knownCount = await Animal.countDocuments({ species: 'Fancy Mouse', lifeStage: { $ne: 'Unknown' } });
    console.log('Fancy Mouse with known lifeStage:', knownCount);
    
    // Check distributions
    const stages = await Animal.aggregate([
        { $match: { species: 'Fancy Mouse' } },
        { $group: { _id: '$lifeStage', count: { $sum: 1 } } }
    ]);
    console.log('LifeStage distribution for Fancy Mouse:');
    stages.forEach(s => console.log(`  ${s._id || 'Unknown'}: ${s.count}`));
    
    await mongoose.disconnect();
}

test();