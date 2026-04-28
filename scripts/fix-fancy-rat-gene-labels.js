/**
 * One-time fix: update Fancy Rat gene phenotype/carrier labels in MongoDB.
 *
 * Changes:
 *   D gene  — d/d phenotype "English Blue" → "Russian Blue"
 *             D/d carrier  "English Blue" → "Russian Blue"
 *   G gene  — g/g phenotype "Gray"         → "American Blue"
 *             G/g carrier  "Gray"          → "American Blue"
 *   Rb gene — rb/rb phenotype "Russian Blue" → null  (label now belongs to D locus)
 *             Rb/rb carrier "Russian Blue"  → null
 *
 * Run with:  node scripts/fix-fancy-rat-gene-labels.js
 * Add --dry-run to preview without saving.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIES_ID = '696ec4bea109a5ede2d93fa7';

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI);
    console.log('Connected to MongoDB');

    const GeneticsData = mongoose.model('GeneticsData', new mongoose.Schema({}, { strict: false }), 'geneticsdatas');
    const doc = await GeneticsData.findById(SPECIES_ID).lean();
    if (!doc) { console.error('Fancy Rat document not found'); process.exit(1); }

    const updates = {};

    // ---- D gene: d/d and D/d ----
    const dIdx = doc.genes.findIndex(g => g.symbol === 'D');
    if (dIdx === -1) { console.error('D gene not found'); process.exit(1); }
    doc.genes[dIdx].combinations.forEach((c, ci) => {
        if (c.notation === 'd/d' && c.phenotype === 'English Blue') {
            updates[`genes.${dIdx}.combinations.${ci}.phenotype`] = 'Russian Blue';
            console.log(`  D: d/d phenotype "English Blue" → "Russian Blue"`);
        }
        if (c.notation === 'D/d' && c.carrier === 'English Blue') {
            updates[`genes.${dIdx}.combinations.${ci}.carrier`] = 'Russian Blue';
            console.log(`  D: D/d carrier "English Blue" → "Russian Blue"`);
        }
    });

    // ---- G gene: g/g and G/g ----
    const gIdx = doc.genes.findIndex(g => g.symbol === 'G');
    if (gIdx === -1) { console.error('G gene not found'); process.exit(1); }
    doc.genes[gIdx].combinations.forEach((c, ci) => {
        if (c.notation === 'g/g' && c.phenotype === 'Gray') {
            updates[`genes.${gIdx}.combinations.${ci}.phenotype`] = 'American Blue';
            console.log(`  G: g/g phenotype "Gray" → "American Blue"`);
        }
        if (c.notation === 'G/g' && c.carrier === 'Gray') {
            updates[`genes.${gIdx}.combinations.${ci}.carrier`] = 'American Blue';
            console.log(`  G: G/g carrier "Gray" → "American Blue"`);
        }
    });

    // ---- Rb gene: rb/rb and Rb/rb ----
    const rbIdx = doc.genes.findIndex(g => g.symbol === 'Rb');
    if (rbIdx === -1) { console.error('Rb gene not found'); process.exit(1); }
    doc.genes[rbIdx].combinations.forEach((c, ci) => {
        if (c.notation === 'rb/rb' && c.phenotype === 'Russian Blue') {
            updates[`genes.${rbIdx}.combinations.${ci}.phenotype`] = null;
            console.log(`  Rb: rb/rb phenotype "Russian Blue" → null`);
        }
        if (c.notation === 'Rb/rb' && c.carrier === 'Russian Blue') {
            updates[`genes.${rbIdx}.combinations.${ci}.carrier`] = null;
            console.log(`  Rb: Rb/rb carrier "Russian Blue" → null`);
        }
    });

    if (Object.keys(updates).length === 0) {
        console.log('Nothing to update — labels may already be correct.');
        await mongoose.disconnect();
        return;
    }

    if (DRY_RUN) {
        console.log('\n[DRY RUN] Would apply:', JSON.stringify(updates, null, 2));
    } else {
        await GeneticsData.updateOne({ _id: new mongoose.Types.ObjectId(SPECIES_ID) }, { $set: updates });
        console.log(`\nApplied ${Object.keys(updates).length} update(s) to MongoDB.`);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
