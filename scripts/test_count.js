const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

console.log('MONGODB_URI set:', !!process.env.MONGODB_URI);

const { Animal } = require('../database/models');
console.log('Animal model loaded');

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
}).then(async () => {
    console.log('Connected!');
    try {
        const count = await Animal.countDocuments({
            lifeStage: { $in: ['Unknown', ''] },
            birthDate: { $exists: true, $ne: null }
        });
        console.log(`Found ${count} animals needing migration`);
    } catch (err) {
        console.error('Query error:', err.message);
    }
    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
