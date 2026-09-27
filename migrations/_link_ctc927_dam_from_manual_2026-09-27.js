/**
 * Promote CTC927's hand-typed Dam ("Choco Lady") into a real Animal record and link it.
 *
 * Why: manualPedigree.dam for CTC927 was a free-text entry (mode:'manual', no ctcId), so the
 * dam existed only as display text. The canonical parent field damId_public was null, meaning
 * the dam never fed the parent cards, the pedigree traversal, or the COI maths.
 *
 * The new animal is created under the CTU8 "Database - Backup Account" (as requested). NOTE
 * this means parent and child live in different accounts — intentional here, but it is why
 * this is a migration and not a normal in-app create.
 *
 * Everything is derived from the existing manual slot rather than hard-coded, so re-running
 * after an edit to the slot still produces the right record.
 *
 * Run:  node migrations/_link_ctc927_dam_from_manual_2026-09-27.js [--apply]
 *       (dry-run by default; pass --apply to write)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal, User, Counter } = require('../database/models');

const CHILD = 'CTC927';
const OWNER_ID_PUBLIC = 'CTU8';
const APPLY = process.argv.includes('--apply');

// Mirrors getNextSequence() in database/db_service.js so the ID can't collide with a
// concurrent in-app animal create.
async function allocateAnimalId() {
    const ret = await Counter.findByIdAndUpdate(
        { _id: 'animalId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return 'CTC' + ret.seq;
}

const fmt = (v) => (v === null || v === undefined || v === '' ? '(none)' : v);

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const child = await Animal.findOne({ id_public: CHILD }).lean();
    if (!child) throw new Error(`${CHILD} not found`);

    const slot = child.manualPedigree && child.manualPedigree.dam;
    if (!slot) throw new Error(`${CHILD} has no manualPedigree.dam slot`);
    if (slot.ctcId) throw new Error(`Slot is already linked (ctcId=${slot.ctcId}) - nothing to do`);

    const owner = await User.findOne({ id_public: OWNER_ID_PUBLIC }).select('_id id_public').lean();
    if (!owner) throw new Error(`Owner ${OWNER_ID_PUBLIC} not found`);

    // ---- Derive the new record from the slot + the child's own species ----
    const newAnimal = {
        creatorId: owner._id,
        creatorId_public: owner.id_public,
        species: child.species,                 // 'Fancy Mouse'
        name: slot.name,
        prefix: slot.prefix || '',              // slot had no prefix; kept faithful
        suffix: slot.suffix || '',
        // The slot sat in the Dam position and its sex field was blank; "Female" is an
        // inference, not stored data. Flip to 'Unknown' if you'd rather not assert it.
        gender: slot.gender || 'Female',
        birthDate: slot.birthDate ? new Date(slot.birthDate) : null,
        // Inferred: a mouse born 2013 is not a 'Pet' in 2026, and the child is already
        // marked 'Deceased'. No deceasedDate is known, so it is left null.
        status: 'Deceased',
        geneticCode: slot.genCode || null,
        color: slot.variety || null,             // slot's "variety" is the coat/colour text
        manualBreederName: slot.breederName || null,
        isOwned: true,
        isDisplay: false,                       // do not publish a new record publicly
        archived: false,
        imageUrl: slot.imageUrl || null,
        photoUrl: slot.imageUrl || null,
        measurementUnits: { weight: 'g', length: 'cm' },
    };

    console.log('='.repeat(70));
    console.log(APPLY ? 'APPLYING' : 'DRY RUN (pass --apply to write)');
    console.log('='.repeat(70));
    console.log(`Child   : ${CHILD} ${child.prefix} ${child.name}  (owner ${child.creatorId_public}, dam=${fmt(child.damId_public)})`);
    console.log(`Owner   : ${owner.id_public}`);
    console.log('\nNew animal to create:');
    Object.entries(newAnimal).forEach(([k, v]) => {
        console.log(`  ${k.padEnd(20)} ${v && v._id ? v : JSON.stringify(v)}`);
    });
    console.log('\nUpdates to ' + CHILD + ':');
    console.log(`  damId_public          : ${fmt(child.damId_public)}  ->  <new id>`);
    console.log(`  manualPedigree.dam    : mode 'manual' -> 'ctc', ctcId '' -> '<new id>'`);
    console.log(`  inbreedingCoefficient : ${fmt(child.inbreedingCoefficient)} -> null (forces recalc)`);

    if (!APPLY) {
        console.log('\nNo changes written.');
        await mongoose.disconnect();
        return;
    }

    const id_public = await allocateAnimalId();
    newAnimal.id_public = id_public;
    const created = await Animal.create(newAnimal);
    console.log(`\nCreated ${created.id_public} (${created._id})`);

    await Animal.updateOne({ id_public: CHILD }, {
        $set: {
            damId_public: created.id_public,
            // Flip the slot to a linked one and denormalize the real record's fields into it,
            // exactly as the Pedigree tab's CTC picker would have.
            'manualPedigree.dam': {
                mode: 'ctc',
                ctcId: created.id_public,
                prefix: created.prefix || '',
                name: created.name || '',
                suffix: created.suffix || '',
                variety: created.color || '',
                genCode: created.geneticCode || '',
                // created.birthDate is a JS Date; toISOString() keeps the YYYY-MM-DD shape the
                // Pedigree tab expects. String(date).slice(0,10) would yield "Tue Oct 01".
                birthDate: created.birthDate ? created.birthDate.toISOString().slice(0, 10) : '',
                breederName: created.manualBreederName || '',
                gender: created.gender || '',
                imageUrl: created.imageUrl || '',
                notes: slot.notes || '',
            },
            inbreedingCoefficient: null, // matches db_service.updateAnimal on parent change
        },
    });
    console.log(`Linked ${CHILD}.damId_public -> ${created.id_public}`);

    const after = await Animal.findOne({ id_public: CHILD })
        .select('id_public sireId_public damId_public inbreedingCoefficient manualPedigree.dam').lean();
    console.log(`\n--- ${CHILD} after ---`);
    console.log(JSON.stringify(after, null, 2));

    await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
