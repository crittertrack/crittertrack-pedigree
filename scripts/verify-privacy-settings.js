/**
 * VERIFICATION SCRIPT
 * Verifies that all animals have correct privacy settings
 * 
 * Run with: node scripts/verify-privacy-settings.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function verifyPrivacySettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack');
        console.log('✓ Connected to MongoDB');

        // Check Animal table
        const totalAnimals = await Animal.countDocuments();
        const publicAnimals = await Animal.countDocuments({ showOnPublicProfile: true });
        const animalsWithPrivacy = await Animal.countDocuments({ sectionPrivacy: { $exists: true } });
        
        console.log('\n=== ANIMAL TABLE ===');
        console.log(`Total animals: ${totalAnimals}`);
        console.log(`Public animals: ${publicAnimals}`);
        console.log(`Animals with sectionPrivacy: ${animalsWithPrivacy}`);

        // Sample one animal to check structure
        const sampleAnimal = await Animal.findOne({ sectionPrivacy: { $exists: true } }).lean();
        if (sampleAnimal) {
            console.log('\nSample sectionPrivacy structure:');
            console.log(JSON.stringify(sampleAnimal.sectionPrivacy, null, 2));
        }

        // Check PublicAnimal table
        const totalPublicAnimals = await PublicAnimal.countDocuments();
        const publicAnimalsWithPrivacy = await PublicAnimal.countDocuments({ sectionPrivacy: { $exists: true } });
        
        console.log('\n=== PUBLICANIMAL TABLE ===');
        console.log(`Total records: ${totalPublicAnimals}`);
        console.log(`Records with sectionPrivacy: ${publicAnimalsWithPrivacy}`);

        // Sample one public animal
        const samplePublicAnimal = await PublicAnimal.findOne({ sectionPrivacy: { $exists: true } }).lean();
        if (samplePublicAnimal) {
            console.log('\nSample PublicAnimal sectionPrivacy:');
            console.log(JSON.stringify(samplePublicAnimal.sectionPrivacy, null, 2));
        }

        // Check for any animals with missing privacy fields
        const allAnimals = await Animal.find({}).lean();
        let missingFields = [];
        const requiredFields = [
            'geneticCode', 'lifeStage', 'currentMeasurements', 'growthHistory', 'origin',
            'estrusCycle', 'mating', 'studInformation', 'damInformation', 'preventiveCare',
            'proceduresAndDiagnostics', 'activeMedicalRecords', 'veterinaryCare', 'nutrition',
            'husbandry', 'environment', 'behavior', 'activity', 'remarks', 'endOfLife',
            'legalAdministrative', 'breedingHistory', 'currentOwner'
        ];

        for (const animal of allAnimals) {
            if (!animal.sectionPrivacy) continue;
            for (const field of requiredFields) {
                if (animal.sectionPrivacy[field] === undefined) {
                    missingFields.push({ id: animal.id_public, field });
                }
            }
        }

        if (missingFields.length > 0) {
            console.log(`\n⚠ Found ${missingFields.length} missing privacy fields`);
            console.log('First 10:', missingFields.slice(0, 10));
        } else {
            console.log('\n✓ All animals have complete privacy settings');
        }

        console.log('\n=== SUMMARY ===');
        console.log(`✓ ${publicAnimals}/${totalAnimals} animals are public`);
        console.log(`✓ ${totalPublicAnimals} records in PublicAnimal table`);
        console.log(publicAnimals === totalPublicAnimals ? '✓ Tables are in sync' : '⚠ Tables may be out of sync');

        await mongoose.disconnect();
        console.log('\n✓ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyPrivacySettings();
