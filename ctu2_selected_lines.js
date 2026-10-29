require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const col = db.collection('animals');
  const all = await col.find({}, { projection: { id_public:1, name:1, prefix:1, suffix:1, sireId_public:1, damId_public:1 } }).toArray();
  const byId = new Map(all.map(a=>[a.id_public,a]));
  const owned = await col.find({ creatorId_public:'CTU2', isOwned:true }, { projection:{id_public:1,name:1,prefix:1,suffix:1,sireId_public:1,damId_public:1} }).toArray();

  const TARGETS = ['CTC46','CTC43','CTC258','CTC265','CTC11'];
  const ancestorsOf = (id) => {
    const s=new Set(); const st=[id]; const seen=new Set();
    while(st.length){const x=st.pop();const a=byId.get(x);if(!a)continue;
      for(const p of [a.sireId_public,a.damId_public].filter(Boolean)) if(!seen.has(p)){seen.add(p);s.add(p);st.push(p);}
    }
    return s;
  };

  let md = `# CTU2 Lines by Selected Founders\n\n`;
  for (const t of TARGETS) {
    const a = byId.get(t);
    const label = a ? [a.prefix,a.name,a.suffix].filter(Boolean).join(' ') : t;
    md += `## ${t} — ${label}\n`;
    const desc = owned.filter(o => {
      const aa = byId.get(o.id_public);
      const hasParent = aa && [aa.sireId_public,aa.damId_public].filter(Boolean).some(p=>byId.has(p));
      if (!hasParent) return false;
      return ancestorsOf(o.id_public).has(t);
    });
    md += `Owned descendants: ${desc.length}\n`;
    for (const o of desc.sort((a,b)=>a.id_public.localeCompare(b.id_public))) {
      const l=[o.prefix,o.name,o.suffix].filter(Boolean).join(' ');
      md += `- ${o.id_public} — ${l}\n`;
    }
    md += `\n`;
  }
  const included = new Set();
  for (const t of TARGETS) {
    const desc = owned.filter(o => {
      const aa = byId.get(o.id_public);
      const hasParent = aa && [aa.sireId_public,aa.damId_public].filter(Boolean).some(p=>byId.has(p));
      if (!hasParent) return false;
      return ancestorsOf(o.id_public).has(t);
    });
    for (const o of desc) included.add(o.id_public);
  }
  const excluded = owned.filter(o => {
    const aa = byId.get(o.id_public);
    const hasParent = aa && [aa.sireId_public,aa.damId_public].filter(Boolean).some(p=>byId.has(p));
    if (!hasParent) return false;
    return !included.has(o.id_public);
  });
  md += `## Excluded (not descending from any selected founder)\nOwned count: ${excluded.length}\n`;
  for (const o of excluded.sort((a,b)=>a.id_public.localeCompare(b.id_public))) {
    const l=[o.prefix,o.name,o.suffix].filter(Boolean).join(' ');
    md += `- ${o.id_public} — ${l}\n`;
  }
  fs.writeFileSync('ctu2_selected_lines.md', md);
  console.log('written');
  await client.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
