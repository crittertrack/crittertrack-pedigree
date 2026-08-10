// One-off cleanup: CTU1's ownedAnimals array had 4 stale entries pointing to already-deleted
// Animal docs (unrelated to the CTU1->CTU8 archived-animal migration). Clear them out so the
// admin account has zero animal references left.
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const r = await User.updateOne({ id_public: 'CTU1' }, { $set: { ownedAnimals: [] } });
    console.log('CTU1 ownedAnimals cleared, modified:', r.modifiedCount);
    await mongoose.disconnect();
})();
