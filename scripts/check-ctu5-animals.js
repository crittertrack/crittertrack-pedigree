/**
 * Check animals for user CTU5
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function checkCTU5Animals() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('ERROR: MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        // Find user CTU5
        const user = await User.findOne({ id_public: 'CTU5' });
        if (!user) {
            console.log('User CTU5 not found');
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log(`User CTU5 found: ${user.personalName || user.breederName}`);
        console.log(`Backend ID: ${user._id}\n`);

        // Get all animals owned by CTU5
        const animals = await Animal.find({ ownerId: user._id }).lean();
        console.log(`Total animals with ownerId matching CTU5: ${animals.length}`);

        // Check how many have isOwned: true
        const ownedAnimals = animals.filter(a => a.isOwned === true);
        const notOwnedAnimals = animals.filter(a => a.isOwned !== true);

        console.log(`  - isOwned = true: ${ownedAnimals.length}`);
        console.log(`  - isOwned = false: ${notOwnedAnimals.length}\n`);

        if (notOwnedAnimals.length > 0) {
            console.log('Animals with isOwned = false:');
            notOwnedAnimals.forEach(a => {
                console.log(`  ${a.id_public} (${a.name})`);
            });
        }

        // Check the specific animals from the bug report
        const specificAnimals = [
            'CTC520', 'CTC521', 'CTC559', 'CTC561', 'CTC560', 
            'CTC565', 'CTC564', 'CTC525', 'CTC522', 'CTC562', 'CTC563'
        ];

        console.log('\n\nChecking specific animals from bug report:');
        for (const id_public of specificAnimals) {
            const animal = await Animal.findOne({ id_public }).lean();
            if (animal) {
                console.log(`  ${id_public}: Owner=${animal.ownerId_public}, isOwned=${animal.isOwned}`);
            } else {
                console.log(`  ${id_public}: NOT FOUND`);
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

checkCTU5Animals();
