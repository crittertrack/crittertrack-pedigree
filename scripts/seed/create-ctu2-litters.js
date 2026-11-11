'use strict';
/**
 * Creates CTU2 litter entries the same way POST /api/litters does:
 * auto due date -> addLitter (assigns CTL id, duplicate-pairing check, links to user) -> syncParentReproStatus.
 * DRY RUN by default (reads only). Pass --confirm to write.
 * Every name must resolve to exactly ONE CTU2 animal of the right sex, otherwise that pair is skipped.
 */
const L = require('./lib');
const { addLitter } = require('../../database/db_service');
const { applyAutoDueDateOnCreate, getAutoCalcPrefs } = require('../../utils/autoWeaningDate');
const { syncParentReproStatus } = require('../../utils/reproStatusSync');

const Y = 2026;
const d = (m, day) => new Date(Date.UTC(Y, m - 1, day, 12, 0, 0)); // noon UTC: same calendar day in any timezone

// [sire, dam, matingDate, isPlanned]
const PAIRS = [
  // Planned for 5 Dec (treated as the planned mating date); the other 18 pairings were created earlier
  ['Kirlian', 'Spooky', d(12, 5), true],
  ['Apero', 'Ayla', d(12, 5), true],
  ['Toetie', 'Josie', d(12, 5), true],
];

const label = (a) => `${a.id_public} ${[a.prefix, a.name].filter(Boolean).join(' ')}`;

(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Animal, Litter, User } = L.models;
  const owner = await User.collection.findOne({ id_public: 'CTU2' }, { projection: { _id: 1, id_public: 1 } });
  if (!owner) throw new Error('CTU2 user not found');
  const ownerDoc = { id: String(owner._id), id_public: owner.id_public };

  const animals = await Animal.collection.find({ creatorId_public: 'CTU2' })
    .project({ id_public: 1, prefix: 1, name: 1, gender: 1, species: 1 }).toArray();
  const norm = (s) => String(s || '').trim().toLowerCase();
  const find = (token, gender) => animals.filter((a) => {
    if (/^CTC\d+$/i.test(token)) return a.id_public === token.toUpperCase() && a.gender === gender; // explicit animal id
    const full = norm([a.prefix, a.name].filter(Boolean).join(' '));
    return (norm(a.name) === norm(token) || full === norm(token) || full.endsWith(' ' + norm(token))) && a.gender === gender;
  });

  const sample = await Litter.collection.findOne({ creatorId: owner._id, sirePrefixName: { $ne: null } });
  console.log('Sample existing CTU2 litter naming:', sample ? JSON.stringify({ sire: sample.sireId_public, sirePrefixName: sample.sirePrefixName, dam: sample.damId_public, damPrefixName: sample.damPrefixName }) : 'none');
  console.log(L.confirm ? '*** WRITING ***' : '--- DRY RUN (no writes) ---');

  const autoCalc = await getAutoCalcPrefs(owner._id);
  let ok = 0, skipped = 0;
  const touched = new Set();
  for (const [sireName, damName, matingDate, isPlanned] of PAIRS) {
    const sires = find(sireName, 'Male'), dams = find(damName, 'Female');
    const tag = `${sireName} x ${damName} (${matingDate.toISOString().slice(0, 10)}${isPlanned ? ', planned' : ''})`;
    if (sires.length !== 1 || dams.length !== 1) {
      skipped++;
      console.log(`SKIP  ${tag}: sire matches=${sires.length} [${sires.map(label).join('; ')}] dam matches=${dams.length} [${dams.map(label).join('; ')}]`);
      continue;
    }
    const [sire, dam] = [sires[0], dams[0]];
    const litterData = {
      sireId_public: sire.id_public, sirePrefixName: [sire.prefix, sire.name].filter(Boolean).join(' '),
      damId_public: dam.id_public, damPrefixName: [dam.prefix, dam.name].filter(Boolean).join(' '),
      matingDate, isPlanned,
    };
    if (autoCalc.dueDate) await applyAutoDueDateOnCreate(litterData, owner.id_public);
    const due = litterData.expectedDueDate ? new Date(litterData.expectedDueDate).toISOString().slice(0, 10) : '-';
    if (!L.confirm) { ok++; console.log(`OK    ${tag}: ${label(sire)} x ${label(dam)} | due ${due}`); continue; }
    try {
      const created = await addLitter(owner._id, litterData);
      touched.add(sire.id_public); touched.add(dam.id_public);
      ok++; console.log(`MADE  ${created.litter_id_public} ${tag}: ${label(sire)} x ${label(dam)} | due ${due}`);
    } catch (e) {
      skipped++; console.log(`SKIP  ${tag}: ${e.code || ''} ${e.message}`);
    }
  }
  if (L.confirm && touched.size) await syncParentReproStatus(owner._id, [...touched]);
  console.log(`${L.confirm ? 'Created' : 'Would create'}: ${ok} | skipped: ${skipped}`);
  await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
