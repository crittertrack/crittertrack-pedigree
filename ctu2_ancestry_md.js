require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const col = db.collection('animals');

  const all = await col.find({}, { projection: { id_public: 1, name: 1, prefix: 1, suffix: 1, sireId_public: 1, damId_public: 1 } }).toArray();
  const byId = new Map(all.map(a => [a.id_public, a]));
  const owned = await col.find({ creatorId_public: 'CTU2', isOwned: true }, { projection: { id_public: 1, name: 1, prefix: 1, suffix: 1, sireId_public: 1, damId_public: 1 } }).toArray();

  const rootsOf = (id) => {
    const s = new Set();
    const st = [id];
    const seen = new Set();
    while (st.length) {
      const x = st.pop();
      const a = byId.get(x);
      if (!a) { s.add(x); continue; }
      const parents = [a.sireId_public, a.damId_public].filter(Boolean);
      if (parents.length === 0) { s.add(x); continue; }
      for (const p of parents) {
        if (!seen.has(p)) { seen.add(p); st.push(p); }
      }
    }
    // roots are those with no parents
    const roots = new Set();
    for (const id of seen) {
      const a = byId.get(id);
      if (!a || (![a.sireId_public, a.damId_public].filter(Boolean).length)) roots.add(id);
    }
    // also include starting if no parents
    const sa = byId.get(id);
    if (sa && ![sa.sireId_public, sa.damId_public].filter(Boolean).length) roots.add(id);
    return roots;
  };

  const allRootsCount = new Map();
  const ownedRoots = owned.map(o => {
    const a = byId.get(o.id_public);
    const hasParent = a && ([a.sireId_public, a.damId_public].filter(Boolean).some(p => byId.has(p)));
    if (!hasParent) return null;
    const roots = rootsOf(o.id_public);
    for (const r of roots) allRootsCount.set(r, (allRootsCount.get(r)||0)+1);
    return { o, roots };
  }).filter(Boolean);

  let md = `# CTU2 Per-Animal Ancestry\n\n`;
  for (const { o, roots } of ownedRoots.sort((a,b)=>a.o.id_public.localeCompare(b.o.id_public))) {
    const label = [o.prefix, o.name, o.suffix].filter(Boolean).join(' ');
    const common = [], other = [];
    for (const r of [...roots].sort()) {
      const a = byId.get(r);
      const l = a ? [a.prefix, a.name, a.suffix].filter(Boolean).join(' ') : r;
      if ((allRootsCount.get(r)||0) > 1) {
        const others = ownedRoots.filter(x => x.o.id_public !== o.id_public && x.roots.has(r)).map(x => {
          const lbl = [x.o.prefix, x.o.name, x.o.suffix].filter(Boolean).join(' ');
          return `${x.o.id_public} (${lbl})`;
        });
        common.push(`${r} (${l}) [also: ${others.join(', ')}]`);
      } else {
        other.push(`${r} (${l})`);
      }
    }
    md += `## ${o.id_public} — ${label}\n`;
    md += `Common founders: ${common.join(', ') || 'none'}\n`;
    md += `Other founders: ${other.join(', ') || 'none'}\n\n`;
  }
  fs.writeFileSync('ctu2_ancestry.md', md);
  console.log('written');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
