require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const { MongoClient } = require('mongodb');

const outputPath = require('path').resolve(__dirname, '../../FANCY_MOUSE_DUPLICATE_FACTCHECK_2026-09-16.md');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const animals = client.db().collection('animals');

  const docs = await animals.find({
    species: 'Fancy Mouse',
    $and: [
      {
        $or: [
          { prefix: { $exists: true, $ne: null, $ne: '' } },
          { name: { $exists: true, $ne: null, $ne: '' } }
        ]
      },
      {
        $nor: [
          { name: /^MM\b/i },
          { prefix: /^MM\b/i },
          { name: /^MM\s+/i },
          { prefix: /^MM\s+/i }
        ]
      }
    ]
  }, {
    projection: {
      _id: 0,
      id_public: 1,
      creatorId: 1,
      name: 1,
      prefix: 1,
      suffix: 1,
      species: 1,
      variety: 1,
      color: 1,
      coat: 1,
      earset: 1,
      markings: 1,
      gender: 1,
      archived: 1,
      birthDate: 1,
      breederAssignedId: 1,
      status: 1
    }
  }).toArray();

  const keyMap = new Map();

  for (const animal of docs) {
    const name = (animal.name || '').trim();
    if (!name) continue;
    const normalized = name
      .toLowerCase()
      .replace(/[’ʼ]/g, "'");
    if (!keyMap.has(normalized)) keyMap.set(normalized, []);
    keyMap.get(normalized).push(animal);
  }

  const groups = [...keyMap.values()]
    .filter(arr => arr.length > 1)
    .sort((a, b) => {
      const aKey = `${(a[0].prefix || '').trim()} ${(a[0].name || '').trim()}`.toLowerCase();
      const bKey = `${(b[0].prefix || '').trim()} ${(b[0].name || '').trim()}`.toLowerCase();
      return aKey.localeCompare(bKey) || b.length - a.length;
    });

  const lines = [];
  lines.push('# Fancy Mouse duplicate fact-check');
  lines.push('');
  lines.push('Scope: all Fancy Mouse entries, cross-website, including archived animals, excluding any record whose `name` or `prefix` starts with `MM` (as requested).');
  lines.push('');
  lines.push(`Total candidate groups: ${groups.length}`);
  lines.push('');

  for (const group of groups) {
    const first = group[0];
    const normalizedName = `${(first.prefix || '').trim()} ${(first.name || '').trim()}`.replace(/\s+/g, ' ').trim();
    lines.push(`## ${normalizedName}`);
    lines.push('');
    lines.push('| id_public | prefix | name | suffix | variety | gender |');
    lines.push('|---|---|---|---|---|---|');
    for (const animal of group.sort((a, b) => String(a.id_public).localeCompare(String(b.id_public)))) {
      const variety = [animal.variety, animal.color, animal.coat, animal.earset, animal.markings]
        .filter(Boolean)
        .join(' ')
        .trim();

      lines.push(`| ${animal.id_public || ''} | ${animal.prefix || ''} | ${animal.name || ''} | ${animal.suffix || ''} | ${variety || ''} | ${animal.gender || ''} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`Wrote ${groups.length} candidate groups to ${outputPath}`);
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
