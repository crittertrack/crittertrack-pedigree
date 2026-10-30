require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const users = db.collection('users');
  const animals = db.collection('animals');

  const user = await users.findOne({ id_public: 'CTU2' });
  const defs = (user.breedingLineDefs || []).slice(0, 4);
  const assignments = user.animalBreedingLines || {};

  const ids = Object.keys(assignments);
  const docs = await animals.find({ id_public: { $in: ids } }, { projection: { id_public: 1, name: 1, prefix: 1 } }).toArray();
  const nameMap = {};
  for (const d of docs) nameMap[d.id_public] = [d.prefix, d.name].filter(Boolean).join(' ');

  const owned = await animals.find({ creatorId_public: 'CTU2', isOwned: true }, { projection: { id_public: 1, name: 1, prefix: 1 } }).toArray();
  const assignedIds = new Set();

  let md = '# Breeding Line Assignments\n\n';
  for (const line of [0,1,2,3]) {
    const lineDefs = defs[line];
    md += `## Line ${line + 1} - ${lineDefs?.name || 'unnamed'}\n\n`;
    const ownedIds = new Set(owned.map(a => a.id_public));
    const members = Object.entries(assignments).filter(([id, lines]) => Array.isArray(lines) && lines.includes(line) && ownedIds.has(id)).map(([id]) => id);
    for (const id of members) { assignedIds.add(id); md += `- ${nameMap[id] || id}\n`; }
    if (members.length === 0) md += '- (none)\n';
    md += '\n';
  }

  md += '## Unassigned\n\n';
  for (const a of owned) {
    if (!assignedIds.has(a.id_public)) md += `- ${[a.prefix, a.name].filter(Boolean).join(' ')}\n`;
  }

  fs.writeFileSync(path.resolve(__dirname, 'breeding_lines_assignments.md'), md);
  console.log('Written');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });