/**
 * READ-ONLY analysis: for user CTU2, list isOwned animals that carry the E-locus
 * "e" allele (genotype E/e or e/e) in their own genetic code, OR that have a
 * possible E/e or e/e parent (sire or dam).
 *
 * Usage:
 *   node scripts/check-e-locus-ctu2.js [CTU2]
 *
 *   - Defaults to user public id "CTU2" when no argument is supplied.
 *   - Writes nothing to the database.
 *   - Detail is written to scripts/e-locus-check-CTU2.json.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('../database/db_service');
const { Animal, User } = require('../database/models');

const norm = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const DEFAULT_TARGET = 'CTU2';
const OUT_FILE = path.join(__dirname, `e-locus-check-${DEFAULT_TARGET}.json`);

// Return the E-locus token from a genetic code string, e.g. "E/e", "e/e", "E/-", "e/-".
// Genetic code format: space-separated tokens like "a/a B/B C/cch E/e go/go Re/re Sa/sa".
const getELocusToken = (code) => {
  if (!code) return null;
  const tokens = String(code).trim().split(/\s+/);
  for (const t of tokens) {
    const m = t.match(/^([A-Za-z]+)\/(.+)$/);
    if (m && m[1].toLowerCase() === 'e') {
      return t; // e.g. "E/e"
    }
  }
  return null;
};

// Analyse an E-locus token.
//  carriesE : true  = definitely carries at least one 'e' allele (E/e, e/e, e/-)
//             false = definitely does NOT carry 'e' (E/E)
//             null  = no E-locus recorded in the genetic code
//  unknown  : true if an allele is recorded as '-' (unknown), so carrier status is uncertain
const analyseELocus = (code) => {
  const token = getELocusToken(code);
  if (!token) return { token: null, carriesE: null, unknown: false };
  const alleles = token.split('/').slice(1); // drop the locus letter
  const carriesE = alleles.some((a) => a.toLowerCase() === 'e');
  const unknown = alleles.some((a) => a === '-');
  return { token, carriesE, unknown };
};

const describe = (info) => {
  if (!info || info.token === null) return '(no E-locus recorded)';
  if (info.carriesE === null) return `${info.token} (no E-locus)`;
  if (info.unknown) return `${info.token} (carrier status uncertain due to '-')`;
  return info.carriesE ? `${info.token} (CARRIES e)` : `${info.token} (clear)`;
};

(async () => {
    const target = process.argv[2] || DEFAULT_TARGET;
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined.');
    await connectDB(process.env.MONGODB_URI);

    const users = await User.find({}).select('_id id_public personalName breederName').lean();
    const user = users.find((u) => norm(u.id_public) === norm(target));
    if (!user) throw new Error(`No user found with public id ${target}`);

    // isOwned animals belonging to user CTU2 (archived included)
    const animals = await Animal.find({ creatorId: user._id, isOwned: true })
        .select('id_public name prefix suffix species status archived geneticCode sireId_public damId_public breederId_public creatorId_public')
        .lean();

    // Batch-fetch all referenced parents (sire + dam) in one query.
    const parentPublicIds = [...new Set(
        animals.flatMap((a) => [a.sireId_public, a.damId_public]).filter(Boolean)
    )];
    const parents = await Animal.find({ id_public: { $in: parentPublicIds } })
        .select('id_public name prefix suffix geneticCode')
        .lean();
    const parentById = {};
    parents.forEach((p) => { parentById[p.id_public] = p; });
    const rows = animals.map((a) => {
        const own = analyseELocus(a.geneticCode);
        const ownCarriesE = own.carriesE === true;

        const sire = a.sireId_public ? parentById[a.sireId_public] : null;
        const dam = a.damId_public ? parentById[a.damId_public] : null;
        const sireInfo = sire ? analyseELocus(sire.geneticCode) : null;
        const damInfo = dam ? analyseELocus(dam.geneticCode) : null;

        // A "possible E/e or e/e parent": parent exists in DB and definitely carries 'e'.
        const sireCarrier = sireInfo && sireInfo.carriesE === true;
        const damCarrier = damInfo && damInfo.carriesE === true;
        const hasCarrierParent = sireCarrier || damCarrier;

        const flagged = ownCarriesE || hasCarrierParent;

        return {
            id: a.id_public,
            name: a.name || '',
            prefix: (a.prefix || '').trim(),
            suffix: (a.suffix || '').trim(),
            species: a.species || '',
            status: a.status || '',
            archived: !!a.archived,
            breederId_public: a.breederId_public || null,
            creatorId_public: a.creatorId_public || null,
            geneticCode: a.geneticCode || null,
            ownELocus: describe(own),
            ownCarriesE,
            sireId_public: a.sireId_public || null,
            sire: sire ? `${sire.prefix || ''} ${sire.name || ''} (${sire.id_public})`.trim() : null,
            sireELocus: sireInfo ? describe(sireInfo) : '(not found / no code)',
            sireCarrier,
            damId_public: a.damId_public || null,
            dam: dam ? `${dam.prefix || ''} ${dam.name || ''} (${dam.id_public})`.trim() : null,
            damELocus: damInfo ? describe(damInfo) : '(not found / no code)',
            damCarrier,
            hasCarrierParent,
            flagged,
            reason: ownCarriesE
                ? 'own E-locus carries e'
                : hasCarrierParent
                    ? 'carrier parent (sire or dam)'
                    : '',
        };
    });

    const flagged = rows.filter((r) => r.flagged);
    const ownOnly = rows.filter((r) => r.ownCarriesE);
    const parentOnly = rows.filter((r) => !r.ownCarriesE && r.hasCarrierParent);

    console.log(`User ${user.id_public} (${user.breederName || user.personalName})`);
    console.log(`isOwned animals: ${rows.length} (archived ${rows.filter((r) => r.archived).length})\n`);

    console.log(`Flagged animals (own E/e or e/e, OR carrier parent): ${flagged.length}`);
    console.log(`  - own genetic code carries e (E/e or e/e): ${ownOnly.length}`);
    console.log(`  - carrier parent only (no own e, but sire/dam carries e): ${parentOnly.length}\n`);

    if (flagged.length) {
        console.log('--- Flagged animals ---');
        flagged.forEach((r) => {
            console.log(
                `${r.id.padEnd(8)} ${(r.prefix + ' ' + r.name).trim().padEnd(30)} ` +
                `${r.species.padEnd(14)} ${r.status.padEnd(10)} archived=${r.archived} | ` +
                `own E: ${r.ownELocus} | ` +
                `sire: ${r.sire || '-'} [${r.sireELocus}] | ` +
                `dam: ${r.dam || '-'} [${r.damELocus}] | ` +
                `reason: ${r.reason}`
            );
        });
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify({
        user: user.id_public,
        target,
        generatedAt: new Date().toISOString(),
        counts: { total: rows.length, flagged: flagged.length, ownCarriesE: ownOnly.length, carrierParentOnly: parentOnly.length },
        rows,
    }, null, 2));
    console.log(`\nDetail written to ${OUT_FILE}`);

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('FAILED:', err.message);
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    process.exit(1);
});

