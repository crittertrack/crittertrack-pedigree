/**
 * COMPREHENSIVE SYNC SCRIPT
 * Syncs ALL fields from Animal table to PublicAnimal table
 * Sets all privacy toggles to PUBLIC (false) by default
 * 
 * Run with: node scripts/sync-all-animals-full.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function syncAllAnimalsWithFullData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack');
        console.log('✓ Connected to MongoDB');

        // Get ALL animals
        const animals = await Animal.find({});
        console.log(`Found ${animals.length} total animals to sync`);

        let successCount = 0;
        let errorCount = 0;

        for (const animal of animals) {
            try {
                // Ensure showOnPublicProfile is true
                if (!animal.showOnPublicProfile) {
                    animal.showOnPublicProfile = true;
                }

                // Initialize sectionPrivacy with ALL fields set to PUBLIC (true means public)
                // This replaces any old field names with the new standardized names
                const defaultSectionPrivacy = {
                    geneticCode: true,
                    lifeStage: true,
                    currentMeasurements: true,
                    growthHistory: true,
                    origin: true,
                    estrusCycle: true,
                    mating: true,
                    studInformation: true,
                    damInformation: true,
                    preventiveCare: true,
                    proceduresAndDiagnostics: true,
                    activeMedicalRecords: true,
                    veterinaryCare: true,
                    nutrition: true,
                    husbandry: true,
                    environment: true,
                    behavior: true,
                    activity: true,
                    remarks: true,
                    endOfLife: true,
                    legalAdministrative: true,
                    breedingHistory: true,
                    currentOwner: true
                };

                // Replace old sectionPrivacy structure with new one (don't merge, replace)
                animal.sectionPrivacy = defaultSectionPrivacy;
                animal.markModified('sectionPrivacy'); // Force Mongoose to save this object
                await animal.save();

                // Create full public animal data - copy ALL fields
                const { _id, ...animalData } = animal.toObject();
                
                // Ensure all required fields are present with explicit sectionPrivacy
                const publicAnimalData = {
                    ...animalData,
                    ownerId_public: animal.ownerId_public,
                    id_public: animal.id_public,
                    showOnPublicProfile: true,
                    isDisplay: animal.isDisplay || false,
                    sectionPrivacy: defaultSectionPrivacy, // Use default instead of animal's
                };

                await PublicAnimal.replaceOne(
                    { id_public: animal.id_public },
                    publicAnimalData,
                    { upsert: true }
                );

                successCount++;
                if (successCount % 50 === 0) {
                    console.log(`Progress: ${successCount}/${animals.length} animals synced`);
                }
            } catch (error) {
                console.error(`Error syncing animal ${animal.id_public}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n=== SYNC COMPLETE ===');
        console.log(`✓ Successfully synced: ${successCount} animals`);
        console.log(`✗ Errors: ${errorCount} animals`);
        console.log(`Total animals processed: ${animals.length}`);

        // Verify counts
        const totalPrivate = await Animal.countDocuments({ showOnPublicProfile: true });
        const totalPublic = await PublicAnimal.countDocuments();
        console.log(`\nTotal public animals in Animal table: ${totalPrivate}`);
        console.log(`Total records in PublicAnimal table: ${totalPublic}`);

        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

// Run the sync
syncAllAnimalsWithFullData();
