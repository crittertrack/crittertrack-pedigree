'use strict';
/** READ-ONLY: shows current owner + parents/offspring ownership for the given litters and the target users. */
const L = require('./lib');
const MAP = { CTL1644: 'CTU5', CTL1737: 'CTU107', CTL1745: 'CTU5', CTL1754: 'CTU77', CTL1779: 'CTU4', CTL1883: 'CTU4', CTL1910: 'CTU4' };
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Litter, Animal, User } = L.models;
  const users = await User.collection.find({ id_public: { $in: [...new Set(Object.values(MAP)), 'CTU2'] } }).project({ id_public: 1 }).toArray();
  const uById = new Map(users.map((u) => [String(u._id), u.id_public]));
  console.log('users found:', users.map((u) => `${u.id_public}=${u._id}`).join(', '));
  const ls = await Litter.collection.find({ litter_id_public: { $in: Object.keys(MAP) } }).toArray();
  for (const l of ls) {
    const ids = [l.sireId_public, l.damId_public, ...(l.offspringIds_public || [])].filter(Boolean);
    const an = await Animal.collection.find({ id_public: { $in: ids } }).project({ id_public: 1, creatorId_public: 1 }).toArray();
    console.log(JSON.stringify({
      id: l.litter_id_public, target: MAP[l.litter_id_public], creator: uById.get(String(l.creatorId)) || String(l.creatorId),
      linkedOwners: (l.linkedOwners || []).map((o) => uById.get(String(o)) || String(o)), sire: l.sireId_public, dam: l.damId_public,
      birth: l.birthDate, offspring: l.offspringIds_public, public: l.isDisplayLitter,
      animalOwners: Object.fromEntries(an.map((a) => [a.id_public, a.creatorId_public])),
    }));
  }
  await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
