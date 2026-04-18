/**
 * Migration: Move sireId_public/damId_public to manualPedigree.sire/dam
 * 
 * This script consolidates parent data to the beta pedigree system (manualPedigree).
 * For each animal with sireId_public or damId_public:
 * 1. Fetch the parent animal data
 * 2. Populate manualPedigree.sire or manualPedigree.dam with full details
 * 3. Keep the old fields for now (backwards compat), but UI will use manualPedigree
 */

const mongoose = require('mongoose');
const path = require('path');

// Load models
const modelPath = path.join(__dirname, '../database/models.js');
const { Animal } = require(modelPath);

// Load env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';

async function migrateParentsToManualPedigree() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected');

        // Find all animals with sireId_public or damId_public
        const animalsWithParents = await Animal.find({
            $or: [
                { sireId_public: { $ne: null, $exists: true } },
                { damId_public: { $ne: null, $exists: true } },
                { fatherId_public: { $ne: null, $exists: true } },
                { motherId_public: { $ne: null, $exists: true } }
            ]
        }).lean();

        console.log(`\n📊 Found ${animalsWithParents.length} animals with linked parents\n`);

        let processed = 0;
        let skipped = 0;
        let updated = 0;

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

        for (const animal of animalsWithParents) {
            try {
                let needsUpdate = false;
                const updates = {};

                // Resolve which parent IDs to use (fatherId_public/motherId_public are newer fallbacks)
                const sireId = animal.sireId_public || animal.fatherId_public;
                const damId = animal.damId_public || animal.motherId_public;

                // Initialize manualPedigree if needed
                if (!animal.manualPedigree) {
                    updates.manualPedigree = {};
                } else {
                    updates.manualPedigree = { ...animal.manualPedigree };
                }

                // Fetch parent animals for enrichment (declare outside if blocks so they're available for grandparent logic)
                let sireData = null;
                let damData = null;

                // Migrate sire
                if (sireId && (!updates.manualPedigree.sire || !updates.manualPedigree.sire.ctcId)) {
                    sireData = await Animal.findOne({ id_public: sireId }).lean();
                    if (sireData) {
                        updates.manualPedigree.sire = buildSlot(sireData, 'Male');
                        needsUpdate = true;
                    }
                }

                // Migrate dam
                if (damId && (!updates.manualPedigree.dam || !updates.manualPedigree.dam.ctcId)) {
                    damData = await Animal.findOne({ id_public: damId }).lean();
                    if (damData) {
                        updates.manualPedigree.dam = buildSlot(damData, 'Female');
                        needsUpdate = true;
                    }
                }
                
                // Also migrate grandparents if they exist in linked ancestry and not in manual pedigree
                if (sireData) {
                    if (sireData.sireId_public && (!updates.manualPedigree.sireSire || !updates.manualPedigree.sireSire.ctcId)) {
                        const sireSireData = await Animal.findOne({ id_public: sireData.sireId_public }).lean();
                        if (sireSireData) {
                            updates.manualPedigree.sireSire = buildSlot(sireSireData, 'Male');
                            needsUpdate = true;
                        }
                    }
                    if (sireData.damId_public && (!updates.manualPedigree.sireDam || !updates.manualPedigree.sireDam.ctcId)) {
                        const sireDamData = await Animal.findOne({ id_public: sireData.damId_public }).lean();
                        if (sireDamData) {
                            updates.manualPedigree.sireDam = buildSlot(sireDamData, 'Female');
                            needsUpdate = true;
                        }
                    }
                }
                
                if (damData) {
                    if (damData.sireId_public && (!updates.manualPedigree.damSire || !updates.manualPedigree.damSire.ctcId)) {
                        const damSireData = await Animal.findOne({ id_public: damData.sireId_public }).lean();
                        if (damSireData) {
                            updates.manualPedigree.damSire = buildSlot(damSireData, 'Male');
                            needsUpdate = true;
                        }
                    }
                    if (damData.damId_public && (!updates.manualPedigree.damDam || !updates.manualPedigree.damDam.ctcId)) {
                        const damDamData = await Animal.findOne({ id_public: damData.damId_public }).lean();
                        if (damDamData) {
                            updates.manualPedigree.damDam = buildSlot(damDamData, 'Female');
                            needsUpdate = true;
                        }
                    }
                }

                if (needsUpdate) {
                    await Animal.updateOne(
                        { _id: animal._id },
                        { $set: { manualPedigree: updates.manualPedigree } }
                    );
                    updated++;
                    const parentSummary = [];
                    if (sireData) parentSummary.push(`sire=${sireData.id_public}`);
                    if (damData) parentSummary.push(`dam=${damData.id_public}`);
                    console.log(`✅ [${animal.id_public}] ${animal.name}: Migrated ${parentSummary.join(', ')}`);
                } else {
                    skipped++;
                }

                processed++;
                if (processed % 100 === 0) {
                    console.log(`⏳ Processed: ${processed}/${animalsWithParents.length}`);
                }
            } catch (error) {
                console.error(`❌ Error migrating ${animal.id_public}: ${error.message}`);
            }
        }

        console.log(`\n📈 Migration Complete:`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⊘ Skipped: ${skipped}`);
        console.log(`   📋 Total Processed: ${processed}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

migrateParentsToManualPedigree();
