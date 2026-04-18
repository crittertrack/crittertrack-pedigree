/**
 * count-breeding-lines-users.js
 * Reports how many users have the breeding lines feature active (i.e. have defined
 * at least one breeding line definition on their profile).
 * Run with: node scripts/count-breeding-lines-users.js
 */
const mongoose = require('mongoose');
require('dotenv').config();
const { User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Users with at least one breedingLineDef
    const totalWithLines = await User.countDocuments({
        breedingLineDefs: { $exists: true, $not: { $size: 0 } }
    });

    // Users with at least one animal assigned to a line (animalBreedingLines not empty obj)
    const totalWithAssignments = await User.countDocuments({
        $and: [
            { animalBreedingLines: { $exists: true } },
            { animalBreedingLines: { $ne: {} } },
            { animalBreedingLines: { $ne: null } }
        ]
    });

    // Get the detail breakdown - how many lines each user has
    const breakdown = await User.aggregate([
        { $match: { breedingLineDefs: { $exists: true, $not: { $size: 0 } } } },
        {
            $project: {
                id_public: 1,
                personalName: 1,
                breederName: 1,
                lineCount: { $size: '$breedingLineDefs' }
            }
        },
        { $sort: { lineCount: -1 } }
    ]);

    console.log(`Users with ≥1 breeding line defined:    ${totalWithLines}`);
    console.log(`Users with animals assigned to lines:   ${totalWithAssignments}`);
    console.log(`\nBreakdown by user:`);
    breakdown.forEach(u => {
        const name = u.breederName || u.personalName || u.id_public || '(unknown)';
        console.log(`  ${(u.id_public || '').padEnd(8)} ${name.padEnd(30)} ${u.lineCount} line(s)`);
    });

    console.log('\nDone.');
    await mongoose.disconnect();
})();
