// Read-only report: which animals have a "/-" wildcard placeholder in their geneticCode,
// and which users (creatorId_public) own them.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animals = await Animal.find({ geneticCode: { $regex: /\/-/ } })
    .select('id_public name species geneticCode creatorId_public')
    .lean();

  console.log(`Total animals with a "/-" wildcard: ${animals.length}\n`);

  const byUser = {};
  for (const a of animals) {
    const key = a.creatorId_public || 'UNKNOWN';
    if (!byUser[key]) byUser[key] = [];
    byUser[key].push(a);
  }

  const userIds = Object.keys(byUser).filter(k => k !== 'UNKNOWN');
  const users = await User.find({ id_public: { $in: userIds } })
    .select('id_public personalName breederName email')
    .lean();
  const userMap = Object.fromEntries(users.map(u => [u.id_public, u]));

  for (const [creatorId, list] of Object.entries(byUser).sort((a, b) => b[1].length - a[1].length)) {
    const u = userMap[creatorId];
    const label = u ? `${creatorId} — ${u.breederName || u.personalName} (${u.email})` : creatorId;
    console.log(`${label}: ${list.length} animal(s)`);
    list.forEach(a => console.log(`   ${a.id_public} "${a.name}" [${a.species}]: ${a.geneticCode}`));
  }

  await mongoose.disconnect();
})();
