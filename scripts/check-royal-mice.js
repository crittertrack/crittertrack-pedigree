require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Check PublicAnimal for any Royal Mice variants not exactly 'Royal Mice'
  const pub = await PublicAnimal.find({ manualBreederName: /royal.?mice/i }).select('id_public manualBreederName').lean();
  const pubVariants = pub.filter(d => d.manualBreederName !== 'Royal Mice');
  console.log('PublicAnimal Royal Mice total:', pub.length, '| non-normalised:', pubVariants.length);
  for (const d of pubVariants) console.log(' ', d.id_public, JSON.stringify(d.manualBreederName));

  // Also check Animal for any animals (any prefix) with Royal Mice variants not exactly 'Royal Mice'
  const allNotExact = await Animal.find({ manualBreederName: { $regex: 'royal.?mice', $options: 'i' } }).select('id_public prefix name manualBreederName').lean();
  const notExact = allNotExact.filter(d => d.manualBreederName !== 'Royal Mice');
  console.log('\nAnimal docs with non-normalised Royal Mice:', notExact.length);
  for (const d of notExact) console.log(' ', d.id_public, d.prefix, d.name, JSON.stringify(d.manualBreederName));

  // Normalise any stale variants in both collections
  if (pubVariants.length > 0) {
    const ids = pubVariants.map(d => d.id_public);
    const r = await PublicAnimal.updateMany({ id_public: { $in: ids } }, { $set: { manualBreederName: 'Royal Mice' } });
    console.log('\nPublicAnimal normalised:', r.modifiedCount);
  }
  if (notExact.length > 0) {
    const ids = notExact.map(d => d.id_public);
    const r = await Animal.updateMany({ id_public: { $in: ids } }, { $set: { manualBreederName: 'Royal Mice' } });
    console.log('Animal normalised:', r.modifiedCount);
  }

  await mongoose.disconnect();
})();
