// Syncs isDisplay to match showOnPublicProfile (the authoritative field — confirmed by
// PublicAnimal record existence) for the 11 animals found drifted out of sync.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const mismatched = await Animal.find({
        $expr: { $ne: ['$showOnPublicProfile', '$isDisplay'] }
    }).select('id_public showOnPublicProfile isDisplay');

    for (const animal of mismatched) {
        console.log(`${animal.id_public}\tisDisplay ${animal.isDisplay} -> ${animal.showOnPublicProfile}`);
        animal.isDisplay = animal.showOnPublicProfile;
        await animal.save();
    }

    console.log(`\nDone. ${mismatched.length} animal(s) synced.`);
    await mongoose.disconnect();
})();
