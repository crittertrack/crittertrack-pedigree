/**
 * ONE-TIME MIGRATION SCRIPT
 * Makes all existing animals in the database public by creating PublicAnimal records
 * 
 * Run this script ONCE with: node scripts/migrate-all-animals-to-public.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function migrateAllAnimalsToPublic() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack');
        console.log('✓ Connected to MongoDB');

        // Get all animals that are NOT already public
        const animals = await Animal.find({ showOnPublicProfile: { $ne: true } });
        console.log(`Found ${animals.length} animals to make public`);

        let successCount = 0;
        let errorCount = 0;

        for (const animal of animals) {
            try {
                // Update the private animal record
                animal.showOnPublicProfile = true;
                animal.includeRemarks = false; // Default: don't include remarks
                animal.includeGeneticCode = false; // Default: don't include genetic code
                await animal.save();

                // Create or update the PublicAnimal record
                const publicAnimalData = {
                    ownerId_public: animal.ownerId_public,
                    id_public: animal.id_public,
                    species: animal.species,
                    prefix: animal.prefix,
                    suffix: animal.suffix,
                    name: animal.name,
                    gender: animal.gender,
                    birthDate: animal.birthDate,
                    color: animal.color,
                    coat: animal.coat,
                    imageUrl: animal.imageUrl || null,
                    photoUrl: animal.photoUrl || null,
                    sireId_public: animal.sireId_public || null,
                    damId_public: animal.damId_public || null,
                    isOwned: animal.isOwned || false,
                    isPregnant: animal.isPregnant || false,
                    isNursing: animal.isNursing || false,
                    status: animal.status || null,
                    breederId_public: animal.breederId_public || null,
                    remarks: '', // Don't include remarks by default
                    geneticCode: null, // Don't include genetic code by default
                    includeRemarks: false,
                    includeGeneticCode: false,
                    isDisplay: animal.isDisplay || false,
                    sectionPrivacy: animal.sectionPrivacy || {},
                };

                await PublicAnimal.findOneAndUpdate(
                    { id_public: animal.id_public },
                    { $set: publicAnimalData },
                    { upsert: true, new: true, runValidators: true }
                );

                successCount++;
                if (successCount % 100 === 0) {
                    console.log(`Progress: ${successCount}/${animals.length} animals published`);
                }
            } catch (error) {
                console.error(`Error publishing animal ${animal.id_public}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n=== MIGRATION COMPLETE ===');
        console.log(`✓ Successfully published: ${successCount} animals`);
        console.log(`✗ Errors: ${errorCount} animals`);
        console.log(`Total animals processed: ${animals.length}`);

        // Check how many animals are now public
        const totalPublic = await PublicAnimal.countDocuments();
        console.log(`\nTotal PublicAnimal records in database: ${totalPublic}`);

        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
migrateAllAnimalsToPublic();
