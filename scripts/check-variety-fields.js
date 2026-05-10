require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const total = await Animal.countDocuments();
    const hasColor = await Animal.countDocuments({ color: { $exists: true, $nin: ['', null] } });
    const hasCoat = await Animal.countDocuments({ coat: { $exists: true, $nin: ['', null] } });
    const hasCoatPattern = await Animal.countDocuments({ coatPattern: { $exists: true, $nin: ['', null] } });
    const missingAll = await Animal.countDocuments({
        color: { $in: ['', null, undefined] },
        coat: { $in: ['', null, undefined] },
        coatPattern: { $in: ['', null, undefined] },
        phenotype: { $in: ['', null, undefined] },
        morph: { $in: ['', null, undefined] },
    });

    console.log('Total animals:', total);
    console.log('Has color:', hasColor);
    console.log('Has coat:', hasCoat);
    console.log('Has coatPattern:', hasCoatPattern);
    console.log('Missing all variety fields:', missingAll);

    // Sample 5 animals missing color to see their structure
    const samples = await Animal.find(
        { color: { $in: ['', null] } },
        { id_public: 1, name: 1, color: 1, coat: 1, coatPattern: 1, species: 1, ownerId: 1 }
    ).limit(5).lean();
    console.log('\nSample animals missing color:');
    samples.forEach(a => console.log(JSON.stringify(a)));

    await mongoose.disconnect();
});
