const S = require('./run_seed_a');
const { syncParentReproStatus } = require('../utils/reproStatusSync');
async function linkAll(M, Contact, user, ctx) {
  const uid = user._id;
  const { ids, L, created, litterDocs, encDocs, supDocs } = ctx;
  const litOid = {};
  litterDocs.forEach((l) => { litOid[l.litter_id_public] = l._id; });
  const setRec = async (doc, fromPub, toPub) => {
    const recs = (doc.breedingRecords || []).map((r) => {
      const o = r.toObject ? r.toObject() : Object.assign({}, r);
      if (o.litterId === fromPub) o.litterId = toPub;
      return o;
    });
    await M.Animal.updateOne({ _id: doc._id }, { $set: { breedingRecords: recs } });
  };
  await setRec(created.chestnut, 'LIT-A', L.A);
  await setRec(created.chestnut, 'LIT-B', L.B);
  await setRec(created.chestnut, 'LIT-G', L.G);
  await setRec(created.willow, 'LIT-A', L.A);
  await setRec(created.willow, 'LIT-B', L.B);
  await setRec(created.hazel, 'LIT-D', L.D);
  await setRec(created.hazel, 'LIT-G', L.G);
  await setRec(created.oakley, 'LIT-D', L.D);
  await setRec(created.juniper, 'LIT-F', L.F);
  await setRec(created.birch, 'LIT-E', L.E);
  await M.Animal.updateOne({ _id: created.cinder._id }, { $set: { litterId: litOid[L.B] } });
  await M.Animal.updateOne({ _id: created.dandelion._id }, { $set: { litterId: litOid[L.B] } });
  await M.Animal.updateOne({ _id: created.pippin._id }, { $set: { litterId: litOid[L.A] } });
  await M.Animal.updateOne({ _id: created.poppy._id }, { $set: { litterId: litOid[L.A] } });
  await M.User.updateOne({ _id: uid }, { $set: { ownedAnimals: Object.values(created).map((a) => a._id), ownedLitters: litterDocs.map((l) => l._id) } });
  await M.User.updateOne({ _id: uid }, { $set: { animalCollections: S.collections(ids) } });
  await M.PublicProfile.updateOne({ userId_backend: uid }, { $set: { generalCareTasks: S.generalTasks(ids), breederInfo: S.breederInfo() } });
  const txnDocs = await M.Transaction.create(S.transactions(uid, ids));
  const contactDocs = await Contact.create(S.contacts(uid));
  await Contact.updateOne({ _id: contactDocs[1]._id }, { $set: { assignedAnimals: [
    { animalId: created.chestnut._id, animalId_public: ids.chestnut, role: 'breeder', assignedDate: new Date() },
    { animalId: created.willow._id, animalId_public: ids.willow, role: 'breeder', assignedDate: new Date() } ] } });
  await Contact.updateOne({ _id: contactDocs[2]._id }, { $set: { assignedAnimals: [
    { animalId: created.cinder._id, animalId_public: ids.cinder, role: 'keeper', assignedDate: new Date() } ] } });
  const purchTxn = await M.Transaction.findOne({ userId: uid, type: 'purchase', animalId: ids.chestnut }).select('_id').lean();
  const saleTxn = await M.Transaction.findOne({ userId: uid, type: 'sale', animalId: ids.cinder }).select('_id').lean();
  if (purchTxn) await M.Animal.updateOne({ _id: created.chestnut._id }, { $set: { purchaseTransactionId: purchTxn._id } });
  if (saleTxn) await M.Animal.updateOne({ _id: created.cinder._id }, { $set: { saleTransactionId: saleTxn._id } });
  const food = supDocs.find((s) => s.name.includes('Oxbow'));
  const aspen = supDocs.find((s) => s.name.includes('Aspen'));
  const med = supDocs.find((s) => s.name.includes('Doxycycline'));
  const dietLink = (s, qty) => ({ id: String(s._id), name: s.name, category: s.category, quantity: qty, unit: s.unit });
  await M.Animal.updateOne({ _id: created.chestnut._id }, { $set: { dietSupplies: [dietLink(food, 1)] } });
  await M.Animal.updateOne({ _id: created.willow._id }, { $set: { dietSupplies: [dietLink(food, 2)] } });
  await M.Animal.updateOne({ _id: created.bramble._id }, { $set: { dietSupplies: [dietLink(food, 1)], supplementSupplies: [{ id: String(med._id), name: med.name, category: med.category, quantity: 1, unit: med.unit }] } });
  await M.Enclosure.updateOne({ _id: encDocs[0]._id }, { $set: { 'cleaningTasks.0.assignedSupplies': [{ supplyId: aspen._id, supplyName: aspen.name, quantity: 1, unit: aspen.unit }] } });
  for (const pid of [ids.chestnut, ids.willow, ids.hazel, ids.oakley, ids.juniper]) {
    await syncParentReproStatus(uid, [pid]);
  }
  for (const k of S.NAMES) {
    const fresh = await M.Animal.findById(created[k]._id).lean();
    await S.resyncAnimalToPublic(fresh);
  }
  return { txnDocs, contactDocs };
}
module.exports = { linkAll };
