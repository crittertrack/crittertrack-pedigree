/**
 * Fix isOwned field for transferred animals
 * 
 * Issue: When accepting animal transfers, the code was incorrectly setting
 * animal.state = 'isowned' instead of animal.isOwned = true
 * 
 * This caused transferred animals to not appear in the "My Animals" list
 * because the query requires both ownerId match AND isOwned: true
 * 
 * This script finds all animals where:
 * - ownerId is set (they have an owner)
 * - isOwned is false (incorrectly marked as not owned)
 * And sets isOwned to true for them
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

async function fixTransferredAnimals() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('ERROR: MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB');

        // Find animals that have an owner but isOwned is false
        const affectedAnimals = await Animal.find({
            ownerId: { $exists: true, $ne: null },
            isOwned: { $ne: true }
        }).lean();

        console.log(`\nFound ${affectedAnimals.length} animals with isOwned incorrectly set to false`);

        if (affectedAnimals.length > 0) {
            console.log('\nSample affected animals:');
            affectedAnimals.slice(0, 10).forEach(animal => {
                console.log(`  - ${animal.id_public} (${animal.name}) - Owner: ${animal.ownerId_public}, isOwned: ${animal.isOwned}`);
            });

            // Update all affected animals
            const result = await Animal.updateMany(
                {
                    ownerId: { $exists: true, $ne: null },
                    isOwned: { $ne: true }
                },
                {
                    $set: { isOwned: true }
                }
            );

            console.log(`\n✓ Updated ${result.modifiedCount} animals to isOwned: true`);
        } else {
            console.log('\n✓ No animals need fixing');
        }

        // Verify the specific animals mentioned by the user
        const specificAnimals = [
            'CTC520', 'CTC521', 'CTC559', 'CTC561', 'CTC560', 
            'CTC565', 'CTC564', 'CTC525', 'CTC522', 'CTC562', 'CTC563'
        ];

        console.log('\n\nChecking specific animals mentioned in the bug report:');
        for (const id_public of specificAnimals) {
            const animal = await Animal.findOne({ id_public }).lean();
            if (animal) {
                console.log(`  ${id_public}: ownerId=${animal.ownerId_public}, isOwned=${animal.isOwned}`);
            } else {
                console.log(`  ${id_public}: NOT FOUND`);
            }
        }

        console.log('\n✓ Migration complete');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error running migration:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

fixTransferredAnimals();
