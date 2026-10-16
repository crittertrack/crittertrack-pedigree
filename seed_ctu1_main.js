require('dotenv').config();
const mongoose = require('mongoose');
mongoose.set('bufferTimeoutMS', 60000);
const { wipeCTU1 } = require('./seed_ctu1/run_wipe');
const { createBase } = require('./seed_ctu1/run_seed_b');
const { linkAll } = require('./seed_ctu1/run_seed_c');
const { carePatches } = require('./seed_ctu1/f_patches');
(async () => {
  const t0 = Date.now();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 });
  const M = require('./database/models.js');
  const Contact = require('./database/contactModel.js');
  const user = await M.User.findOne({ id_public: 'CTU1' });
  if (!user) throw new Error('CTU1 not found');
  console.log('=== STAGE 1: wipe CTU1 ===');
  await wipeCTU1(M, Contact, user);
  console.log('=== STAGE 2: create base ===');
  const ctx = await createBase(M, Contact, user);
  console.log('=== STAGE 3: link + sync ===');
  await linkAll(M, Contact, user, ctx);
  console.log('=== STAGE 4: care tasks + verify ===');
  for (const p of carePatches()) {
    const a = await M.Animal.findOne({ creatorId: user._id, name: p.name }).select('_id').lean();
    if (a) await M.Animal.updateOne({ _id: a._id }, { $set: { animalCareTasks: p.animalCareTasks } });
  }
  const counts = {
    animals: await M.Animal.countDocuments({ creatorId: user._id }),
    litters: await M.Litter.countDocuments({ creatorId: user._id }),
    enclosures: await M.Enclosure.countDocuments({ creatorId: user._id }),
    locations: await M.Location.countDocuments({ creatorId: user._id }),
    supplies: await M.SupplyItem.countDocuments({ userId: user._id }),
    transactions: await M.Transaction.countDocuments({ userId: user._id }),
    contacts: await Contact.countDocuments({ userId: user._id }),
  };
  console.log('COUNTS:', JSON.stringify(counts));
  const animals = await M.Animal.find({ creatorId: user._id }).select('id_public name gender status isForSale availableForBreeding isDisplay isPregnant isNursing isInMating isPlannedMating isQuarantine isInTreatment healthStatus').lean();
  console.log('ANIMALS:', JSON.stringify(animals, null, 1));
  const litters = await M.Litter.find({ creatorId: user._id }).select('litter_id_public sireId_public damId_public birthDate isPlanned offspringIds_public').lean();
  console.log('LITTERS:', JSON.stringify(litters, null, 1));
  const u2 = await M.User.findById(user._id).select('animalCollections ownedAnimals ownedLitters').lean();
  console.log('COLLECTIONS:', JSON.stringify(u2.animalCollections));
  console.log('OWNED:', u2.ownedAnimals.length, u2.ownedLitters.length);
  const pp = await M.PublicProfile.findOne({ userId_backend: user._id }).select('generalCareTasks breederInfo').lean();
  console.log('GENERALTASKS:', (pp.generalCareTasks || []).length, 'BREEDERINFO-ABOUT:', (pp.breederInfo && pp.breederInfo.aboutProgram || '').slice(0, 60));
  console.log('DONE in ' + Math.round((Date.now() - t0) / 1000) + 's');
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('SEED FAIL:', e); process.exit(1); });
