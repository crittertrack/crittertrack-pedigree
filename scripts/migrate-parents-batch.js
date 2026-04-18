/**
 * Batch migration: Process animals in smaller chunks to avoid memory/query issues
 */
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';

async function migrateInBatches() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected');

        const modelPath = path.join(__dirname, '../database/models.js');
        const { Animal } = require(modelPath);

        const BATCH_SIZE = 100;
        
        // Count total animals with parents
        console.log('📊 Counting animals with linked parents...');
        const totalCount = await Animal.countDocuments({
            $or: [
                { sireId_public: { $ne: null, $exists: true } },
                { damId_public: { $ne: null, $exists: true } }
            ]
        });
        
        console.log(`\n📊 Found ${totalCount} animals with linked parents`);
        console.log(`⚡ Processing in batches of ${BATCH_SIZE}\n`);

        let processed = 0;
        let updated = 0;
        let skipped = 0;

        const buildSlot = (animalData, gender) => ({
            mode: 'ctc',
            ctcId: animalData.id_public || '',
            prefix: animalData.prefix || '',
            name: animalData.name || '',
            suffix: animalData.suffix || '',
            variety: ['color', 'coatPattern', 'coat', 'earset', 'phenotype', 'morph', 'markings']
                .map(k => animalData[k])
                .filter(Boolean)
                .join(' '),
            genCode: animalData.geneticCode || '',
            birthDate: animalData.birthDate ? String(animalData.birthDate).slice(0, 10) : '',
            breederName: animalData.breederName || animalData.manualBreederName || '',
            gender,
            imageUrl: animalData.imageUrl || animalData.photoUrl || '',
            notes: ''
        });

        // Process in batches using skip/limit
        for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
            console.log(`⏳ Processing batch: ${skip}-${Math.min(skip + BATCH_SIZE, totalCount)}...`);
            
            const batch = await Animal.find({
                $or: [
                    { sireId_public: { $ne: null, $exists: true } },
                    { damId_public: { $ne: null, $exists: true } }
                ]
            })
                .skip(skip)
                .limit(BATCH_SIZE)
                .lean();

            // Pre-load parent data for this batch
            const parentIds = new Set();
            for (const animal of batch) {
                if (animal.sireId_public) parentIds.add(animal.sireId_public);
                if (animal.damId_public) parentIds.add(animal.damId_public);
            }

            const parentCache = {};
            if (parentIds.size > 0) {
                const parents = await Animal.find({ id_public: { $in: Array.from(parentIds) } }).lean();
                for (const parent of parents) {
                    parentCache[parent.id_public] = parent;
                }
            }

            // Process each animal in batch
            for (const animal of batch) {
                try {
                    let needsUpdate = false;
                    const updates = {};

                    if (!animal.manualPedigree) {
                        updates.manualPedigree = {};
                    } else {
                        updates.manualPedigree = { ...animal.manualPedigree };
                    }

                    // Migrate sire
                    if (animal.sireId_public && (!updates.manualPedigree.sire || !updates.manualPedigree.sire.ctcId)) {
                        const sireData = parentCache[animal.sireId_public];
                        if (sireData) {
                            updates.manualPedigree.sire = buildSlot(sireData, 'Male');
                            needsUpdate = true;
                        }
                    }

                    // Migrate dam
                    if (animal.damId_public && (!updates.manualPedigree.dam || !updates.manualPedigree.dam.ctcId)) {
                        const damData = parentCache[animal.damId_public];
                        if (damData) {
                            updates.manualPedigree.dam = buildSlot(damData, 'Female');
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        await Animal.updateOne(
                            { _id: animal._id },
                            { $set: { manualPedigree: updates.manualPedigree } }
                        );
                        updated++;
                    } else {
                        skipped++;
                    }

                    processed++;
                } catch (err) {
                    console.error(`❌ Error processing ${animal.id_public}: ${err.message}`);
                }
            }

            console.log(`✅ Batch complete: Updated=${updated}, Skipped=${skipped}, Processed=${processed}/${totalCount}\n`);
        }

        console.log(`\n🎉 Migration Complete:`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⊘ Skipped: ${skipped}`);
        console.log(`   📋 Total: ${processed}/${totalCount}`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

migrateInBatches();
