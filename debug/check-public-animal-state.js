/**
 * Check what's in the PublicAnimal collection and how it relates to Animal collection
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { Animal, PublicAnimal } = require('../database/models');

async function checkPublicAnimalState() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const animalCount = await Animal.countDocuments();
        const publicAnimalCount = await PublicAnimal.countDocuments();

        console.log(`📊 Collection sizes:`);
        console.log(`  - Animal: ${animalCount}`);
        console.log(`  - PublicAnimal: ${publicAnimalCount}\n`);

        // Check sample PublicAnimal records
        const samples = await PublicAnimal.find().limit(3).lean();
        console.log(`📋 Sample PublicAnimal records:\n`);
        samples.forEach((p, i) => {
            console.log(`${i + 1}. _id: ${p._id}`);
            console.log(`   id_public: ${p.id_public}`);
            console.log(`   name: ${p.name}`);
            console.log(`   creatorId: ${p.creatorId}`);
            console.log(`   showOnPublicProfile: ${p.showOnPublicProfile}`);
            console.log();
        });

        // Check if PublicAnimal records have id_public field populated
        const withoutIdPublic = await PublicAnimal.find({ id_public: null }).countDocuments();
        console.log(`⚠️  PublicAnimal records without id_public: ${withoutIdPublic}`);

        // Check if they're synced by comparing counts
        const animalWithDisplay = await Animal.find({ showOnPublicProfile: true }).countDocuments();
        console.log(`\n🔗 Matching check:`);
        console.log(`  - Animals with showOnPublicProfile=true: ${animalWithDisplay}`);
        console.log(`  - PublicAnimal collection: ${publicAnimalCount}`);
        console.log(`  - Difference: ${publicAnimalCount - animalWithDisplay}`);

        // Check if they're matched by id_public
        const animalIdPublics = await Animal.find({ showOnPublicProfile: true })
            .select('id_public').lean();
        const publicIdPublics = await PublicAnimal.find()
            .select('id_public').lean();

        const animalIds = new Set(animalIdPublics.map(a => a.id_public));
        const publicIds = new Set(publicIdPublics.map(p => p.id_public));

        const matchingByIdPublic = [...animalIds].filter(id => publicIds.has(id)).length;
        console.log(`\n🔗 Matched by id_public field: ${matchingByIdPublic}/${animalIdPublics.length}`);

        if (matchingByIdPublic === animalIdPublics.length) {
            console.log('✅ All public animals have matching PublicAnimal records (by id_public)\n');
        } else {
            console.log(`❌ Only ${matchingByIdPublic} of ${animalIdPublics.length} matched\n`);
            
            // Show some that don't match
            const unmatched = [...animalIds].filter(id => !publicIds.has(id)).slice(0, 10);
            console.log(`Sample unmatched Animal id_publics:`);
            unmatched.forEach(id => console.log(`  - ${id}`));
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkPublicAnimalState();
