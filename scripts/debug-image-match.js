require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
const fs = require('fs');

const imgDir = 'C:\\Users\\dbana\\Documents\\Kintraks\\Pictures';
const files = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

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

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const animals = await Animal.find({ ownerId_public: 'CTU8' }).select('id_public name prefix').lean();
    
    // Build lookup maps
    const byPrefixName = new Map();
    const byCompound = new Map();
    const byNameOnly = new Map();
    for (const a of animals) {
        const key = `${normalize(a.prefix)}|${normalize(a.name)}`;
        byPrefixName.set(key, a);
        const compound = normalize([a.prefix, a.name].filter(Boolean).join(' '));
        byCompound.set(compound, a);
        const n = normalize(a.name);
        if (!byNameOnly.has(n)) byNameOnly.set(n, a);
    }
    
    const matched = [];
    const unmatched = [];
    for (const f of files) {
        const { prefix, name } = parseFilename(f);
        
        // Try prefix+name exact
        let match = byPrefixName.get(`${normalize(prefix)}|${normalize(name)}`);
        // Try compound
        if (!match) match = byCompound.get(normalize([prefix, name].filter(Boolean).join(' ')));
        // Try name-only
        if (!match) match = byNameOnly.get(normalize(name));
        
        if (match) {
            matched.push({ file: f, animal: match });
        } else {
            unmatched.push({ file: f, prefix, name });
        }
    }
    
    console.log(`Total: ${files.length} files, ${matched.length} matched, ${unmatched.length} unmatched`);
    console.log(`\nUnmatched (${unmatched.length}):`);
    for (const u of unmatched) {
        console.log(`  ${u.prefix || '?'} | ${u.name} — ${u.file}`);
    }
    mongoose.disconnect();
});
