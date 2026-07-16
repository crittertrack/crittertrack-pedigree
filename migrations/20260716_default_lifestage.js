const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

// Ensure MONGODB_URI is available in the environment where the script is run
// Example: MONGODB_URI=mongodb://localhost:27017/crittertrack node migrations/20260716_default_lifestage.js
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev';

async function migrate() {
    console.log('Starting migration: Setting default lifeStage to "Unknown" for existing animals.');
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connected successfully.');

        // Update Animal collection
        const animalUpdateResult = await Animal.updateMany(
            { 
                $or: [
                    { lifeStage: { $exists: false } },
                    { lifeStage: null },
                    { lifeStage: '' }
                ]
            },
            { $set: { lifeStage: 'Unknown' } }
        );
        console.log(`Updated ${animalUpdateResult.nModified} animals in the 'Animal' collection.`);
        
        // Update Animal collection: Change 'Neonate' to 'Newborn'
        const animalNeonateUpdateResult = await Animal.updateMany(
            { lifeStage: 'Neonate' },
            { $set: { lifeStage: 'Newborn' } }
        );
        if (animalNeonateUpdateResult.nModified > 0) {
            console.log(`Updated ${animalNeonateUpdateResult.nModified} animals from 'Neonate' to 'Newborn' in the 'Animal' collection.`);
        }

        // Update PublicAnimal collection: Change 'Neonate' to 'Newborn'
        const publicAnimalNeonateUpdateResult = await PublicAnimal.updateMany(
            { lifeStage: 'Neonate' },
            { $set: { lifeStage: 'Newborn' } }
        );
        if (publicAnimalNeonateUpdateResult.nModified > 0) {
            console.log(`Updated ${publicAnimalNeonateUpdateResult.nModified} animals from 'Neonate' to 'Newborn' in the 'PublicAnimal' collection.`);
        }

        // Update PublicAnimal collection
        const publicAnimalUpdateResult = await PublicAnimal.updateMany(
            { 
                $or: [
                    { lifeStage: { $exists: false } },
                    { lifeStage: null },
                    { lifeStage: '' }
                ]
            },
            { $set: { lifeStage: 'Unknown' } }
        );
        console.log(`Updated ${publicAnimalUpdateResult.nModified} animals in the 'PublicAnimal' collection.`);

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1); // Exit with a non-zero code to indicate failure
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
}

// Execute the migration
migrate();