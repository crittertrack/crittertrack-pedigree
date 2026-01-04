/**
 * SYNC SCRIPT
 * Updates all existing PublicAnimal records with latest data from Animal table
 * Use this when you've manually updated Animal records and need to sync to PublicAnimal
 * 
 * Run with: node scripts/sync-all-public-animals.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function syncAllPublicAnimals() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack');
        console.log('✓ Connected to MongoDB');

        // Get ALL animals that should be public (showOnPublicProfile = true)
        const animals = await Animal.find({ showOnPublicProfile: true });
        console.log(`Found ${animals.length} public animals to sync`);

        let successCount = 0;
        let errorCount = 0;

        for (const animal of animals) {
            try {
                // Update the PublicAnimal record with latest data from Animal
                const publicAnimalData = {
                    ownerId_public: animal.ownerId_public,
                    id_public: animal.id_public,
                    species: animal.species,
                    breed: animal.breed || null,
                    strain: animal.strain || null,
                    prefix: animal.prefix,
                    suffix: animal.suffix,
                    name: animal.name,
                    gender: animal.gender,
                    birthDate: animal.birthDate,
                    color: animal.color,
                    coat: animal.coat,
                    coatPattern: animal.coatPattern || null,
                    earset: animal.earset || null,
                    imageUrl: animal.imageUrl || null,
                    photoUrl: animal.photoUrl || null,
                    sireId_public: animal.sireId_public || null,
                    damId_public: animal.damId_public || null,
                    isOwned: animal.isOwned || false,
                    isPregnant: animal.isPregnant || false,
                    isNursing: animal.isNursing || false,
                    status: animal.status || null,
                    breederId_public: animal.breederId_public || null,
                    remarks: animal.includeRemarks ? animal.remarks : '',
                    geneticCode: animal.includeGeneticCode ? animal.geneticCode : null,
                    includeRemarks: animal.includeRemarks || false,
                    includeGeneticCode: animal.includeGeneticCode || false,
                    isDisplay: animal.isDisplay || false,
                    sectionPrivacy: animal.sectionPrivacy || {},
                    tags: animal.tags || [],
                    deceasedDate: animal.deceasedDate || null,
                };

                await PublicAnimal.findOneAndUpdate(
                    { id_public: animal.id_public },
                    { $set: publicAnimalData },
                    { upsert: true, new: true, runValidators: true }
                );

                successCount++;
                if (successCount % 100 === 0) {
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

        // Check how many animals are now public
        const totalPublic = await PublicAnimal.countDocuments();
        console.log(`\nTotal PublicAnimal records in database: ${totalPublic}`);

        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

// Run the sync
syncAllPublicAnimals();
