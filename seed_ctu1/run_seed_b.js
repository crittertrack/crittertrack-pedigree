const S = require('./run_seed_a');
async function createBase(M, Contact, user) {
  const uid = user._id;
  const seq = await S.nextIds(M, S.NAMES.length);
  const ids = {};
  S.NAMES.forEach((k, i) => { ids[k] = seq[i]; });
  const litSeq = await S.nextLits(M, 6);
  const L = { A: litSeq[0], B: litSeq[1], D: litSeq[2], F: litSeq[3], E: litSeq[4], G: litSeq[5] };
  const refs = { litA: L.A, litB: L.B, litD: L.D, litF: L.F, litE: L.E, litG: L.G };
  console.log('ids:', JSON.stringify(ids), 'litters:', JSON.stringify(L));
  const bLoc = await M.Location.create(S.locations(uid)[0]);
  const roomDocs = await M.Location.create(S.rooms(uid, bLoc._id));
  const encDocs = await M.Enclosure.create(S.enclosures(uid, bLoc._id, roomDocs[0]._id, roomDocs[1]._id));
  Object.assign(refs, { encMain: String(encDocs[0]._id), encNursery: String(encDocs[1]._id), encQuar: String(encDocs[2]._id), encMed: String(encDocs[0]._id), encSale: String(encDocs[0]._id) });
  const supDocs = await M.SupplyItem.create(S.supplies(uid));
  const created = {};
  for (const k of S.NAMES) {
    const doc = S.builders[k].build(uid, ids, refs);
    doc.isInTreatment = S.computeIsInTreatment({ medications: doc.medications, medicalConditions: doc.medicalConditions });
    doc.healthStatus = S.computeHealthStatus({ quarantineDetails: doc.quarantineDetails, medications: doc.medications, medicalConditions: doc.medicalConditions, allergies: doc.allergies });
    if (k === 'oakley') doc.healthStatus = 'Monitoring';
    const saved = await M.Animal.create(doc);
    created[k] = saved;
    await S.resyncAnimalToPublic(saved.toObject());
  }
  const litterRows = S.littersA(uid, ids).concat(S.littersB(uid, ids));
  const order = [L.A, L.B, L.D, L.F, L.E, L.G];
  litterRows.forEach((l, i) => { l.litter_id_public = order[i]; });
  const litterDocs = await M.Litter.create(litterRows);
  return { ids, L, refs, bLoc, roomDocs, encDocs, supDocs, created, litterDocs };
}
module.exports = { createBase };
