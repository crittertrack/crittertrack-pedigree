/**
 * Script to sync all animals marked as public (showOnPublicProfile: true) 
 * to the PublicAnimal collection
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

async function syncPublicAnimals() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all animals marked as public
        const publicAnimals = await Animal.find({ showOnPublicProfile: true }).lean();
        console.log(`\n📋 Found ${publicAnimals.length} animals marked as public\n`);

        let syncedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const animal of publicAnimals) {
            try {
                // Use animal's sectionPrivacy settings (per-animal privacy control)
                const sectionPrivacy = animal.sectionPrivacy || {};
                const showGeneticCode = sectionPrivacy.geneticCode !== false; // Default to true if not set
                const showRemarks = sectionPrivacy.remarks !== false; // Default to true if not set

                // Prepare public record
                const publicData = {
                    ownerId_public: animal.ownerId_public,
                    id_public: animal.id_public,
                    species: animal.species,
                    prefix: animal.prefix || '',
                    name: animal.name,
                    gender: animal.gender,
                    birthDate: animal.birthDate,
                    color: animal.color || '',
                    coat: animal.coat || '',
                    earset: animal.earset || '',
                    status: animal.status || null,
                    breederId_public: animal.breederId_public || null,
                    imageUrl: animal.imageUrl || null,
                    photoUrl: animal.photoUrl || null,
                    sireId_public: animal.sireId_public || null,
                    damId_public: animal.damId_public || null,
                    isOwned: animal.isOwned ?? true,
                    isPregnant: animal.isPregnant || false,
                    isNursing: animal.isNursing || false,
                    remarks: showRemarks ? (animal.remarks || '') : '',
                    geneticCode: showGeneticCode ? (animal.geneticCode || null) : null,
                };

                // Upsert to PublicAnimal collection
                const result = await PublicAnimal.updateOne(
                    { id_public: animal.id_public },
                    { $set: publicData },
                    { upsert: true }
                );

                if (result.upsertedCount > 0) {
                    console.log(`✅ Created public record for ${animal.id_public} - ${animal.name}`);
                    syncedCount++;
                } else if (result.modifiedCount > 0) {
                    console.log(`🔄 Updated public record for ${animal.id_public} - ${animal.name}`);
                    syncedCount++;
                } else {
                    console.log(`⏭️  Skipped ${animal.id_public} - ${animal.name} (already up to date)`);
                    skippedCount++;
                }
            } catch (error) {
                console.error(`❌ Error syncing ${animal.id_public}:`, error.message);
                errorCount++;
            }
        }

        // Clean up orphaned public records (animals no longer marked as public)
        console.log('\n🔍 Checking for orphaned public records...');
        const allPublicRecords = await PublicAnimal.find().lean();
        let deletedCount = 0;

        for (const publicRecord of allPublicRecords) {
            const privateAnimal = await Animal.findOne({ id_public: publicRecord.id_public }).lean();
            
            if (!privateAnimal || !privateAnimal.showOnPublicProfile) {
                await PublicAnimal.deleteOne({ id_public: publicRecord.id_public });
                console.log(`🗑️  Deleted orphaned public record: ${publicRecord.id_public} - ${publicRecord.name}`);
                deletedCount++;
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Sync Summary');
        console.log('='.repeat(60));
        console.log(`Animals marked as public: ${publicAnimals.length}`);
        console.log(`Synced to PublicAnimal: ${syncedCount}`);
        console.log(`Already up to date: ${skippedCount}`);
        console.log(`Orphaned records deleted: ${deletedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('\n✨ Sync complete!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

syncPublicAnimals();
