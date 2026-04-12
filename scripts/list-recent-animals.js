// scripts/list-recent-animals.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

async function run() {
    const fs = require('fs');
    const path = require('path');
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
    await mongoose.connect(uri);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const animals = await Animal.find({ createdAt: { $gte: twoHoursAgo } })
        .sort({ createdAt: -1 })
        .select('id_public name createdAt isStub ownerId_public')
        .lean();
    const outPath = path.join(__dirname, '../recent-animals.txt');
    const lines = [`Found ${animals.length} animals created in the last 2 hours:`];
    animals.forEach(a => {
        lines.push(`${a.id_public} | ${a.name} | isStub: ${a.isStub ? 'Y' : 'N'} | owner: ${a.ownerId_public} | created: ${a.createdAt}`);
    });
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${animals.length} entries to recent-animals.txt`);
    await mongoose.disconnect();
}

if (require.main === module) run();
module.exports = { run };
