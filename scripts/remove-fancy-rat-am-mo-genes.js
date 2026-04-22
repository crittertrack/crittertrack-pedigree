/**
 * One-time fix: remove Am (American Mink) and Mo (Mock Mink) genes
 * from the Fancy Rat document in MongoDB.
 *
 * Run with:  node scripts/remove-fancy-rat-am-mo-genes.js
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

    const toRemove = ['Am', 'Mo'];
    const found = toRemove.filter(sym => doc.genes.some(g => g.symbol === sym));

    if (found.length === 0) {
        console.log('Am and Mo genes not found — already removed.');
        await mongoose.disconnect();
        return;
    }

    found.forEach(sym => console.log(`Found gene: ${sym} — will remove.`));

    if (DRY_RUN) {
        console.log('[DRY RUN] Would pull Am and Mo from genes array.');
    } else {
        await GeneticsData.updateOne(
            { _id: new mongoose.Types.ObjectId(SPECIES_ID) },
            { $pull: { genes: { symbol: { $in: toRemove } } } }
        );
        console.log(`Removed ${found.join(', ')} from MongoDB.`);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
