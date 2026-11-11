'use strict';
/**
 * Reassigns litter ownership (creatorId) per the MAP below. Only creatorId changes; offspring/parent animals are NOT touched.
 * Saves the original litters to recovery-reports/reassigned-litters-backup.json first (restore = set creatorId back).
 * DRY RUN by default; pass --confirm to write.
 */
const L = require('./lib');
const MAP = { CTL1644: 'CTU5', CTL1737: 'CTU107', CTL1745: 'CTU5', CTL1754: 'CTU77', CTL1779: 'CTU4', CTL1883: 'CTU4', CTL1910: 'CTU4' };
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Litter, User } = L.models;
  console.log(L.confirm ? '*** WRITING ***' : '--- DRY RUN (no writes) ---');
  const users = await User.collection.find({ id_public: { $in: [...new Set(Object.values(MAP))] } }).project({ id_public: 1 }).toArray();
  const uid = new Map(users.map((u) => [u.id_public, u._id]));
  const ls = await Litter.collection.find({ litter_id_public: { $in: Object.keys(MAP) } }).toArray();
  if (ls.length !== Object.keys(MAP).length) throw new Error('Not all litters found');
  for (const l of ls) if (!uid.get(MAP[l.litter_id_public])) throw new Error('Missing user for ' + l.litter_id_public);
  if (L.confirm) L.fs.writeFileSync(L.path.join(__dirname, '..', '..', '..', 'recovery-reports', 'reassigned-litters-backup.json'), JSON.stringify(ls, null, 2));
  for (const l of ls) {
    const to = MAP[l.litter_id_public];
    console.log(`${l.litter_id_public}: ${String(l.creatorId)} -> ${to} (${uid.get(to)})`);
    if (L.confirm) await Litter.collection.updateOne({ _id: l._id }, { $set: { creatorId: uid.get(to) }, $pull: { linkedOwners: uid.get(to) } });
  }
  await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
