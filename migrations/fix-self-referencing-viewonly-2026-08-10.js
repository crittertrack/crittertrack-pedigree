// A new owner can never legitimately appear in their own animal.viewOnlyForUsers list.
// This happened when an animal cycled back to a previous owner through a normal (non-'return')
// forward transfer: the earlier hop had pushed that user into viewOnlyForUsers, and it was never
// cleaned up when they later became the owner again. Fixed going forward in transferRoutes.js's
// /accept route; this migration repairs the 3 animals already found corrupted this way.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const animals = await Animal.aggregate([
        { $match: { $expr: { $in: ['$creatorId', { $ifNull: ['$viewOnlyForUsers', []] }] } } },
        { $project: { id_public: 1, name: 1, creatorId: 1, creatorId_public: 1, viewOnlyForUsers: 1 } },
    ]);

    console.log(`Found ${animals.length} animal(s) with owner self-listed in viewOnlyForUsers.\n`);

    for (const a of animals) {
        const doc = await Animal.findById(a._id);
        const before = doc.viewOnlyForUsers.length;
        doc.viewOnlyForUsers = doc.viewOnlyForUsers.filter(vid => vid.toString() !== doc.creatorId.toString());
        console.log(`- ${a.id_public} (${a.name}) owner=${a.creatorId_public}: viewOnlyForUsers ${before} -> ${doc.viewOnlyForUsers.length}`);
        await doc.save();
    }

    console.log('\nDone.');
    await mongoose.disconnect();
})();
