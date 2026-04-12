// scripts/delete-recent-animals.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
    await mongoose.connect(uri);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const animals = await Animal.find({ createdAt: { $gte: twoHoursAgo } }).select('id_public').lean();
    const ids = animals.map(a => a.id_public);
    if (ids.length === 0) {
        console.log('No recent animals to delete.');
        await mongoose.disconnect();
        return;
    }
    const delResult = await Animal.deleteMany({ id_public: { $in: ids } });
    const pubDelResult = await PublicAnimal.deleteMany({ id_public: { $in: ids } });
    console.log(`Deleted ${delResult.deletedCount} Animal and ${pubDelResult.deletedCount} PublicAnimal records.`);
    await mongoose.disconnect();
}

if (require.main === module) run();
module.exports = { run };
