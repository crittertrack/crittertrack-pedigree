// Usage:
//   node bulk_breeding_lines.js <id_public> set <animalId> 1,2,3
//   node bulk_breeding_lines.js <id_public> clear <animalId>
//   node bulk_breeding_lines.js <id_public> clear-all
// Example: node bulk_breeding_lines.js CTU2 set CTC46 0,1
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

(async () => {
  const [,, idPublic, action, animalId, linesArg] = process.argv;
  if (!idPublic || !action) {
    console.log('Usage: node bulk_breeding_lines.js <id_public> set <animalId> 1,2,3 | clear <animalId> | clear-all');
    process.exit(1);
  }
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const user = await db.collection('users').findOne({ id_public: idPublic });
  if (!user) { console.error('user not found:', idPublic); await c.close(); process.exit(1); }

  const cur = (user.animalBreedingLines && typeof user.animalBreedingLines === 'object') ? { ...user.animalBreedingLines } : {};
  if (action === 'set') {
    if (!animalId) { console.error('missing animalId'); process.exit(1); }
    const ids = (linesArg || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
    cur[animalId] = ids;
    console.log('set', animalId, ids);
  } else if (action === 'clear') {
    if (!animalId) { console.error('missing animalId'); process.exit(1); }
    delete cur[animalId];
    console.log('cleared', animalId);
  } else if (action === 'clear-all') {
    Object.keys(cur).forEach(k => delete cur[k]);
    console.log('cleared all assignments');
  } else {
    console.error('unknown action:', action); process.exit(1);
  }

  await db.collection('users').updateOne({ _id: user._id }, { $set: { animalBreedingLines: cur } });
  console.log('done. total assignments:', Object.keys(cur).length);
  await c.close();
})();
