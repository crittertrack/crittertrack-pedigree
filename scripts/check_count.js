const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const {Animal} = require('../database/models');

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 }).then(async () => {
    try {
        // Count ALL animals needing migration (any species)
        const totalCount = await Animal.countDocuments({
            lifeStage: { $in: ['Unknown', ''] },
            birthDate: { $exists: true, $ne: null }
        });
        console.log('Total needing migration (all species):', totalCount);
        
        // Count only Fancy Mouse
        const fancyMouseCount = await Animal.countDocuments({
            species: 'Fancy Mouse',
            lifeStage: { $in: ['Unknown', ''] },
            birthDate: { $exists: true, $ne: null }
        });
        console.log('Fancy Mouse needing migration:', fancyMouseCount);
        
        // Count other species
        const otherCount = totalCount - fancyMouseCount;
        console.log('Other species needing migration:', otherCount);
    } catch (err) {
        console.error('Query error:', err.message);
    }
    await mongoose.disconnect();
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});