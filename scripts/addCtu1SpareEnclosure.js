// One-off: adds CTU1's "Spare Cage" demo enclosure (definition lives in seed_ctu1/c_enclosures.js)
// without wiping/re-seeding the account. Skips if an enclosure with that name already exists.
require('dotenv').config();
const mongoose = require('mongoose');
const { enclosures } = require('../seed_ctu1/c_enclosures');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 });
    const M = require('../database/models.js');
    const user = await M.User.findOne({ id_public: 'CTU1' });
    if (!user) throw new Error('CTU1 not found');

    // Reuse the building/room of an existing CTU1 enclosure (Main Colony Rack) so it sits in the same place.
    const main = await M.Enclosure.findOne({ creatorId: user._id, name: 'Main Colony Rack' }).lean();
    if (!main) throw new Error('Main Colony Rack not found');

    const def = enclosures(user._id, main.buildingId, main.roomId, null).find(e => e.name === 'Spare Cage');
    if (await M.Enclosure.findOne({ creatorId: user._id, name: def.name })) {
        console.log('Spare Cage already exists - nothing to do.');
    } else {
        const doc = await M.Enclosure.create(def);
        console.log(`Created ${doc.name} (${doc._id}) imageUrl=${doc.imageUrl}`);
    }

    const all = await M.Enclosure.find({ creatorId: user._id }).select('name purpose imageUrl').lean();
    all.forEach(e => console.log(`DB: ${e.name} [${e.purpose}] -> ${e.imageUrl}`));
    await mongoose.disconnect();
})().catch(err => { console.error(err.message); process.exit(1); });
