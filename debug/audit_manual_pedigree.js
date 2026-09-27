/**
 * Audit animals for MANUAL PEDIGREE entries.
 *
 * "Manual pedigree" = free-text ancestor slots on an animal that are NOT linked to a
 * registered CritterTrack animal. `manualPedigree` (Animal schema, Mixed type) holds up to
 * 14 slots across 3 generations; a slot counts as MANUAL when it has real content but no
 * `ctcId` (i.e. the name/genetics were typed in by hand rather than picked from a real animal).
 *
 * Read-only — this script never writes. It talks to Mongo through the raw driver rather than
 * the Mongoose model so the `Mixed` field comes back exactly as stored, with no schema casting.
 *
 * Usage:
 *   node debug/audit_manual_pedigree.js
 *   node debug/audit_manual_pedigree.js --json
 *   node debug/audit_manual_pedigree.js --owner <creatorId>
 *   node debug/audit_manual_pedigree.js --limit 25
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

// Slot keys supported by the Pedigree tab form (mirrors MP_ALL_SLOTS in
// crittertrack-frontend/src/components/AnimalForm/AnimalFormModalV2.jsx) — the two apps are
// standalone and can't share an import, so keep the two lists in sync.
const PEDIGREE_SLOTS = [
    'sire', 'dam',
    'sireSire', 'sireDam', 'damSire', 'damDam',
    'sireSireSire', 'sireSireDam', 'sireDamSire', 'sireDamDam',
    'damSireSire', 'damSireDam', 'damDamSire', 'damDamDam',
];

// Friendly labels so the report reads like the UI instead of camelCase keys.
const SLOT_LABELS = {
    sire: 'Sire', dam: 'Dam',
    sireSire: "Sire's Sire", sireDam: "Sire's Dam",
    damSire: "Dam's Sire", damDam: "Dam's Dam",
    sireSireSire: "Sire's Sire's Sire", sireSireDam: "Sire's Sire's Dam",
    sireDamSire: "Sire's Dam's Sire", sireDamDam: "Sire's Dam's Dam",
    damSireSire: "Dam's Sire's Sire", damSireDam: "Dam's Sire's Dam",
    damDamSire: "Dam's Dam's Sire", damDamDam: "Dam's Dam's Dam",
};

// Generation-1 slots are the real parent relationship (they mirror sireId_public/damId_public).
const PARENT_SLOTS = { sire: 'sireId_public', dam: 'damId_public' };

// Mirrors mpHasSlotValue() in the frontend form: a slot counts as filled in when it has a
// ctcId OR any non-'mode' field carrying real (non-whitespace) content.
function slotHasValue(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.ctcId && String(entry.ctcId).trim()) return true;
    return Object.entries(entry).some(([k, v]) =>
        k !== 'mode' && v !== null && v !== undefined && String(v).trim() !== '');
}

// Only the fields worth showing in a report.
const REPORT_FIELDS = ['name', 'prefix', 'suffix', 'gender', 'birthDate', 'genCode', 'variety', 'breederName', 'notes'];

function describeEntry(entry) {
    const out = {};
    for (const f of REPORT_FIELDS) {
        const v = entry[f];
        if (v !== null && v !== undefined && String(v).trim()) out[f] = String(v).trim();
    }
    return out;
}

function parseArgs(argv) {
    const args = { json: false, owner: null, limit: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--json') args.json = true;
        else if (argv[i] === '--owner') args.owner = argv[++i] || null;
        else if (argv[i] === '--limit') args.limit = Number(argv[++i]) || null;
    }
    return args;
}

const animalName = (a) => {
    const n = [a.prefix, a.name, a.suffix].filter(Boolean).join(' ').trim();
    return n || a.id_public;
};

module.exports = { PEDIGREE_SLOTS, SLOT_LABELS, PARENT_SLOTS, slotHasValue, describeEntry, parseArgs, animalName };

// Quick self-check of the classification helpers against realistic slot shapes.
// Run: node debug/audit_manual_pedigree.js --selftest
const assert = require('assert');

function selftest() {
    // A slot the form creates but the user never filled in: everything blank.
    const emptySlot = { mode: 'ctc', ctcId: '', prefix: '', name: '', suffix: '', variety: '', genCode: '', birthDate: '', breederName: '', gender: '', imageUrl: '', notes: '' };
    assert.strictEqual(slotHasValue(emptySlot), false, 'blank slot must not count as populated');
    assert.strictEqual(slotHasValue(null), false, 'null slot');
    assert.strictEqual(slotHasValue(undefined), false, 'undefined slot');
    assert.strictEqual(slotHasValue({}), false, 'empty object slot');

    // A slot linked to a registered animal.
    const linked = { mode: 'ctc', ctcId: 'CTC1234', prefix: 'MM', name: 'Whisker', suffix: '' };
    assert.strictEqual(slotHasValue(linked), true, 'linked slot counts as populated');

    // A hand-typed ancestor: no ctcId, but real content.
    const manual = { mode: 'ctc', ctcId: '', prefix: 'Old', name: 'Buck', gender: 'Male', genCode: 'ch/ch' };
    assert.strictEqual(slotHasValue(manual), true, 'hand-typed slot counts as populated');
    assert.deepStrictEqual(describeEntry(manual), { name: 'Buck', prefix: 'Old', gender: 'Male', genCode: 'ch/ch' });

    // Whitespace-only content must NOT count — otherwise every empty form slot would
    // register as a manual entry and the audit would be useless.
    const whitespace = { mode: 'ctc', ctcId: '', name: '   ', prefix: '\t', notes: '  ' };
    assert.strictEqual(slotHasValue(whitespace), false, 'whitespace-only slot is not populated');

    // describeEntry strips blanks out of the report.
    assert.deepStrictEqual(describeEntry(linked), { name: 'Whisker', prefix: 'MM' });

    // The slot list must match the frontend's MP_ALL_SLOTS exactly (14 slots).
    assert.strictEqual(PEDIGREE_SLOTS.length, 14, 'expected 14 pedigree slots');
    assert.strictEqual(new Set(PEDIGREE_SLOTS).size, 14, 'slot keys must be unique');
    PEDIGREE_SLOTS.forEach((s) => assert.ok(SLOT_LABELS[s], `missing label for slot ${s}`));

    // Only the two gen-1 slots are treated as canonical parents.
    assert.deepStrictEqual(Object.keys(PARENT_SLOTS), ['sire', 'dam']);

    // Arg parsing.
    assert.deepStrictEqual(parseArgs([]), { json: false, owner: null, limit: null });
    assert.deepStrictEqual(parseArgs(['--json', '--owner', 'abc', '--limit', '5']),
        { json: true, owner: 'abc', limit: 5 });

    console.log('selftest: all assertions passed');
}

const USAGE = `
Audit animals for MANUAL pedigree entries (free-text ancestors not linked to a
registered CritterTrack animal). Read-only — never writes.

Usage:
  node debug/audit_manual_pedigree.js [options]

Options:
  --json           Emit machine-readable JSON instead of the text report
  --owner <id>     Only scan animals owned by this creatorId
  --limit <n>      Stop after scanning n documents
  --selftest       Run the built-in assertion checks (no DB access)
  --help           Show this message

Note: manualPedigree is unindexed, so this is a collection scan and takes
roughly a minute on a few thousand animals. Progress is written to stderr.
`.trim();

if (require.main === module) {
    if (process.argv.includes('--selftest')) {
        selftest();
    } else if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log(USAGE);
    } else {
        runAudit().catch((err) => {
            console.error('audit_manual_pedigree failed:', err);
            process.exit(1);
        });
    }
}

module.exports.selftest = selftest;

async function runAudit() {
    const args = parseArgs(process.argv.slice(2));
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not defined — check crittertrack-pedigree/.env');
        process.exit(1);
    }

    // Bounded timeouts so the script fails fast and loudly instead of hanging forever when the
    // dev cluster is unreachable (mongodb defaults to a 30s server-selection wait).
    const client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
    });
    await client.connect();
    const animals = client.db().collection('animals');

    // Every document that has the field at all, so we can also report empty containers
    // ({} or null) separately from animals with genuinely hand-entered ancestors.
    const filter = { manualPedigree: { $exists: true } };
    if (args.owner) filter.creatorId = args.owner;

    // This is an unindexed COLLSCAN over every animal that has the field, so it takes a while
    // on a large collection. Stream progress to stderr so it's obvious the script is working
    // and not wedged on the network.
    console.error(`Scanning animals with a manualPedigree field (unindexed scan, please wait)...`);
    const t0 = Date.now();

    const summary = { totalManualSlots: 0, totalLinkedSlots: 0, emptyContainers: 0 };
    const animalsWithManual = [];
    const bySlot = Object.fromEntries(PEDIGREE_SLOTS.map((s) => [s, 0]));
    const conflicts = [];
    let scanned = 0;

    const cursor = animals.find(filter, {
        projection: {
            _id: 0, id_public: 1, name: 1, prefix: 1, suffix: 1, species: 1,
            creatorId: 1, sireId_public: 1, damId_public: 1, manualPedigree: 1,
        },
    });

    for await (const doc of cursor) {
        if (args.limit && scanned >= args.limit) break;
        scanned++;
        if (scanned % 1000 === 0) console.error(`  ...${scanned} scanned (${Math.round((Date.now() - t0) / 1000)}s)`);

        const mp = doc.manualPedigree;
        const isEmpty = !mp || typeof mp !== 'object' || Object.keys(mp).length === 0;
        if (isEmpty) { summary.emptyContainers++; continue; }

        const manualSlots = [];
        const linkedSlots = [];

        for (const slot of PEDIGREE_SLOTS) {
            const entry = mp[slot];
            if (!slotHasValue(entry)) continue;
            if (entry.ctcId && String(entry.ctcId).trim()) {
                linkedSlots.push({ slot, label: SLOT_LABELS[slot], ctcId: String(entry.ctcId).trim() });
                summary.totalLinkedSlots++;
            } else {
                manualSlots.push({ slot, label: SLOT_LABELS[slot], ...describeEntry(entry) });
                bySlot[slot]++;
                summary.totalManualSlots++;
            }
        }

        // Gen-1 drift: a sire/dam slot that disagrees with the canonical parent fields. Those
        // fields are what the Dashboard parent cards and COI maths actually use, so a mismatch
        // means the hand-typed ancestor is display-only and silently ignored elsewhere.
        for (const [slot, field] of Object.entries(PARENT_SLOTS)) {
            const entry = mp[slot];
            if (!slotHasValue(entry)) continue;
            const slotCtcId = (entry.ctcId && String(entry.ctcId).trim()) || null;
            const canonical = doc[field] || null;
            if (slotCtcId !== canonical) {
                conflicts.push({
                    id_public: doc.id_public,
                    name: doc.name,
                    slot,
                    label: SLOT_LABELS[slot],
                    manualSlotCtcId: slotCtcId,
                    canonicalField: field,
                    canonicalValue: canonical,
                    reason: slotCtcId
                        ? 'Pedigree slot points at a different animal than the canonical parent field'
                        : 'Hand-typed parent with no registered link (canonical field not set)',
                });
            }
        }

        if (manualSlots.length || linkedSlots.length) {
            animalsWithManual.push({ ...doc, manualPedigree: undefined, manualSlots, linkedSlots });
        }
    }
    console.error(`Scan complete: ${scanned} docs in ${Math.round((Date.now() - t0) / 1000)}s`);

    const withManualEntries = animalsWithManual.filter((a) => a.manualSlots.length > 0);
    const result = {
        summary: {
            documentsWithField: scanned,
            emptyContainers: summary.emptyContainers,
            animalsWithPedigreeData: animalsWithManual.length,
            animalsWithManualEntries: withManualEntries.length,
            totalManualSlots: summary.totalManualSlots,
            totalLinkedSlots: summary.totalLinkedSlots,
            manualSlotsBySlot: bySlot,
            conflicts: conflicts.length,
        },
        animals: withManualEntries,
        conflicts,
    };

    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
        await client.close();
        return;
    }

    const rep = result.summary;
    console.log('='.repeat(72));
    console.log('MANUAL PEDIGREE AUDIT');
    console.log('='.repeat(72));
    console.log(`Documents with manualPedigree field : ${rep.documentsWithField}`);
    console.log(`  empty (null / {})                 : ${rep.emptyContainers}`);
    console.log(`  with populated pedigree slots     : ${rep.animalsWithPedigreeData}`);
    console.log(`  with MANUAL (hand-typed) entries  : ${rep.animalsWithManualEntries}`);
    console.log(`  total manual slots                : ${rep.totalManualSlots}`);
    console.log(`  total linked (ctcId) slots        : ${rep.totalLinkedSlots}`);

    if (rep.totalManualSlots === 0) {
        console.log('\nNo manual pedigree entries found.');
    } else {
        console.log('\n--- Manual slots by position ---');
        for (const slot of PEDIGREE_SLOTS) {
            if (bySlot[slot] > 0) console.log(`  ${SLOT_LABELS[slot].padEnd(24)} ${bySlot[slot]}`);
        }

        console.log('\n--- Animals with manual entries ---');
        for (const a of withManualEntries) {
            console.log(`\n${a.id_public}  ${animalName(a)}${a.species ? `  (${a.species})` : ''}`);
            for (const s of a.manualSlots) {
                const detail = Object.entries(s)
                    .filter(([k]) => k !== 'slot' && k !== 'label')
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                console.log(`   - ${s.label}: ${detail || '(no printable fields)'}`);
            }
            if (a.linkedSlots.length) {
                const linked = a.linkedSlots.map((s) => `${s.label}->${s.ctcId}`).join(', ');
                console.log(`   (linked slots on same animal: ${linked})`);
            }
        }
    }

    if (conflicts.length) {
        console.log('\n--- Gen-1 parent mismatches ---');
        console.log('These animals have a sire/dam pedigree slot that disagrees with the canonical');
        console.log('sireId_public/damId_public fields used by parent cards and COI maths.\n');
        for (const c of conflicts) {
            console.log(`  ${c.id_public} ${c.name} — ${c.label}`);
            console.log(`     pedigree slot: ${c.manualSlotCtcId || '(hand-typed, no ctcId)'}`);
            console.log(`     ${c.canonicalField}: ${c.canonicalValue || '(not set)'}`);
        }
    }

    console.log('');
    await client.close();
}
