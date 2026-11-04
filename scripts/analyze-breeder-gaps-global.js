/**
 * READ-ONLY, database-wide: find animals that look like they were bred by a user but do not have that
 * user recorded as breeder, regardless of who currently holds the record.
 *
 *   node scripts/analyze-breeder-gaps-global.js CTU2 MM
 *
 * An animal is "yours" for this check if ANY of these is true:
 *   - its name prefix equals the given prefix (e.g. MM)
 *   - originalCreatorId is the user (the user created it, then transferred it away)
 *   - breederId_public is the user
 * Those that are held by someone else (creatorId != user) are the ones outside the normal CTU2 scope.
 * Writes nothing to the database. Detail goes to breeder-gap-global.json.
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
    const prefix = (process.argv[3] || '').trim();
    if (!target) throw new Error('Usage: node scripts/analyze-breeder-gaps-global.js <user id, e.g. CTU2> [prefix, e.g. MM]');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined.');
    await connectDB(process.env.MONGODB_URI);

    const users = await User.find({}).select('_id id_public personalName breederName').lean();
    const user = users.find(u => norm(u.id_public) === norm(target));
    if (!user) throw new Error(`No user found with public id ${target}`);
    const userById = new Map(users.map(u => [String(u._id), u]));
    const label = (id) => { const u = userById.get(String(id)); return u ? `${u.id_public} ${u.breederName || u.personalName || ''}`.trim() : String(id); };

    const or = [{ originalCreatorId: user._id }, { breederId_public: user.id_public }];
    if (prefix) or.push({ prefix: new RegExp('^\\s*' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i') });

    const found = await Animal.find({ $or: or })
        .select('id_public name prefix suffix species status archived creatorId creatorId_public originalCreatorId breederId_public manualBreederName ownerId_public manualownerName')
        .lean();

    const mineBreeder = (a) => norm(a.breederId_public) === norm(user.id_public);
    const state = (a) => mineBreeder(a) ? 'me' : a.breederId_public ? 'other-user' : (a.manualBreederName || '').trim() ? 'manual-only' : 'none';
    const heldBy = (a) => String(a.creatorId) === String(user._id) ? 'me' : 'other';

    const rows = found.map(a => ({
        id: a.id_public, name: [a.prefix, a.name, a.suffix].filter(Boolean).join(' '), species: a.species || '', status: a.status || '',
        archived: !!a.archived, heldBy: heldBy(a), holder: label(a.creatorId), originalCreator: a.originalCreatorId ? label(a.originalCreatorId) : null,
        prefix: (a.prefix || '').trim(), breederId_public: a.breederId_public || null, manualBreederName: (a.manualBreederName || '').trim() || null,
        state: state(a),
    }));

    const count = (arr, f) => arr.reduce((m, r) => { const k = f(r) || '(none)'; m[k] = (m[k] || 0) + 1; return m; }, {});
    const outside = rows.filter(r => r.heldBy === 'other');
    const gaps = outside.filter(r => r.state !== 'me');

    console.log(`User ${user.id_public} (${user.breederName || user.personalName})  prefix filter: ${prefix || '(none)'}`);
    console.log(`Candidate animals database-wide: ${rows.length}`);
    console.log('  held by you   :', count(rows.filter(r => r.heldBy === 'me'), r => r.state));
    console.log('  held by others:', count(outside, r => r.state));
    console.log(`\nOUTSIDE your account: ${outside.length} animals, of which ${gaps.length} do NOT have you as breeder`);
    console.log('  by current holder:', count(outside, r => r.holder));
    console.log('  gaps by holder   :', count(gaps, r => r.holder));
    console.log('  gaps by breeder state:', count(gaps, r => r.state));
    console.log('  gaps by why matched: prefix only=' + gaps.filter(r => !r.originalCreator && r.prefix.toUpperCase() === prefix.toUpperCase()).length +
        ', original creator=' + gaps.filter(r => r.originalCreator).length);

    console.log('\nGap detail (first 40):');
    gaps.slice(0, 40).forEach(r => console.log(`  ${r.id.padEnd(9)} ${r.name.slice(0, 30).padEnd(31)} ${r.status.padEnd(9)} held by ${r.holder.slice(0, 26).padEnd(27)} breeder: ${r.breederId_public || r.manualBreederName || '(none)'}`));

    fs.writeFileSync(path.join(__dirname, 'breeder-gap-global.json'), JSON.stringify({ user: user.id_public, prefix, generatedAt: new Date().toISOString(), rows }, null, 2));
    console.log('\nDetail written to scripts/breeder-gap-global.json');
    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('FAILED:', err.message);
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    process.exit(1);
});
