require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
const fs = require('fs');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const pets = await Animal.find({ ownerId_public: 'CTU8', status: 'Pet' })
        .select('id_public prefix name sireId_public damId_public')
        .sort({ name: 1 }).lean();

    // Collect all parent public IDs
    const parentPubIds = [...new Set([...pets.map(a => a.sireId_public), ...pets.map(a => a.damId_public)].filter(Boolean))];
    const parents = await Animal.find({ id_public: { $in: parentPubIds } }).select('id_public prefix name').lean();
    const parentMap = new Map(parents.map(p => [p.id_public, p]));

    const lines = [];
    lines.push('# CTU8 Pet Animals with Parents');
    lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`Total: ${pets.length} animals\n`);
    lines.push('| # | ID | Prefix | Name | Sire ID | Sire | Dam ID | Dam |');
    lines.push('|---|---|---|---|---|---|---|---|');
    
    let i = 0;
    for (const a of pets) {
        i++;
        const sire = a.sireId_public ? parentMap.get(a.sireId_public) : null;
        const dam = a.damId_public ? parentMap.get(a.damId_public) : null;
        const sName = sire ? [sire.prefix, sire.name].filter(Boolean).join(' ') : '—';
        const dName = dam ? [dam.prefix, dam.name].filter(Boolean).join(' ') : '—';
        lines.push(`| ${i} | ${a.id_public} | ${a.prefix || '—'} | ${a.name} | ${a.sireId_public || '—'} | ${sName} | ${a.damId_public || '—'} | ${dName} |`);
    }
    
    const withBoth = pets.filter(a => a.sireId_public && a.damId_public).length;
    const withOne = pets.filter(a => (a.sireId_public || a.damId_public) && !(a.sireId_public && a.damId_public)).length;
    const withNone = pets.filter(a => !a.sireId_public && !a.damId_public).length;
    lines.push(`\n## Summary`);
    lines.push(`- Both parents: ${withBoth}`);
    lines.push(`- One parent: ${withOne}`);
    lines.push(`- No parents: ${withNone}`);

    fs.writeFileSync('CTU8-pets-with-parents.md', lines.join('\n'));
    console.log(`Exported ${pets.length} Pet animals to CTU8-pets-with-parents.md`);
    mongoose.disconnect();
});
