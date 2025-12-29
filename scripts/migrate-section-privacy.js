/**
 * Migration script to initialize sectionPrivacy for all existing animals
 * Sets all sections to public (true) by default for all existing animals
 * Run this once to update all Animal and PublicAnimal records
 */

const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const defaultSectionPrivacy = {
    appearance: true,
    identification: true,
    health: true,
    reproductive: true,
    genetics: true,
    husbandry: true,
    behavior: true,
    records: true,
    endOfLife: true,
    remarks: true,
    owner: true,
    lifeStage: true,
    measurements: true,
    origin: true,
    medicalHistory: true,
    environment: true,
    activity: true
};

async function migrateSectionPrivacy() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Migrate Animal records
        console.log('\n=== Migrating Animal Records ===');
        const animalsWithoutPrivacy = await Animal.countDocuments({ sectionPrivacy: { $exists: false } });
        console.log(`Found ${animalsWithoutPrivacy} animals without sectionPrivacy`);

        if (animalsWithoutPrivacy > 0) {
            const resultAnimals = await Animal.updateMany(
                { sectionPrivacy: { $exists: false } },
                { $set: { sectionPrivacy: defaultSectionPrivacy } }
            );
            console.log(`✓ Updated ${resultAnimals.modifiedCount} Animal records`);
        } else {
            console.log('✓ All Animal records already have sectionPrivacy');
        }

        // Migrate PublicAnimal records
        console.log('\n=== Migrating PublicAnimal Records ===');
        const publicAnimalsWithoutPrivacy = await PublicAnimal.countDocuments({ sectionPrivacy: { $exists: false } });
        console.log(`Found ${publicAnimalsWithoutPrivacy} public animals without sectionPrivacy`);

        if (publicAnimalsWithoutPrivacy > 0) {
            const resultPublicAnimals = await PublicAnimal.updateMany(
                { sectionPrivacy: { $exists: false } },
                { $set: { sectionPrivacy: defaultSectionPrivacy } }
            );
            console.log(`✓ Updated ${resultPublicAnimals.modifiedCount} PublicAnimal records`);
        } else {
            console.log('✓ All PublicAnimal records already have sectionPrivacy');
        }

        // Also ensure isDisplay is set (for main public visibility toggle)
        console.log('\n=== Initializing isDisplay Field ===');
        const animalsWithoutDisplay = await Animal.countDocuments({ isDisplay: { $exists: false } });
        console.log(`Found ${animalsWithoutDisplay} animals without isDisplay`);

        if (animalsWithoutDisplay > 0) {
            const resultDisplay = await Animal.updateMany(
                { isDisplay: { $exists: false } },
                { $set: { isDisplay: false } }
            );
            console.log(`✓ Updated ${resultDisplay.modifiedCount} Animal records with isDisplay`);
        } else {
            console.log('✓ All Animal records already have isDisplay');
        }

        const publicAnimalsWithoutDisplay = await PublicAnimal.countDocuments({ isDisplay: { $exists: false } });
        console.log(`Found ${publicAnimalsWithoutDisplay} public animals without isDisplay`);

        if (publicAnimalsWithoutDisplay > 0) {
            const resultPublicDisplay = await PublicAnimal.updateMany(
                { isDisplay: { $exists: false } },
                { $set: { isDisplay: false } }
            );
            console.log(`✓ Updated ${resultPublicDisplay.modifiedCount} PublicAnimal records with isDisplay`);
        } else {
            console.log('✓ All PublicAnimal records already have isDisplay');
        }

        // Verify migration
        console.log('\n=== Verification ===');
        const totalAnimals = await Animal.countDocuments({});
        const animalsWithPrivacy = await Animal.countDocuments({ sectionPrivacy: { $exists: true } });
        const totalPublicAnimals = await PublicAnimal.countDocuments({});
        const publicAnimalsWithPrivacy = await PublicAnimal.countDocuments({ sectionPrivacy: { $exists: true } });

        console.log(`Total Animals: ${totalAnimals}`);
        console.log(`Animals with sectionPrivacy: ${animalsWithPrivacy}/${totalAnimals}`);
        console.log(`Total PublicAnimals: ${totalPublicAnimals}`);
        console.log(`PublicAnimals with sectionPrivacy: ${publicAnimalsWithPrivacy}/${totalPublicAnimals}`);

        if (animalsWithPrivacy === totalAnimals && publicAnimalsWithPrivacy === totalPublicAnimals) {
            console.log('\n✓ Migration completed successfully!');
        } else {
            console.log('\n⚠ Warning: Not all records were migrated');
        }

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

migrateSectionPrivacy();
