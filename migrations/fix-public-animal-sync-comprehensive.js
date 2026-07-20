/**
 * Fix PublicAnimal sync inconsistencies
 * Finds all animals with isDisplay=true and ensures they have corresponding PublicAnimal records
 * 
 * Usage: node migrations/fix-public-animal-sync-comprehensive.js [--fix]
 * 
 * Without --fix: runs in dry-run mode (shows what would be fixed)
 * With --fix: actually creates/updates PublicAnimal records
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { Animal, PublicAnimal, User } = require('../database/models');

const DRY_RUN = !process.argv.includes('--fix');

// All 87 fields that should be synced to PublicAnimal
const FIELDS_TO_SYNC = [
    // Basic identification
    'id_public', 'name', 'prefix', 'suffix', 'species', 'gender', 'birthDate', 'lifeStage',
    'breederAssignedId', 'ringId', 'eartagNumber', 'microchipNumber',
    
    // Appearance (List 1: PROMOTED TO PUBLIC)
    'color', 'coatPattern', 'coat', 'earset', 'phenotype', 'morph', 'markings',
    'eyeColor', 'nailColor', 'size', 'weight', 'length',
    
    // Genetic info (List 1: PROMOTED TO PUBLIC)
    'geneticCode', 'carrierTraits', 'inbreedingCoefficient',
    
    // Health Records (List 1: PROMOTED TO PUBLIC)
    'vaccinations', 'medications', 'allergies', 'medicalHistory', 'medicalConditions',
    'healthStatus', 'quarantineStatus',
    
    // Breeding info (List 1: PROMOTED TO PUBLIC)
    'sireId_public', 'damId_public', 'breederId_public', 'breederName', 'manualBreederName',
    
    // Care (List 1: PROMOTED TO PUBLIC)
    'diet', 'dietNotes', 'enrichment', 'enclosureType', 'enclosureId',
    'lightingSchedule', 'temperatureRange', 'humidity',
    
    // Training (List 1: PROMOTED TO PUBLIC)
    'trainingLevel', 'trainingNotes', 'commands', 'tricks',
    
    // Shows/Awards (List 1: PROMOTED TO PUBLIC)
    'showsParticipated', 'awards', 'certifications',
    
    // Legal/Restrictions (List 1: PROMOTED TO PUBLIC)
    'legalStatus', 'permits', 'restrictions', 'registrations',
    
    // Behavior & Safety (List 1: PROMOTED TO PUBLIC)
    'aggressionLevel', 'fearAnxietyLevel', 'preyDriveLevel', 'biteHistory',
    
    // Images
    'imageUrl', 'photoUrl',
    
    // Status
    'status', 'isPregnant', 'isNursing', 'isInMating', 'isPlannedMating',
    'isQuarantine', 'isInTreatment',
    
    // Marketplace Listing (List 2: PUBLIC)
    'isForSale', 'availableForBreeding', 'salePriceAmount', 'salePriceCurrency',
    'studFeeAmount', 'studFeeCurrency',
    
    // List 3: Collaboration Features (PUBLIC)
    'careTasks', 'publicRemarks', 'tags', 'originalCreatorId', 'originalBreederName',
    'feedingSchedule', 'supplements', 'growthRecords', 'insurance',
];

async function fixPublicAnimalSync() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`\n🔍 Starting PublicAnimal sync fix (${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'})\n`);

        // Find all animals with isDisplay/showOnPublicProfile = true
        const displayAnimals = await Animal.find({ showOnPublicProfile: true })
            .select('_id id_public creatorId showOnPublicProfile')
            .lean();

        console.log(`📊 Found ${displayAnimals.length} animals marked for public display\n`);

        // Get their PublicAnimal records
        const publicAnimalIds = await PublicAnimal.find({
            _id: { $in: displayAnimals.map(a => a._id) }
        }).select('_id').lean();
        const publicIdSet = new Set(publicAnimalIds.map(p => p._id.toString()));

        // Find inconsistencies
        const needsSync = displayAnimals.filter(a => !publicIdSet.has(a._id.toString()));

        console.log(`⚠️  Missing PublicAnimal records: ${needsSync.length}`);
        
        if (needsSync.length > 0) {
            console.log(`\nTop 10 animals needing sync:`);
            needsSync.slice(0, 10).forEach((a, i) => {
                console.log(`  ${i + 1}. ${a.id_public}`);
            });
        }

        if (DRY_RUN) {
            console.log('\n📋 DRY RUN MODE - No changes will be made');
            console.log(`\nTo fix these ${needsSync.length} records, run:`);
            console.log('  node migrations/fix-public-animal-sync-comprehensive.js --fix\n');
            process.exit(0);
        }

        // LIVE MODE: Create missing PublicAnimal records
        if (needsSync.length === 0) {
            console.log('\n✅ All public animals have PublicAnimal records. No sync needed.\n');
            process.exit(0);
        }

        console.log(`\n🔄 Creating ${needsSync.length} missing PublicAnimal records...\n`);

        let created = 0;
        let errors = 0;

        for (const animal of needsSync) {
            try {
                const fullAnimal = await Animal.findById(animal._id).lean();
                if (!fullAnimal) {
                    console.log(`⚠️  ${animal.id_public}: Animal not found (deleted?)`);
                    continue;
                }

                // Build publicAnimalData with all 87 fields
                const publicAnimalData = {
                    _id: fullAnimal._id,
                    id_public: fullAnimal.id_public,
                };

                FIELDS_TO_SYNC.forEach(field => {
                    if (field === '_id' || field === 'id_public') return;
                    publicAnimalData[field] = fullAnimal[field] ?? null;
                });

                // Upsert to ensure we create or update
                await PublicAnimal.findByIdAndUpdate(
                    fullAnimal._id,
                    { $set: publicAnimalData },
                    { upsert: true, new: true }
                );

                created++;
                if (created % 50 === 0) {
                    process.stdout.write(`  Created ${created}/${needsSync.length}...\r`);
                }
            } catch (err) {
                console.error(`❌ ${animal.id_public}: ${err.message}`);
                errors++;
            }
        }

        console.log(`\n✅ Created: ${created}/${needsSync.length}`);
        if (errors > 0) console.log(`⚠️  Errors: ${errors}`);

        // Verify fix
        console.log(`\n🔍 Verifying fix...\n`);
        const verifyAnimals = await Animal.find({ showOnPublicProfile: true }).countDocuments();
        const verifyPublic = await PublicAnimal.find({
            _id: { $in: (await Animal.find({ showOnPublicProfile: true }).select('_id')).map(a => a._id) }
        }).countDocuments();

        console.log(`📊 Final status:`);
        console.log(`  - Animals with showOnPublicProfile=true: ${verifyAnimals}`);
        console.log(`  - PublicAnimal records synced: ${verifyPublic}`);
        console.log(`  - Match: ${verifyAnimals === verifyPublic ? '✅ YES' : '❌ NO'}\n`);

        if (verifyAnimals === verifyPublic) {
            console.log('✅ PublicAnimal sync is now complete!\n');
        } else {
            console.log('⚠️  Some inconsistencies remain\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixPublicAnimalSync();
