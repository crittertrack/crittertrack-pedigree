/**
 * Migration Script: Consolidate pairingDate and matingDates to matingDate
 * 
 * This script migrates data from the deprecated fields to the unified matingDate field:
 * - Litters: pairingDate (Date) -> matingDate (Date)
 * - Litters: matingDates (String) -> matingDate (Date, parsed if valid date string)
 * - Breeding Records: matingDates (String) -> matingDate (Date, parsed if valid date string)
 * 
 * Priority for Litters: pairingDate takes precedence over matingDates if both exist
 * 
 * Run: node migrate-mating-date.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Litter, Animal } = require('./database/models');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateMatingDates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // ====================
        // PART 1: Migrate Litters
        // ====================
        console.log('\n📦 MIGRATING LITTERS...\n');
        
        // Find all litters that need migration
        const littersToMigrate = await Litter.find({
            $or: [
                { pairingDate: { $exists: true, $ne: null } },
                { matingDates: { $exists: true, $ne: null } }
            ]
        });

        console.log(`📊 Found ${littersToMigrate.length} litters with pairingDate or matingDates\n`);

        let litterMigratedFromPairingDate = 0;
        let litterMigratedFromMatingDates = 0;
        let litterSkippedAlreadySet = 0;
        let litterErrors = 0;

        for (const litter of littersToMigrate) {
            try {
                // Skip if matingDate is already set
                if (litter.matingDate) {
                    litterSkippedAlreadySet++;
                    continue;
                }

                let newMatingDate = null;

                // Priority 1: Use pairingDate if available (it's already a Date)
                if (litter.pairingDate) {
                    newMatingDate = litter.pairingDate;
                    litterMigratedFromPairingDate++;
                    console.log(`✓ Litter ${litter.litter_id_public}: Migrating pairingDate -> matingDate: ${newMatingDate.toISOString().split('T')[0]}`);
                }
                // Priority 2: Try to parse matingDates string if no pairingDate
                else if (litter.matingDates) {
                    const parsedDate = new Date(litter.matingDates);
                    if (!isNaN(parsedDate.getTime())) {
                        newMatingDate = parsedDate;
                        litterMigratedFromMatingDates++;
                        console.log(`✓ Litter ${litter.litter_id_public}: Migrating matingDates -> matingDate: ${newMatingDate.toISOString().split('T')[0]}`);
                    } else {
                        console.log(`⚠ Litter ${litter.litter_id_public}: Could not parse matingDates: "${litter.matingDates}"`);
                        litterErrors++;
                    }
                }

                // Update the litter with the new matingDate
                if (newMatingDate) {
                    await Litter.updateOne(
                        { _id: litter._id },
                        { $set: { matingDate: newMatingDate } }
                    );
                }

            } catch (error) {
                console.error(`❌ Error processing litter ${litter.litter_id_public}:`, error.message);
                litterErrors++;
            }
        }

        console.log('\n📈 Litter Migration Summary:');
        console.log(`   ✅ Migrated from pairingDate: ${litterMigratedFromPairingDate}`);
        console.log(`   ✅ Migrated from matingDates: ${litterMigratedFromMatingDates}`);
        console.log(`   ⏭  Skipped (already set): ${litterSkippedAlreadySet}`);
        console.log(`   ❌ Errors: ${litterErrors}`);
        console.log(`   📊 Total processed: ${littersToMigrate.length}`);

        // ====================
        // PART 2: Migrate Breeding Records
        // ====================
        console.log('\n🧬 MIGRATING BREEDING RECORDS...\n');

        const animalsWithBreedingRecords = await Animal.find({
            'breedingRecords': { $exists: true, $ne: [] }
        });

        console.log(`📊 Found ${animalsWithBreedingRecords.length} animals with breeding records\n`);

        let recordsMigrated = 0;
        let recordsSkipped = 0;
        let recordErrors = 0;

        for (const animal of animalsWithBreedingRecords) {
            let updated = false;

            for (const record of animal.breedingRecords) {
                try {
                    // Skip if matingDate is already set
                    if (record.matingDate) {
                        recordsSkipped++;
                        continue;
                    }

                    // Try to parse matingDates string
                    if (record.matingDates) {
                        const parsedDate = new Date(record.matingDates);
                        if (!isNaN(parsedDate.getTime())) {
                            record.matingDate = parsedDate;
                            recordsMigrated++;
                            updated = true;
                            console.log(`✓ Animal ${animal.id_public} Record ${record.id}: Migrating matingDates -> matingDate: ${parsedDate.toISOString().split('T')[0]}`);
                        } else {
                            console.log(`⚠ Animal ${animal.id_public} Record ${record.id}: Could not parse matingDates: "${record.matingDates}"`);
                            recordErrors++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error processing breeding record ${record.id}:`, error.message);
                    recordErrors++;
                }
            }

            // Save animal if any breeding records were updated
            if (updated) {
                await animal.save();
            }
        }

        console.log('\n📈 Breeding Record Migration Summary:');
        console.log(`   ✅ Migrated from matingDates: ${recordsMigrated}`);
        console.log(`   ⏭  Skipped (already set): ${recordsSkipped}`);
        console.log(`   ❌ Errors: ${recordErrors}`);

        // ====================
        // VERIFICATION
        // ====================
        console.log('\n📊 VERIFICATION\n');

        const littersWithMatingDate = await Litter.countDocuments({ matingDate: { $exists: true, $ne: null } });
        const littersWithPairingDate = await Litter.countDocuments({ pairingDate: { $exists: true, $ne: null } });
        const littersWithMatingDates = await Litter.countDocuments({ matingDates: { $exists: true, $ne: null } });

        console.log('Litters:');
        console.log(`   📅 With matingDate: ${littersWithMatingDate}`);
        console.log(`   📅 With pairingDate: ${littersWithPairingDate}`);
        console.log(`   📅 With matingDates: ${littersWithMatingDates}`);

        const animalsWithMatingDateInRecords = await Animal.countDocuments({ 
            'breedingRecords.matingDate': { $exists: true, $ne: null } 
        });
        const animalsWithMatingDatesInRecords = await Animal.countDocuments({ 
            'breedingRecords.matingDates': { $exists: true, $ne: null } 
        });

        console.log('\nBreeding Records:');
        console.log(`   📅 Animals with matingDate in records: ${animalsWithMatingDateInRecords}`);
        console.log(`   📅 Animals with matingDates in records: ${animalsWithMatingDatesInRecords}`);

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run migration
migrateMatingDates().catch(console.error);
