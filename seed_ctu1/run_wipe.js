async function wipeCTU1(M, Contact, user) {
  const uid = user._id;
  const animals = await M.Animal.find({ creatorId: uid }).select('_id id_public').lean();
  const aids = animals.map((a) => a._id);
  const animalPublicIds = animals.map((a) => a.id_public);
  console.log('wipe: animals', animals.length);
  if (aids.length) {
    await M.Animal.deleteMany({ _id: { $in: aids } });
    await M.PublicAnimal.deleteMany({ id_public: { $in: animalPublicIds } });
    await M.AnimalLog.deleteMany({ animalId: { $in: aids } }).catch(() => {});
  }
  const litters = await M.Litter.find({ creatorId: uid }).select('_id').lean();
  console.log('wipe: litters', litters.length);
  if (litters.length) await M.Litter.deleteMany({ creatorId: uid });
  const encs = await M.Enclosure.find({ creatorId: uid }).select('_id').lean();
  console.log('wipe: enclosures', encs.length);
  if (encs.length) {
    await M.Enclosure.deleteMany({ creatorId: uid });
    await M.EnclosureLog.deleteMany({ enclosureId: { $in: encs.map((e) => e._id) } }).catch(() => {});
  }
  const locs = await M.Location.find({ creatorId: uid }).select('_id').lean();
  console.log('wipe: locations', locs.length);
  if (locs.length) await M.Location.deleteMany({ creatorId: uid });
  console.log('wipe: supplies', await M.SupplyItem.countDocuments({ userId: uid }));
  await M.SupplyItem.deleteMany({ userId: uid });
  console.log('wipe: transactions', await M.Transaction.countDocuments({ userId: uid }));
  await M.Transaction.deleteMany({ userId: uid });
  console.log('wipe: contacts', await Contact.countDocuments({ userId: uid }));
  await Contact.deleteMany({ userId: uid });
  await M.User.updateOne({ _id: uid }, { $set: { ownedAnimals: [], ownedLitters: [], animalCollections: { collections: [], animalMap: {} } } });
  await M.PublicProfile.updateOne({ userId_backend: uid }, { $set: { generalCareTasks: [] } });
}
module.exports = { wipeCTU1 };
