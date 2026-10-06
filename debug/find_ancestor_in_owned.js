/**
 * Find which of a user's animals have a given ancestor anywhere in their pedigree, and how many
 * generations back that ancestor sits.
 *
 * Read-only - this script never writes. It talks to Mongo through the raw driver rather than the
 * Mongoose model, matching debug/audit_manual_pedigree.js, so results come back exactly as
 * stored with no schema casting.
 *
 * Ancestry is followed through sireId_public / damId_public only - the canonical parent links.
 * The retired free-text "manual pedigree" slots are deliberately NOT consulted: they were
 * display-only, never fed the parent cards or COI, so they are not real ancestry edges.
 *
 * WHY IT SEARCHES BACKWARDS FROM THE ANCESTOR instead of upward from each animal: these lineages
 * run 20+ generations deep, and walking upward from each of ~100 animals is exponential in depth
 * (2^20 paths per animal). Instead we build a parent->children index in one pass, breadth-first
 * walk DOWN from the target ancestor to collect every descendant plus its generation, then
 * intersect with the owner's animals. O(V+E) no matter how deep, and it catches every path.
 *
 * Usage:
 *   node debug/find_ancestor_in_owned.js                    # CTU2's animals vs CTC922
 *   node debug/find_ancestor_in_owned.js --owner=CTU5 --ancestor=CTC1234
 *   node debug/find_ancestor_in_owned.js --owned-only       # only currently-owned, non-archived
 *   node debug/find_ancestor_in_owned.js --json
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const argv = process.argv.slice(2);
const opt = (n, d) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.split('=')[1] : d;
};
const flag = (n) => argv.includes(`--${n}`);

const OWNER = (opt('owner', 'CTU2')).toUpperCase();
const TARGET = (opt('ancestor', 'CTC922')).toUpperCase();
const OWNED_ONLY = flag('owned-only');
const AS_JSON = flag('json');

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
    const users = db.collection('users');

    const user = await users.findOne({ id_public: OWNER });
    if (!user) {
        console.error(`No user found with id_public "${OWNER}".`);
        await client.close();
        process.exit(1);
    }

    const target = await animals.findOne({ id_public: TARGET });
    if (!target) {
        console.error(`No animal found with id_public "${TARGET}".`);
        await client.close();
        process.exit(1);
    }

    // The owner's animals (any species). --owned-only narrows to currently-owned, non-archived.
    const ownerQuery = { creatorId: user._id };
    if (OWNED_ONLY) { ownerQuery.isOwned = true; ownerQuery.archived = { $ne: true }; }
    const mine = await animals.find(ownerQuery, {
        projection: {
            id_public: 1, name: 1, prefix: 1, suffix: 1, variety: 1, species: 1,
            gender: 1, birthDate: 1, isOwned: 1, archived: 1,
        },
    }).toArray();
    const mineById = new Map(mine.map((a) => [a.id_public, a]));

    // One pass over the collection builds parent -> children, which is what the downward BFS
    // needs. Only the two parent fields are read, so this stays cheap.
    const childrenOf = new Map();
    const cursor = animals.find({}, { projection: { id_public: 1, sireId_public: 1, damId_public: 1 } });
    for await (const doc of cursor) {
        if (doc.sireId_public) {
            if (!childrenOf.has(doc.sireId_public)) childrenOf.set(doc.sireId_public, []);
            childrenOf.get(doc.sireId_public).push(doc.id_public);
        }
        if (doc.damId_public) {
            if (!childrenOf.has(doc.damId_public)) childrenOf.set(doc.damId_public, []);
            childrenOf.get(doc.damId_public).push(doc.id_public);
        }
    }

    // Breadth-first downward from the ancestor. gen[id] = generations below TARGET.
    const gen = new Map([[TARGET, 0]]);
    let frontier = [TARGET];
    while (frontier.length) {
        const next = [];
        for (const id of frontier) {
            for (const kid of childrenOf.get(id) || []) {
                if (gen.has(kid)) continue; // already seen - also guards pedigree cycles
                gen.set(kid, gen.get(id) + 1);
                next.push(kid);
            }
        }
        frontier = next;
    }

    const label = (a) => {
        if (!a) return '?';
        const nm = a.name || '(unnamed)';
        return a.prefix ? `${a.prefix} ${nm}${a.suffix ? ' ' + a.suffix : ''}` : nm;
    };

    const matches = mine
        .filter((a) => gen.has(a.id_public) && a.id_public !== TARGET)
        .map((a) => ({
            id_public: a.id_public,
            name: label(a),
            variety: a.variety || '',
            species: a.species || '',
            gender: a.gender || '',
            birthDate: a.birthDate || null,
            isOwned: a.isOwned !== false,
            archived: !!a.archived,
            generationsBack: gen.get(a.id_public),
        }))
        .sort((a, b) => a.generationsBack - b.generationsBack || a.name.localeCompare(b.name));

    await client.close();

    if (AS_JSON) {
        console.log(JSON.stringify({
            owner: OWNER,
            ancestor: { id_public: TARGET, name: target.name, species: target.species, gender: target.gender, owner: target.creatorId_public },
            totalDescendantsInDb: gen.size - 1,
            ownerAnimalCount: mine.length,
            matches,
        }, null, 2));
        return;
    }

    console.log('='.repeat(78));
    console.log(`Ancestor: ${TARGET}  "${target.name}"  (${target.species}, ${target.gender}, owned by ${target.creatorId_public})`);
    console.log(`Owner:    ${OWNER}`);
    console.log(`${OWNED_ONLY ? 'Currently-owned, non-archived' : 'All'} animals for ${OWNER}: ${mine.length}`);
    console.log(`Total descendants of ${TARGET} in the database: ${gen.size - 1}`);
    console.log('='.repeat(78));

    if (!matches.length) {
        console.log(`\nNone of ${OWNER}'s animals have ${TARGET} in their pedigree.`);
        return;
    }

    const females = matches.filter((m) => /female/i.test(m.gender || ''));
    console.log(`\n${matches.length} of ${OWNER}'s animals descend from ${TARGET}`);
    console.log(`(${females.length} female, ${matches.length - females.length} male/unknown)\n`);
    for (const m of matches) {
        const back = m.generationsBack === 1 ? 'direct parent' : `${m.generationsBack - 1} generation(s) back`;
        console.log(`  ${m.id_public.padEnd(9)} ${m.name}${m.variety ? ' > ' + m.variety : ''}`);
        console.log(`            ${m.species} | ${m.gender || '?'}${m.birthDate ? ' | born ' + String(m.birthDate).slice(0, 10) : ''} | ${back}`);
        if (m.archived) console.log('            (archived)');
        if (!m.isOwned) console.log('            (not currently owned)');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });