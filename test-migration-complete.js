require('dotenv').config();
const mongoose = require('mongoose');
const Animal = require('./database/models.js').Animal;

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
console.log(`Connecting to: ${mongoUri ? 'MongoDB' : 'ERROR - no URI'}`);

mongoose.connect(mongoUri).then(async () => {
    console.log('✅ Connected to MongoDB');
    
    const animal = await Animal.findOne({ id_public: 'CTC11' }).exec();
    
    if (animal && animal.manualPedigree && animal.manualPedigree.sire) {
        console.log('✅ Migration complete!');
        console.log('CTC11 manualPedigree.sire:', JSON.stringify(animal.manualPedigree.sire, null, 2));
        process.exit(0);
    } else {
        console.log('❌ Migration not complete - CTC11 missing manualPedigree.sire');
        process.exit(1);
    }
}).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
