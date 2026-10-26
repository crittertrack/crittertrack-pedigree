#!/usr/bin/env node
/** 
 * Batch migration - 50 animals at a time to avoid timeout.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');
const { Animal } = require('../database/models');

async function migrateBatch() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');

    const query = {
        species: 'Fancy Mouse',
        lifeStage: 'Unknown',
        birthDate: { $exists: true, $ne: null }
    };

    const animals = await Animal.find(query).limit(50).lean();
    console.log('Found', animals.length, 'animals');

    if (animals.length === 0) {
        console.log('No animals with valid birthDate. Checking for null birthDate...');
        const nullQuery = { species: 'Fancy Mouse', lifeStage: 'Unknown' };
        const nullAnimals = await Animal.find(nullQuery).limit(5).lean();
        for (const a of nullAnimals) {
            console.log(`  ${a.id_public}: birthDate=${a.birthDate}`);
        }
        await mongoose.disconnect();
        return;
    }

    let updated = 0;
    for (const a of animals) {
        if (a.birthDate == null || a.birthDate === undefined) continue;
        if (isNaN(new Date(a.birthDate))) continue;
        const stage = calculateLifeStageFromBirthDate(a.birthDate, a.species || 'Unknown');
        if (stage !== 'Unknown') {
            await Animal.updateOne({ _id: a._id }, { $set: { lifeStage: stage } });
            updated++;
        }
    }

    console.log('Updated:', updated, 'of', animals.length);
    await mongoose.disconnect();
    console.log('Disconnected.');
}

migrateBatch();