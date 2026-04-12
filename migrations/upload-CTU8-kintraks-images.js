/**
 * Bulk-upload Kintraks images for CTU8 animals.
 *
 * Usage:
 *   DRY RUN:  node migrations/upload-CTU8-kintraks-images.js
 *   EXECUTE:  CONFIRM=true node migrations/upload-CTU8-kintraks-images.js
 *
 * Reads images from C:\Users\dbana\Documents\Kintraks\Pictures,
 * matches them to CTU8 animals by prefix+name, then uploads to R2
 * and sets imageUrl on both Animal and PublicAnimal.
 */
require('dotenv').config();
// Ensure uploader URL is set for local execution
if (!process.env.UPLOADER_URL && !process.env.PUBLIC_HOST) {
    process.env.UPLOADER_URL = 'https://uploads.crittertrack.net';
}
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Animal, PublicAnimal } = require('../database/models');
const { uploadBuffer } = require('../storage/r2_client');

const IMG_DIR = 'C:\\Users\\dbana\\Documents\\Kintraks\\Pictures';
const DRY_RUN = process.env.CONFIRM !== 'true';

function parseFilename(fn) {
    // Strip trailing (0).jpg or (0)[].jpg
    let base = fn.replace(/\(\d+\)(\[\])?\.\w+$/, '');
    // Strip litter code like (A9-F1) or (V5-M1) at end of name
    base = base.replace(/\s*\([A-Z0-9]+-[A-Z0-9]+\)\s*$/i, '');
    const idx = base.indexOf('_');
    if (idx === -1) return { prefix: null, name: base.replace(/`/g, "'").trim() };
    return { prefix: base.slice(0, idx).replace(/`/g, "'").trim(), name: base.slice(idx + 1).replace(/`/g, "'").trim() };
}

function normalize(s) {
    return (s || '').replace(/`/g, "'").toLowerCase().trim();
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '*** LIVE ***'}\n`);

    const files = fs.readdirSync(IMG_DIR).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    const animals = await Animal.find({ ownerId_public: 'CTU8' }).select('id_public name prefix imageUrl').lean();

    // Build lookup maps
    const byPrefixName = new Map();
    const byCompound = new Map();
    const byNameOnly = new Map();
    for (const a of animals) {
        const key = `${normalize(a.prefix)}|${normalize(a.name)}`;
        if (!byPrefixName.has(key)) byPrefixName.set(key, a);
        const compound = normalize([a.prefix, a.name].filter(Boolean).join(' '));
        if (!byCompound.has(compound)) byCompound.set(compound, a);
        const n = normalize(a.name);
        if (!byNameOnly.has(n)) byNameOnly.set(n, a);
    }

    const matched = [];
    const unmatched = [];
    const alreadyHasImage = [];

    for (const f of files) {
        const { prefix, name } = parseFilename(f);
        let match = byPrefixName.get(`${normalize(prefix)}|${normalize(name)}`);
        if (!match) match = byCompound.get(normalize([prefix, name].filter(Boolean).join(' ')));
        // Only fall back to name-only if the file has no prefix (avoid cross-breeder mismatches)
        if (!match && !prefix) match = byNameOnly.get(normalize(name));

        if (match) {
            if (match.imageUrl) {
                alreadyHasImage.push({ file: f, animal: match });
            } else {
                matched.push({ file: f, animal: match });
            }
        } else {
            unmatched.push({ file: f, prefix, name });
        }
    }

    console.log(`Files: ${files.length}`);
    console.log(`Matched (will upload): ${matched.length}`);
    console.log(`Already have image (skip): ${alreadyHasImage.length}`);
    console.log(`Unmatched (skip): ${unmatched.length}\n`);

    if (DRY_RUN) {
        console.log('=== Matched (first 20) ===');
        for (const m of matched.slice(0, 20)) {
            console.log(`  ${m.file} → ${m.animal.id_public} ${m.animal.prefix || ''} ${m.animal.name}`);
        }
        console.log('\n=== Unmatched (first 20) ===');
        for (const u of unmatched.slice(0, 20)) {
            console.log(`  ${u.file} → prefix="${u.prefix}" name="${u.name}"`);
        }
        console.log('\nRun with CONFIRM=true to upload images.');
        await mongoose.disconnect();
        return;
    }

    // Live mode: upload and update
    let uploaded = 0;
    let errors = 0;
    for (const m of matched) {
        try {
            const filePath = path.join(IMG_DIR, m.file);
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(m.file).toLowerCase();
            const mimeType = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] || 'image/jpeg';
            const key = `uploads/${Date.now()}-${m.animal.id_public}${ext}`;

            const url = await uploadBuffer(key, buffer, mimeType);

            await Animal.updateOne({ id_public: m.animal.id_public }, { $set: { imageUrl: url } });
            await PublicAnimal.updateOne({ id_public: m.animal.id_public }, { $set: { imageUrl: url } });

            uploaded++;
            if (uploaded % 25 === 0) console.log(`  Uploaded ${uploaded}/${matched.length}...`);
        } catch (err) {
            errors++;
            console.error(`  ERROR ${m.animal.id_public} (${m.file}): ${err.message}`);
        }
    }

    console.log(`\nDone! Uploaded: ${uploaded}, Errors: ${errors}`);
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
