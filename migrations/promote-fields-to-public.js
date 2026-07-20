/**
 * Migration: Expand PublicAnimal schema to include ~55 fields from audit
 * Purpose: Move fields from owner-only to public (no configurability)
 * 
 * Fields being promoted to PUBLIC:
 * - Health records (vaccinations, medications, allergies, genetic tests, etc.)
 * - Behavior/Safety (aggression, bite history, prey drive, food aggression, training)
 * - Reproduction (breeding records, fertility, offspring, breeding role, restrictions)
 * - Care/Husbandry (housing, exercise requirements, grooming, training status)
 * - Show/Awards (shows, working titles)
 * - Legal/Restrictions (breeding/export restrictions, buyback clause)
 * 
 * This migration:
 * 1. Adds fields to PublicAnimalSchema in database
 * 2. Syncs existing animals' data from Animal to PublicAnimal
 * 3. Maps Animal fields → PublicAnimal fields
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

const { PublicAnimal, Animal } = require('../database/models');

// List of fields to sync (Animal → PublicAnimal)
const FIELDS_TO_SYNC = [
  // Health Records (arrays - copy as-is)
  'vaccinations',
  'medications',
  'medicalConditions',
  'allergies',
  'labResults',
  'vetVisits',
  'parasiteControl',
  'dewormingRecords',
  'healthClearances',
  'parasitePreventionSchedule',
  
  // Health Status (simple fields)
  'spayNeuterDate',
  'isNeutered',
  'heartwormStatus',
  'hipElbowScores',
  'geneticTestResults',
  'eyeClearance',
  'cardiacClearance',
  
  // Behavior & Safety
  'aggressionLevel',
  'aggressionTriggers',
  'fearAnxietyLevel',
  'preyDriveLevel',
  'biteHistory',
  'foodAggressionLevel',
  'reactivityNotes',
  
  // Training
  'trainingLevel',
  'trainingDisciplines',
  'certifications',
  'workingRole',
  
  // Reproduction & Breeding
  'breedingRole',
  'lastMatingDate',
  'successfulMatings',
  'lastPregnancyDate',
  'offspringCount',
  'fertilityStatus',
  'fertilityNotes',
  'damFertilityStatus',
  'damFertilityNotes',
  'breedingRecords', // Array
  'artificialInseminationUsed',
  
  // Care & Husbandry
  'housingType',
  'bedding',
  'temperatureRange',
  'humidity',
  'lighting',
  'exerciseRequirements',
  'dailyExerciseMinutes',
  'groomingNeeds',
  'sheddingLevel',
  'crateTrained',
  'litterTrained',
  'leashTrained',
  
  // Shows & Awards
  'shows', // Array (ShowEventSchema)
  'workingTitles',
  
  // Legal & Restrictions
  'breedingRestrictions',
  'exportRestrictions',
  'breederBuybackClause',
  'reproductiveClearances',
  
  // Marketplace Listing
  'isForSale',
  'availableForBreeding',
  'salePriceAmount',
  'salePriceCurrency',
  'studFeeAmount',
  'studFeeCurrency',
  
  // List 3: Collaboration Features
  'careTasks',
  'publicRemarks',
  'tags',
  'originalCreatorId_public',
  'originalBreederName',
  'feedingSchedule',
  'supplements',
  'growthRecords',
  'insurance',
];

async function migratePublicAnimalSchema() {
  try {
    console.log('[MIGRATION] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[MIGRATION] Connected to MongoDB');

    // Check current PublicAnimal count
    const publicAnimalCount = await PublicAnimal.countDocuments();
    console.log(`[MIGRATION] Found ${publicAnimalCount} PublicAnimal records`);

    if (publicAnimalCount === 0) {
      console.log('[MIGRATION] No PublicAnimals to migrate. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Get sample of existing PublicAnimals to check schema
    const sample = await PublicAnimal.findOne().lean();
    if (sample) {
      console.log('[MIGRATION] Sample PublicAnimal fields:', Object.keys(sample).slice(0, 20));
    }

    // Perform bulk sync: For each Animal with isDisplay=true, sync to PublicAnimal
    const animalsToSync = await Animal.find({ isDisplay: true }).select(['id_public', ...FIELDS_TO_SYNC]).lean();
    
    console.log(`[MIGRATION] Found ${animalsToSync.length} animals with isDisplay=true to sync`);

    let updated = 0;
    let errors = 0;

    for (const animal of animalsToSync) {
      try {
        const updateData = {};
        
        // Build update object with only fields that have values
        for (const field of FIELDS_TO_SYNC) {
          if (animal[field] !== undefined && animal[field] !== null) {
            updateData[field] = animal[field];
          }
        }

        if (Object.keys(updateData).length === 0) {
          continue; // Skip if no data to update
        }

        const result = await PublicAnimal.updateOne(
          { id_public: animal.id_public },
          { $set: updateData },
          { upsert: false }
        );

        if (result.modifiedCount > 0) {
          updated++;
          if (updated % 100 === 0) {
            console.log(`[MIGRATION] Synced ${updated} animals...`);
          }
        }
      } catch (err) {
        errors++;
        console.error(`[MIGRATION] Error syncing ${animal.id_public}:`, err.message);
      }
    }

    console.log(`[MIGRATION] Sync complete:`);
    console.log(`  - Updated: ${updated}`);
    console.log(`  - Errors: ${errors}`);
    console.log('[MIGRATION] Fields promoted to public:');
    FIELDS_TO_SYNC.forEach(f => console.log(`  - ${f}`));

  } catch (error) {
    console.error('[MIGRATION] Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('[MIGRATION] Disconnected');
  }
}

// Run migration
migratePublicAnimalSchema();
