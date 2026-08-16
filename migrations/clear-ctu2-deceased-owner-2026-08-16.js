require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal } = require('../database/models');

// Clear manualownerName on CTU2's own Deceased animals — a deceased animal has no
// current keeper, so a leftover owner name (e.g. from a prior transfer/manual entry)
// is stale.
const APPLY = process.argv.includes('--apply');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu2User = await User.findOne({ id_public: 'CTU2' }).select('_id').lean();
    if (!ctu2User) {
        console.error('CTU2 user not found.');
        await mongoose.disconnect();
        return;
    }

    const animals = await Animal.find({
        creatorId: ctu2User._id,
        status: 'Deceased',
        manualownerName: { $nin: [null, ''] },
    }).select('id_public name manualownerName').lean();

    console.log('Animals to clear:', animals.length);
    animals.forEach(a => console.log(`  ${a.id_public} - ${a.name} (was "${a.manualownerName}")`));

    if (APPLY && animals.length > 0) {
        const result = await Animal.updateMany(
            { _id: { $in: animals.map(a => a._id) } },
            { $set: { manualownerName: null } }
        );
        console.log('Modified count:', result.modifiedCount);
    } else if (!APPLY) {
        console.log('Dry run only — pass --apply to write changes.');
    }

    await mongoose.disconnect();
})();
