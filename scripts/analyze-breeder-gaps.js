/**
 * READ-ONLY analysis: which of a user's animals have no breeder recorded?
 *
 *   node scripts/analyze-breeder-gaps.js CTU2
 *
 * For every animal (archived included) it checks breederId_public and manualBreederName and groups the
 * animals with NO breeder by name prefix, so a breeding prefix like "MM" stands out.
 * Writes nothing to the database. Detail goes to breeder-gap-analysis.json.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('../database/db_service');
const { Animal, User } = require('../database/models');

const norm = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

(async () => {
    const target = process.argv[2];
    if (!target) throw new Error('Usage: node scripts/analyze-breeder-gaps.js <user public id, e.g. CTU2>');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined.');
    await connectDB(process.env.MONGODB_URI);

    const users = await User.find({}).select('_id id_public personalName breederName').lean();
    const user = users.find(u => norm(u.id_public) === norm(target));
    if (!user) throw new Error(`No user found with public id ${target}`);

    const animals = await Animal.find({ creatorId: user._id })
        .select('id_public name prefix suffix species status archived breederId_public manualBreederName litterId birthDate')
        .lean();

    const hasLinked = (a) => !!a.breederId_public;
    const hasManual = (a) => !!(a.manualBreederName || '').trim();
    const mine = (a) => norm(a.breederId_public) === norm(user.id_public);

    const rows = animals.map(a => ({
        id: a.id_public, name: a.name || '', prefix: (a.prefix || '').trim(), suffix: (a.suffix || '').trim(),
        species: a.species || '', status: a.status || '', archived: !!a.archived,
        breederId_public: a.breederId_public || null, manualBreederName: (a.manualBreederName || '').trim() || null,
        hasLitter: !!a.litterId,
        state: mine(a) ? 'me' : hasLinked(a) ? 'other-user' : hasManual(a) ? 'manual-only' : 'none',
    }));

    const count = (arr, f) => arr.reduce((m, r) => { const k = f(r) || '(none)'; m[k] = (m[k] || 0) + 1; return m; }, {});
    console.log(`User ${user.id_public} (${user.breederName || user.personalName})`);
    console.log(`Animals: ${rows.length} (archived ${rows.filter(r => r.archived).length})\n`);
    console.log('Breeder state overall:', count(rows, r => r.state));

    const none = rows.filter(r => r.state === 'none');
    console.log(`\nNo breeder at all: ${none.length}`);
    console.log('  by prefix (top 15):');
    Object.entries(count(none, r => r.prefix)).sort((a, b) => b[1] - a[1]).slice(0, 15)
        .forEach(([k, v]) => console.log(`    ${String(k).padEnd(22)} ${v}`));
    console.log('  by status:', count(none, r => r.status));
    console.log('  in a litter:', none.filter(r => r.hasLitter).length);

    console.log('\nPrefix "MM":');
    const mm = rows.filter(r => r.prefix.toUpperCase() === 'MM');
    console.log(`  total ${mm.length}`, count(mm, r => r.state));
    console.log('  MM with no breeder, by archived:', count(mm.filter(r => r.state === 'none'), r => r.archived ? 'archived' : 'active'));
    const mm_other = mm.filter(r => r.state === 'other-user' || r.state === 'manual-only');
    console.log(`  MM with a DIFFERENT breeder (${mm_other.length}):`);
    mm_other.slice(0, 15).forEach(r => console.log(`    ${r.id.padEnd(9)} ${r.name.padEnd(28)} ${r.state.padEnd(12)} ${r.breederId_public || r.manualBreederName}`));

    fs.writeFileSync(path.join(__dirname, 'breeder-gap-analysis.json'), JSON.stringify({ user: user.id_public, generatedAt: new Date().toISOString(), rows }, null, 2));
    console.log('\nDetail written to scripts/breeder-gap-analysis.json');
    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('FAILED:', err.message);
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    process.exit(1);
});
