// Read-only audit: understand what migrating CTU1's archived animals to CTU8 involves,
// before running migrate-ctu1-archived-to-ctu8-2026-08-10.js.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const admin = await User.findOne({ id_public: 'CTU1' }).select('_id id_public ownedAnimals').lean();
    const target = await User.findOne({ id_public: 'CTU8' }).select('_id id_public ownedAnimals').lean();
    if (!admin) throw new Error('CTU1 user not found');
    if (!target) throw new Error('CTU8 user not found');
    console.log(`CTU1 _id=${admin._id} ownedAnimals.length=${admin.ownedAnimals.length}`);
    console.log(`CTU8 _id=${target._id} ownedAnimals.length=${target.ownedAnimals.length}\n`);

    // All animals currently owned (creatorId) by CTU1, archived or not
    const allOwned = await Animal.find({ creatorId: admin._id }).select('id_public name archived originalCreatorId creatorId_public').lean();
    const archivedOwned = allOwned.filter(a => a.archived);
    const nonArchivedOwned = allOwned.filter(a => !a.archived);
    console.log(`Total animals with creatorId = CTU1: ${allOwned.length}`);
    console.log(`  archived: ${archivedOwned.length}`);
    console.log(`  NOT archived: ${nonArchivedOwned.length}`);
    if (nonArchivedOwned.length) {
        console.log('  Non-archived ones (would remain if we only migrate archived):');
        nonArchivedOwned.forEach(a => console.log(`    - ${a.id_public} ${a.name}`));
    }

    // Among archived-owned, how many have originalCreatorId set, and to whom
    const withOriginal = archivedOwned.filter(a => a.originalCreatorId);
    console.log(`\nArchived animals with originalCreatorId set: ${withOriginal.length}`);
    for (const a of withOriginal) {
        const orig = await User.findById(a.originalCreatorId).select('id_public').lean();
        console.log(`  - ${a.id_public} ${a.name} originalCreatorId -> ${orig ? orig.id_public : '(missing user)'} (${a.originalCreatorId})`);
    }

    // Any animals where originalCreatorId points at CTU1 (regardless of current owner/archived)
    const originalIsAdmin = await Animal.find({ originalCreatorId: admin._id }).select('id_public name archived creatorId_public').lean();
    console.log(`\nAnimals (any owner/archived state) where originalCreatorId = CTU1: ${originalIsAdmin.length}`);
    originalIsAdmin.forEach(a => console.log(`  - ${a.id_public} ${a.name} archived=${a.archived} currentOwner=${a.creatorId_public}`));

    // viewOnlyForUsers / hiddenForUsers references to CTU1
    const viewOnlyCount = await Animal.countDocuments({ viewOnlyForUsers: admin._id });
    const hiddenCount = await Animal.countDocuments({ hiddenForUsers: admin._id });
    console.log(`\nAnimals with CTU1 in viewOnlyForUsers: ${viewOnlyCount}`);
    console.log(`Animals with CTU1 in hiddenForUsers: ${hiddenCount}`);

    // PublicAnimal docs owned by CTU1
    const publicOwned = await PublicAnimal.find({ creatorId_public: 'CTU1' }).select('id_public name').lean();
    console.log(`\nPublicAnimal docs with creatorId_public = CTU1: ${publicOwned.length}`);
    publicOwned.forEach(a => console.log(`  - ${a.id_public} ${a.name}`));

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
