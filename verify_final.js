require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const { Litter, Animal } = require('./database/models');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const ids = ['CTC7589', 'CTC7467'];
    const litters = await Litter.find({ sireId_public: { $in: ids } }).select('litter_id_public sireId_public damId_public isPlanned matingDate birthDate').sort({ createdAt: -1 }).lean();
    console.log('Sire litters:', JSON.stringify(litters, null, 2));
    const animals = await Animal.find({ id_public: { $in: ids } }).select('id_public name isPlannedMating isInMating').lean();
    console.log('Animals:', JSON.stringify(animals, null, 2));
    const female = await Animal.find({ name: 'Aiko', gender: 'Female' }).select('id_public isPlannedMating isInMating isPregnant isNursing').lean();
    console.log('Female Aiko:', JSON.stringify(female, null, 2));
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
