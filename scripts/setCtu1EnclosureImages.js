// One-off: sets imageUrl on CTU1's demo enclosures (values come from seed_ctu1/c_enclosures.js)
// without wiping/re-seeding the account. Matches by creator + enclosure name only.
require('dotenv').config();
const mongoose = require('mongoose');
const { enclosures } = require('../seed_ctu1/c_enclosures');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 });
    const M = require('../database/models.js');
    const user = await M.User.findOne({ id_public: 'CTU1' });
    if (!user) throw new Error('CTU1 not found');

    for (const def of enclosures(user._id, null, null, null)) {
        const res = await M.Enclosure.updateOne(
            { creatorId: user._id, name: def.name },
            { $set: { imageUrl: def.imageUrl } }
        );
        console.log(`${def.name}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    }

    const check = await M.Enclosure.find({ creatorId: user._id }).select('name imageUrl').lean();
    check.forEach(e => console.log(`DB: ${e.name} -> ${e.imageUrl}`));
    await mongoose.disconnect();
})().catch(err => { console.error(err.message); process.exit(1); });
