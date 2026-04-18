/**
 * count-breeding-lines-publicprofile.js
 */
const mongoose = require('mongoose');
require('dotenv').config();
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const withLines = await PublicProfile.countDocuments({
        breedingLineDefs: { $exists: true, $not: { $size: 0 } }
    });

    const breakdown = await PublicProfile.find(
        { breedingLineDefs: { $exists: true, $not: { $size: 0 } } },
        { id_public: 1, breederName: 1, personalName: 1, breedingLineDefs: 1, animalBreedingLines: 1 }
    ).lean();

    console.log('PublicProfiles with >=1 breeding line defined:', withLines);
    console.log('\nBreakdown:');
    breakdown.forEach(p => {
        const name = p.breederName || p.personalName || p.id_public;
        const assignedCount = p.animalBreedingLines ? Object.keys(p.animalBreedingLines).length : 0;
        console.log(`  ${(p.id_public || '').padEnd(8)} ${name.padEnd(30)} ${p.breedingLineDefs.length} line(s) [${p.breedingLineDefs.map(l => l.name).join(', ')}], ${assignedCount} animals assigned`);
    });

    console.log('\nDone.');
    await mongoose.disconnect();
})();
