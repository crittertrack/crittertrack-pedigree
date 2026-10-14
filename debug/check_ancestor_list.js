/**
 * Check a fixed list of animal NAMES for whether CTC922 ("Plume d'argent") sits anywhere
 * in their ancestry, and if so how many generations back plus the parent chain.
 *
 * Read-only - never writes. Uses the raw mongodb driver (no schema casting), matching
 * debug/find_ancestor_in_owned.js. Ancestry is followed through sireId_public / damId_public
 * only; retired free-text "manual pedigree" slots are NOT consulted (they were display-only,
 * never real ancestry edges).
 *
 * Like find_ancestor_in_owned.js, this searches BACKWARDS from the ancestor: one pass builds a
 * parent->children index, then a breadth-first walk down from CTC922 collects every descendant
 * plus its generation depth and the parent link it was discovered through (so the exact chain
 * can be reconstructed). O(V+E) regardless of pedigree depth, and it catches every path.
 * Requested animals are then looked up globally by name (not restricted to one owner), so
 * animals from any prefix/breeder are found. All name matches are reported, which guards
 * against duplicate names in the registry.
 *
 * Usage:
 *   node debug/check_ancestor_list.js
 *   node debug/check_ancestor_list.js --ancestor=CTC922
 *   node debug/check_ancestor_list.js --names="MM Mochi,DM Ditzy,CWR Carmino"
 *   node debug/check_ancestor_list.js --json
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const argv = process.argv.slice(2);
const opt = (n, d) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.split('=')[1] : d;
};
const flag = (n) => argv.includes(`--${n}`);

const TARGET = (opt('ancestor', 'CTC922')).toUpperCase();
const AS_JSON = flag('json');

// --names="A,B,C" overrides CHECK_NAMES with a comma-separated list (order preserved).
const NAMES_OVERRIDE = opt('names', null);
const NAMES = NAMES_OVERRIDE
    ? NAMES_OVERRIDE.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

// The animals to check, exactly as requested.
const CHECK_NAMES = [
    'DM Kristoffer',
    'DM Ditzy',
    'DM Simba',
    'DM Pootsie',
    'DM Caspian',
    'M3 Sora',
    'CWR Carmino',
    'CWR Madonna',
    'MM Milo',
    'CWR Fiero',
    'DM Merida',
    'MM Revvy',
    'MM Tipsy',
    'MM Mochi',
    'MM Savvy',
];

// Normalize for name comparison: lowercase, trim, collapse internal whitespace runs.
const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set (expected in crittertrack-pedigree/.env)');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || undefined);
    const animals = db.collection('animals');

    const target = await animals.findOne({ id_public: TARGET });
    if (!target) {
        console.error(`No animal found with id_public "${TARGET}".`);
        await client.close();
        process.exit(1);
    }

    // One pass over the collection: build the name index plus parent -> children edges.
    const byName = new Map(); // normalized name -> [id_public, ...]
    const childrenOf = new Map();
    let total = 0;
    const cursor = animals.find({}, {
        projection: {
            id_public: 1, name: 1, prefix: 1, suffix: 1, creatorId_public: 1,
            species: 1, gender: 1, birthDate: 1, isOwned: 1, archived: 1,
            sireId_public: 1, damId_public: 1,
        },
    });
    for await (const doc of cursor) {
        total++;
        for (const key of new Set([norm(doc.name), norm(`${doc.prefix || ''} ${doc.name || ''}`)])) {
            if (!key) continue;
            if (!byName.has(key)) byName.set(key, []);
            byName.get(key).push(doc.id_public);
        }
        if (doc.sireId_public) {
            if (!childrenOf.has(doc.sireId_public)) childrenOf.set(doc.sireId_public, []);
            childrenOf.get(doc.sireId_public).push(doc.id_public);
        }
        if (doc.damId_public) {
            if (!childrenOf.has(doc.damId_public)) childrenOf.set(doc.damId_public, []);
            childrenOf.get(doc.damId_public).push(doc.id_public);
        }
    }

    // Breadth-first downward from the ancestor. gen[id] = generations below TARGET;
    // via.get(id) = the parent id this descendant was first discovered through (shortest
    // chain in generation count; enough to reconstruct one true ancestry route).
    const gen = new Map([[TARGET, 0]]);
    const via = new Map();
    let frontier = [TARGET];
    while (frontier.length) {
        const next = [];
        for (const id of frontier) {
            for (const kid of childrenOf.get(id) || []) {
                if (gen.has(kid)) continue; // already seen - also guards pedigree cycles
                gen.set(kid, gen.get(id) + 1);
                via.set(kid, id);
                next.push(kid);
            }
        }
        frontier = next;
    }

    const docById = new Map();
    for await (const doc of animals.find({}, {
        projection: { id_public: 1, name: 1, prefix: 1, suffix: 1, creatorId_public: 1, gender: 1, birthDate: 1, isOwned: 1, archived: 1 },
    })) docById.set(doc.id_public, doc);

    const label = (a) => {
        if (!a) return '?';
        const nm = a.name || '(unnamed)';
        return a.prefix ? `${a.prefix} ${nm}${a.suffix ? ' ' + a.suffix : ''}` : nm;
    };

    // Walk the discovered-parent chain from a descendant up to TARGET.
    const chainToAncestor = (id) => {
        const chain = [];
        let cur = id;
        let guard = 0;
        while (cur && cur !== TARGET && guard++ < 10000) {
            chain.push(label(docById.get(cur)));
            cur = via.get(cur);
        }
        chain.push(`${TARGET} "${target.name}"`);
        return chain;
    };

    const checkNames = NAMES && NAMES.length ? NAMES : CHECK_NAMES;
    const results = checkNames.map((wanted) => {
        const ids = byName.get(norm(wanted)) || [];
        if (!ids.length) return { requested: wanted, found: false, matches: [] };
        const matches = ids.map((id) => {
            const a = docById.get(id);
            const depth = gen.has(id) ? gen.get(id) : null;
            return {
                id_public: id,
                name: label(a),
                gender: (a && a.gender) || '',
                birthDate: (a && a.birthDate) || null,
                owner: (a && a.creatorId_public) || '',
                isOwned: !a || a.isOwned !== false,
                archived: !!(a && a.archived),
                hasAncestor: depth !== null,
                generationsBack: depth,
                chain: depth !== null ? chainToAncestor(id) : null,
            };
        });
        return { requested: wanted, found: true, matches };
    });

    await client.close();

    if (AS_JSON) {
        console.log(JSON.stringify({
            ancestor: { id_public: TARGET, name: target.name, species: target.species, gender: target.gender, owner: target.creatorId_public },
            totalAnimalsInDb: total,
            totalDescendantsOfAncestor: gen.size - 1,
            results,
        }, null, 2));
        return;
    }

    console.log('='.repeat(78));
    console.log(`Ancestor: ${TARGET}  "${target.name}"  (${target.species}, ${target.gender})`);
    console.log(`Descendants of ${TARGET} in the database (all owners): ${gen.size - 1}`);
    console.log('='.repeat(78));

    let withAncestor = 0;
    for (const r of results) {
        if (!r.found) {
            console.log(`\n?  ${r.requested}  -- NO animal with this name found in the database`);
            continue;
        }
        for (const m of r.matches) {
            const dup = r.matches.length > 1 ? ' (duplicate name - all matches shown)' : '';
            if (m.hasAncestor) {
                withAncestor++;
                const back = m.generationsBack === 1
                    ? 'DIRECT PARENT (1 generation back)'
                    : `${m.generationsBack} generations back`;
                console.log(`\nYES  ${m.name}  [${m.id_public}]${dup}`);
                console.log(`     ${back} | ${m.gender || '?'}${m.birthDate ? ' | born ' + String(m.birthDate).slice(0, 10) : ''} | owner ${m.owner}`);
                console.log(`     chain: ${m.chain.join('  <-  ')}`);
            } else {
                console.log(`\nNO   ${m.name}  [${m.id_public}]${dup}`);
                console.log(`     ${m.gender || '?'} | owner ${m.owner} -- ${TARGET} is not in this animal's pedigree`);
            }
            if (m.archived) console.log('     (archived)');
            if (!m.isOwned) console.log('     (not currently owned)');
        }
    }

    console.log('\n' + '='.repeat(78));
    console.log(`${withAncestor} of ${checkNames.length} requested animals descend from ${TARGET} "${target.name}".`);
    console.log('='.repeat(78));
}

main().catch((e) => { console.error(e); process.exit(1); });


