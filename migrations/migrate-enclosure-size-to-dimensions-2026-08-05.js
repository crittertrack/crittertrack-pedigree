// Migration: parse legacy Enclosure.size free-text field into the structured
// `dimensions` { length, width, height, unit } system, then remove `size`.
//
// `size` values fall into 3 buckets:
//   1. Clean "L x W x D"-style strings (with or without inch-mark/L/W/D labels, or plain
//      "NxNxN(cm)") — parsed into dimensions.length/width/height with the correct unit.
//   2. Partial 2-number strings ("NxN") — parsed into length/width only, height left null.
//   3. Everything else (volume-based like "10 gallon"/"30L"/"90qt", qualitative like
//      "Large"/"XSmall", or a single ambiguous number like "24"/"8ft") — cannot be mapped to
//      length/width/height at all. To avoid losing this information, the original text is
//      appended to the enclosure's `notes` field as "[Legacy size] <value>" before `size` is
//      removed.
//
// Run with no args for a dry run (prints planned changes only). Pass --apply to write changes.

require('dotenv').config();
const mongoose = require('mongoose');

function parseSize(raw, existingUnit) {
    const str = String(raw).trim();
    const unit = /cm/i.test(str) ? 'cm' : (/["]|in\b|inch/i.test(str) ? 'in' : null);
    const numbers = (str.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    const hasMultiplySeparator = /x/i.test(str);
    const fallbackUnit = (existingUnit === 'cm' || existingUnit === 'in') ? existingUnit : 'in';

    if (hasMultiplySeparator && numbers.length === 3) {
        return { length: numbers[0], width: numbers[1], height: numbers[2], unit: unit || fallbackUnit };
    }
    if (hasMultiplySeparator && numbers.length === 2) {
        return { length: numbers[0], width: numbers[1], height: null, unit: unit || fallbackUnit };
    }
    return null; // unparseable — volume-based, qualitative, or single ambiguous number
}

(async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.MONGODB_URI);
    const enclosures = mongoose.connection.db.collection('enclosures');

    const docs = await enclosures.find({ size: { $exists: true, $nin: [null, ''] } }).toArray();
    console.log(`Found ${docs.length} enclosures with a legacy size field. Mode: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

    let parsedCount = 0;
    let unparsedCount = 0;

    for (const doc of docs) {
        const parsed = parseSize(doc.size, doc.dimensions && doc.dimensions.unit);

        if (parsed) {
            parsedCount++;
            console.log(`[PARSED] "${doc.name}" size="${doc.size}" -> length=${parsed.length}, width=${parsed.width}, height=${parsed.height}, unit=${parsed.unit}`);
            if (apply) {
                await enclosures.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            'dimensions.length': parsed.length,
                            'dimensions.width': parsed.width,
                            'dimensions.height': parsed.height,
                            'dimensions.unit': parsed.unit
                        },
                        $unset: { size: '' }
                    }
                );
            }
        } else {
            unparsedCount++;
            const existingNotes = doc.notes || '';
            const newNotes = existingNotes
                ? `${existingNotes}\n[Legacy size] ${doc.size}`
                : `[Legacy size] ${doc.size}`;
            console.log(`[UNPARSEABLE - preserved in notes] "${doc.name}" size="${doc.size}"`);
            if (apply) {
                await enclosures.updateOne(
                    { _id: doc._id },
                    { $set: { notes: newNotes }, $unset: { size: '' } }
                );
            }
        }
    }

    console.log(`\nParsed into dimensions: ${parsedCount}`);
    console.log(`Preserved in notes (unparseable): ${unparsedCount}`);

    // Also clean up docs where `size` exists but is null/empty (old form default, no real data)
    const emptyFilter = { size: { $exists: true }, $or: [{ size: null }, { size: '' }] };
    const emptyCount = await enclosures.countDocuments(emptyFilter);
    console.log(`Empty/null size fields to unset: ${emptyCount}`);
    if (apply && emptyCount > 0) {
        const res = await enclosures.updateMany(emptyFilter, { $unset: { size: '' } });
        console.log(`Unset empty size from ${res.modifiedCount} docs`);
    }

    if (!apply) console.log('\nDry run only — re-run with --apply to write changes.');

    await mongoose.disconnect();
})();
