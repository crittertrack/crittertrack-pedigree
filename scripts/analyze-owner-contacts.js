/**
 * READ-ONLY analysis: for every animal of one user (archived included), how is the owner recorded?
 *
 *   node scripts/analyze-owner-contacts.js CTU2
 *
 * Buckets (an animal lands in exactly one, first match wins):
 *   linked-contact  - assigned to a Contact as keeper/both (contact.assignedAnimals), OR its
 *                     ownerId_public equals a Contact's linkedCTUID
 *   linked-user     - ownerId_public set, but no Contact matches it
 *   manual-only     - manualownerName set, nothing linking it to a Contact or user
 *   no-owner        - no ownerId_public, no manualownerName, no Contact assignment
 *
 * Writes nothing to the database. Full per-animal detail goes to owner-contact-analysis.json.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('../database/db_service');
const { Animal, User } = require('../database/models');
const Contact = require('../database/contactModel');

const norm = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const displayName = (a) => [a.prefix, a.name, a.suffix].filter(Boolean).join(' ') || '(unnamed)';

(async () => {
    const target = process.argv[2];
    if (!target) throw new Error('Usage: node scripts/analyze-owner-contacts.js <user public id, e.g. CTU2>');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined.');
    await connectDB(process.env.MONGODB_URI);

    const users = await User.find({}).select('_id id_public personalName breederName').lean();
    const user = users.find(u => norm(u.id_public) === norm(target));
    if (!user) throw new Error(`No user found with public id ${target}`);
    console.log(`User ${user.id_public} (${user.breederName || user.personalName || 'no name'})`);

    // Archived animals are deliberately included (no archived filter).
    const animals = await Animal.find({ creatorId: user._id })
        .select('id_public name prefix suffix species status archived ownerId_public manualownerName isOwned soldStatus')
        .lean();
    const contacts = await Contact.find({ userId: user._id }).lean();

    const contactName = (c) => c.personalName || c.breederName || '(unnamed contact)';
    const contactByCtuid = new Map();
    contacts.forEach(c => { if (c.linkedCTUID) contactByCtuid.set(norm(c.linkedCTUID), c); });

    // animal id_public -> contacts holding it as keeper/both
    const assignedOwner = new Map();
    contacts.forEach(c => (c.assignedAnimals || []).forEach(a => {
        if (a.role === 'keeper' || a.role === 'both') {
            if (!assignedOwner.has(a.animalId_public)) assignedOwner.set(a.animalId_public, []);
            assignedOwner.get(a.animalId_public).push(c);
        }
    }));

    const buckets = { 'linked-contact': [], 'linked-user': [], 'manual-only': [], 'no-owner': [] };
    for (const a of animals) {
        const viaAssign = assignedOwner.get(a.id_public) || [];
        const viaCtuid = a.ownerId_public ? contactByCtuid.get(norm(a.ownerId_public)) : null;
        const manual = (a.manualownerName || '').trim();
        const row = {
            id: a.id_public, name: displayName(a), species: a.species || '', status: a.status || '',
            archived: !!a.archived, ownerId_public: a.ownerId_public || null, manualownerName: manual || null,
            contacts: [...new Set([...viaAssign, ...(viaCtuid ? [viaCtuid] : [])].map(contactName))],
            ownerFieldAlsoSet: !!(a.ownerId_public || manual),
        };
        if (viaAssign.length || viaCtuid) buckets['linked-contact'].push(row);
        else if (a.ownerId_public) buckets['linked-user'].push(row);
        else if (manual) buckets['manual-only'].push(row);
        else buckets['no-owner'].push(row);
    }

    const archivedCount = animals.filter(a => a.archived).length;
    console.log(`\nAnimals analysed: ${animals.length} (archived: ${archivedCount}, active: ${animals.length - archivedCount})`);
    console.log(`Contacts for this user: ${contacts.length}\n`);
    Object.entries(buckets).forEach(([k, v]) => console.log(`  ${k.padEnd(15)} ${v.length}`));

    const line = (r) => `  ${r.id.padEnd(10)} ${r.name.slice(0, 34).padEnd(34)} ${(r.species || '').slice(0, 16).padEnd(16)} ${(r.status || '-').slice(0, 10).padEnd(10)} ${r.archived ? 'ARCHIVED' : 'active  '}`;

    console.log('\n=== MANUAL ONLY (owner name typed in, not linked to a contact or user) ===');
    const byName = {};
    buckets['manual-only'].forEach(r => { (byName[r.manualownerName] = byName[r.manualownerName] || []).push(r); });
    Object.entries(byName).sort((a, b) => b[1].length - a[1].length).forEach(([name, rows]) => {
        console.log(`\n${name}  (${rows.length})`);
        rows.forEach(r => console.log(line(r)));
    });

    console.log('\n=== NO OWNER ENTRY (no owner id, no manual name, no contact assignment) ===');
    buckets['no-owner'].forEach(r => console.log(line(r)));

    const out = path.join(__dirname, 'owner-contact-analysis.json');
    fs.writeFileSync(out, JSON.stringify({ user: user.id_public, generatedAt: new Date().toISOString(), counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])), buckets }, null, 2));
    console.log(`\nFull detail written to ${out}`);

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('FAILED:', err.message);
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    process.exit(1);
});
