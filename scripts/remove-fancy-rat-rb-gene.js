/**
 * One-time fix: remove the Rb (Russian Blue) gene entirely from the Fancy Rat document.
 * The Russian Blue phenotype label now belongs to the D locus (d/d).
 *
 * Run with:  node scripts/remove-fancy-rat-rb-gene.js
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

    const rbGene = doc.genes.find(g => g.symbol === 'Rb');
    if (!rbGene) {
        console.log('Rb gene not found — already removed.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Found Rb gene (_id: ${rbGene._id}). Will remove from genes array.`);

    if (DRY_RUN) {
        console.log('[DRY RUN] Would pull Rb gene from genes array.');
    } else {
        await GeneticsData.updateOne(
            { _id: new mongoose.Types.ObjectId(SPECIES_ID) },
            { $pull: { genes: { symbol: 'Rb' } } }
        );
        console.log('Rb gene removed from MongoDB.');
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
