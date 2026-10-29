require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const col = db.collection('animals');

  const all = await col.find({}, { projection: { id_public: 1, name: 1, prefix: 1, suffix: 1, sireId_public: 1, damId_public: 1, creatorId_public: 1, isOwned: 1, archived: 1 } }).toArray();
  const byId = new Map(all.map(a => [a.id_public, a]));
  const owned = await col.find({ creatorId_public: 'CTU2', isOwned: true }, { projection: { id_public: 1, name: 1, prefix: 1, suffix: 1 } }).toArray();
  const ownedIds = new Set(owned.map(a => a.id_public));

  // union-find over all animals by parent links
  const parent = new Map(all.map(a => [a.id_public, a.id_public]));
  const find = x => { let r = x; while (parent.get(r) !== r) { parent.set(r, parent.get(parent.get(r))); r = parent.get(r); } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const a of all) {
    for (const p of [a.sireId_public, a.damId_public].filter(Boolean)) {
      if (byId.has(p)) union(a.id_public, p);
    }
  }

  // group
  const compMap = new Map(); // root -> { founders: Set, owned: [] }
  for (const a of all) {
    const r = find(a.id_public);
    if (!compMap.has(r)) compMap.set(r, { founders: new Set(), owned: [] });
    // founder = animal with no parents in DB
    const hasParent = (a.sireId_public && byId.has(a.sireId_public)) || (a.damId_public && byId.has(a.damId_public));
    if (!hasParent) compMap.get(r).founders.add(a.id_public);
  }
  for (const o of owned) {
    const a = byId.get(o.id_public);
    const hasParent = (a && a.sireId_public && byId.has(a.sireId_public)) || (a && a.damId_public && byId.has(a.damId_public));
    if (!hasParent) continue; // exclude owned animals with no parents
    const r = find(o.id_public);
    if (!compMap.has(r)) compMap.set(r, { founders: new Set(), owned: [] });
    compMap.get(r).owned.push(o);
  }

  // only components containing owned CTU2 animals
  const lines = [...compMap.values()].filter(c => c.owned.length > 0);

  let md = `# CTU2 Bloodlines\n\n`;
  md += `Owned CTU2 animals: ${owned.length}\n`;
  md += `Separate bloodlines (connected components): ${lines.length}\n\n`;
  lines.forEach((c, i) => {
    md += `## Bloodline ${i + 1}\n`;
    const foundersList = [...c.founders].sort().map(id => {
      const a = byId.get(id);
      const label = a ? [a.prefix, a.name, a.suffix].filter(Boolean).join(' ') : id;
      return `${id} (${label})`;
    }).join(', ') || 'none';
    md += `**Founders (root ancestors with no recorded parents):** ${foundersList}\n\n`;
    md += `**Owned descendants (${c.owned.length}):**\n`;
    for (const o of c.owned.sort((a,b)=>a.id_public.localeCompare(b.id_public))) {
      const label = [o.prefix, o.name, o.suffix].filter(Boolean).join(' ');
      md += `- ${o.id_public} — ${label}\n`;
    }
    md += `\n`;
  });

  fs.writeFileSync('ctu2_bloodlines.md', md);
  console.log('written ctu2_bloodlines.md with', lines.length, 'bloodlines');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
