// Migrates CTU1's (admin) archived animals to CTU8, and fixes originalCreatorId/viewOnlyForUsers
// provenance references so CTU1 has zero footprint left in the animals/publicanimals collections.
//
// 1. All 203 archived Animal docs with creatorId = CTU1 -> creatorId/creatorId_public = CTU8.
// 2. Matching PublicAnimal docs (creatorId_public = CTU1) -> creatorId_public = CTU8.
// 3. The 3 animals CTU1 originally bred and transferred away (now owned by CTU77) -
//    originalCreatorId CTU1 -> CTU8, and CTU1 -> CTU8 in viewOnlyForUsers.
// 4. User.ownedAnimals: pull migrated animal ids from CTU1, add to CTU8.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const admin = await User.findOne({ id_public: 'CTU1' }).select('_id id_public').lean();
    const target = await User.findOne({ id_public: 'CTU8' }).select('_id id_public').lean();
    if (!admin) throw new Error('CTU1 user not found');
    if (!target) throw new Error('CTU8 user not found');

    // 1. Archived animals owned by CTU1
    const archived = await Animal.find({ creatorId: admin._id, archived: true }).select('_id id_public').lean();
    const archivedIds = archived.map(a => a._id);
    const archivedPublicIds = archived.map(a => a.id_public);
    console.log(`Found ${archived.length} archived animals owned by CTU1.`);

    const r1 = await Animal.updateMany(
        { _id: { $in: archivedIds } },
        { $set: { creatorId: target._id, creatorId_public: 'CTU8' } }
    );
    console.log(`Animal.creatorId CTU1 -> CTU8: modified ${r1.modifiedCount} of ${archived.length}`);

    const r2 = await PublicAnimal.updateMany(
        { id_public: { $in: archivedPublicIds } },
        { $set: { creatorId_public: 'CTU8' } }
    );
    console.log(`PublicAnimal.creatorId_public CTU1 -> CTU8: modified ${r2.modifiedCount}`);

    // 2. The 3 transferred-away animals: fix originalCreatorId + viewOnlyForUsers provenance
    const transferred = await Animal.find({ originalCreatorId: admin._id }).select('_id id_public').lean();
    const transferredIds = transferred.map(a => a._id);
    console.log(`\nFound ${transferred.length} animals with originalCreatorId = CTU1 (${transferred.map(a => a.id_public).join(', ')}).`);

    const r3 = await Animal.updateMany(
        { _id: { $in: transferredIds } },
        { $set: { originalCreatorId: target._id } }
    );
    console.log(`Animal.originalCreatorId CTU1 -> CTU8: modified ${r3.modifiedCount}`);

    const r4 = await Animal.updateMany(
        { viewOnlyForUsers: admin._id },
        { $pull: { viewOnlyForUsers: admin._id } }
    );
    const r5 = await Animal.updateMany(
        { _id: { $in: transferredIds } },
        { $addToSet: { viewOnlyForUsers: target._id } }
    );
    console.log(`Animal.viewOnlyForUsers: removed CTU1 from ${r4.modifiedCount}, added CTU8 to ${r5.modifiedCount}`);

    // 3. User.ownedAnimals bookkeeping
    const r6 = await User.updateOne(
        { _id: admin._id },
        { $pull: { ownedAnimals: { $in: [...archivedIds] } } }
    );
    const r7 = await User.updateOne(
        { _id: target._id },
        { $addToSet: { ownedAnimals: { $each: archivedIds } } }
    );
    console.log(`\nUser.ownedAnimals: CTU1 modified=${r6.modifiedCount}, CTU8 modified=${r7.modifiedCount}`);

    console.log('\nDone.');
    await mongoose.disconnect();
})().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
