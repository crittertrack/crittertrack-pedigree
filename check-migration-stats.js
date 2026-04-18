require('dotenv').config();
const mongoose = require('mongoose');
const Animal = require('./database/models.js').Animal;

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(mongoUri).then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Count animals with manualPedigree.sire populated
    const withSire = await Animal.countDocuments({ 'manualPedigree.sire.ctcId': { $exists: true } });
    const withDam = await Animal.countDocuments({ 'manualPedigree.dam.ctcId': { $exists: true } });
    const withBoth = await Animal.countDocuments({ 
        'manualPedigree.sire.ctcId': { $exists: true },
        'manualPedigree.dam.ctcId': { $exists: true }
    });
    
    console.log(`\n📊 Migration Statistics:`);
    console.log(`   ✅ Animals with sire: ${withSire}`);
    console.log(`   ✅ Animals with dam: ${withDam}`);
    console.log(`   ✅ Animals with both sire & dam: ${withBoth}`);
    
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
