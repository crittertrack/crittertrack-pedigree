/**
 * Migration: Delete all animals owned by CTU8 and reset the animalId counter
 * to the highest CTC ID still remaining in the database.
 *
 * Usage (dry-run):   node migrations/purge-CTU8-animals.js
 * Usage (execute):   node migrations/purge-CTU8-animals.js --execute
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, Counter } = require('../database/models');

const EXECUTE = process.argv.includes('--execute');
const TARGET_USER = 'CTU8';

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // ── 1. Find all animals owned by CTU8 ──────────────────────────────────
    const animals = await Animal.find({ ownerId_public: TARGET_USER })
        .select('id_public name birthDate species createdAt')
        .sort({ createdAt: 1 })
        .lean();

    const publicAnimals = await PublicAnimal.find({ ownerId_public: TARGET_USER })
        .select('id_public name')
        .lean();

    console.log(`Animals owned by ${TARGET_USER}: ${animals.length}`);
    console.log(`PublicAnimals owned by ${TARGET_USER}: ${publicAnimals.length}\n`);

    if (animals.length === 0) {
        console.log('Nothing to delete.');
        await mongoose.disconnect();
        return;
    }

    // Show first/last 5
    const showSample = (arr) => {
        const head = arr.slice(0, 5);
        const tail = arr.length > 10 ? arr.slice(-5) : arr.slice(5);
        head.forEach(a => console.log(`  ${a.id_public}  ${a.name}  ${(a.birthDate||'').toString().slice(0,10)}  ${a.species||''}`));
        if (arr.length > 10) {
            console.log(`  ... (${arr.length - 10} more) ...`);
            tail.forEach(a => console.log(`  ${a.id_public}  ${a.name}  ${(a.birthDate||'').toString().slice(0,10)}  ${a.species||''}`));
        } else {
            tail.forEach(a => console.log(`  ${a.id_public}  ${a.name}  ${(a.birthDate||'').toString().slice(0,10)}  ${a.species||''}`));
        }
    };
    showSample(animals);

    // ── 2. Determine what the counter should be reset to ───────────────────
    // After deletion, the highest remaining CTC number across ALL animals
    const ctaIds = await Animal.find({})
        .select('id_public')
        .lean();

    const ctu8Ids = new Set(animals.map(a => a.id_public));

    // Extract numeric part from CTC IDs (format: CTC1234 or CTC-format string)
    const remainingNums = ctaIds
        .filter(a => !ctu8Ids.has(a.id_public))
        .map(a => {
            const m = String(a.id_public).match(/^CTC(\d+)$/);
            return m ? parseInt(m[1], 10) : null;
        })
        .filter(n => n !== null);

    const currentCounter = await Counter.findById('animalId').lean();
    const currentSeq = currentCounter ? currentCounter.seq : 0;
    const newSeq = remainingNums.length > 0 ? Math.max(...remainingNums) : 1000;

    console.log(`\nCurrent animalId counter: ${currentSeq} (= CTC${currentSeq})`);
    console.log(`Highest remaining CTC after deletion: CTC${newSeq}`);
    console.log(`Counter will be reset to: ${newSeq}\n`);

    if (!EXECUTE) {
        console.log('DRY RUN — no changes made. Re-run with --execute to apply.\n');
        await mongoose.disconnect();
        return;
    }

    // ── 3. Delete ───────────────────────────────────────────────────────────
    const delResult = await Animal.deleteMany({ ownerId_public: TARGET_USER });
    console.log(`Deleted ${delResult.deletedCount} Animal documents`);

    const pubDelResult = await PublicAnimal.deleteMany({ ownerId_public: TARGET_USER });
    console.log(`Deleted ${pubDelResult.deletedCount} PublicAnimal documents`);

    // ── 4. Reset counter ────────────────────────────────────────────────────
    await Counter.findByIdAndUpdate(
        { _id: 'animalId' },
        { $set: { seq: newSeq } },
        { upsert: false }
    );
    console.log(`\nCounter 'animalId' reset to ${newSeq} (next animal will be CTC${newSeq + 1})`);

    console.log('\nDone.');
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
