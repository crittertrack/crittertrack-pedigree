require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicProfile } = require('../database/models');

// For animals CTU2 originally bred/owned and later transferred away (originalCreatorId
// stays CTU2 even across further hops — see transferRoutes.js accept handler), backfill
// manualownerName with the CURRENT owner's (creatorId) display name if it's not already
// set. Needed so the CTU2-only "owner" column on Archive cards shows who the animal was
// transferred to, for animals the recipient never manually assigned an owner name on.
const APPLY = process.argv.includes('--apply');

const resolveDisplayName = (profile) => (profile.showBreederName && profile.breederName)
    ? profile.breederName
    : (profile.showPersonalName && profile.personalName)
        ? profile.personalName
        : `User ${profile.id_public}`;

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu2User = await User.findOne({ id_public: 'CTU2' }).select('_id').lean();
    if (!ctu2User) {
        console.error('CTU2 user not found.');
        await mongoose.disconnect();
        return;
    }

    const animals = await Animal.find({
        originalCreatorId: ctu2User._id,
        creatorId: { $ne: ctu2User._id },
        $or: [{ manualownerName: null }, { manualownerName: '' }],
    }).select('id_public name creatorId').lean();

    const ownerIds = [...new Set(animals.map(a => a.creatorId.toString()))];
    const profiles = await PublicProfile.find({ userId_backend: { $in: ownerIds } })
        .select('userId_backend id_public personalName showPersonalName breederName showBreederName')
        .lean();
    const nameByOwnerId = {};
    profiles.forEach(p => { nameByOwnerId[p.userId_backend.toString()] = resolveDisplayName(p); });

    console.log('Animals to update:', animals.length);
    const ops = [];
    animals.forEach(a => {
        const ownerName = nameByOwnerId[a.creatorId.toString()];
        console.log(`  ${a.id_public} - ${a.name} -> "${ownerName || '(unresolved)'}"`);
        if (ownerName) {
            ops.push({
                updateOne: {
                    filter: { _id: a._id },
                    update: { $set: { manualownerName: ownerName } },
                },
            });
        }
    });

    if (APPLY && ops.length > 0) {
        const result = await Animal.bulkWrite(ops);
        console.log('Modified count:', result.modifiedCount);
    } else if (!APPLY) {
        console.log('Dry run only — pass --apply to write changes.');
    }

    await mongoose.disconnect();
})();
