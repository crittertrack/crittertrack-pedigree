require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const transferredAnimals = [
  'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564',
  'CTC565', 'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
];

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    console.log('=== STEP 1: Checking for duplicates ===\n');
    
    let totalDuplicates = 0;
    for (const animalId of transferredAnimals) {
      const publicRecords = await PublicAnimal.find({ id_public: animalId }).lean();
      if (publicRecords.length > 1) {
        console.log(`${animalId}: Found ${publicRecords.length} public records`);
        publicRecords.forEach((r, i) => {
          console.log(`  [${i}] _id: ${r._id}, owner: ${r.ownerId_public}`);
        });
        totalDuplicates += publicRecords.length - 1;
      }
    }
    
    if (totalDuplicates === 0) {
      console.log('✓ No duplicates found');
    } else {
      console.log(`\n⚠️  Found ${totalDuplicates} duplicate records to delete`);
    }

    console.log('\n=== STEP 2: Removing duplicate PublicAnimal records ===\n');
    
    let deletedCount = 0;
    for (const animalId of transferredAnimals) {
      const publicRecords = await PublicAnimal.find({ id_public: animalId }).lean();
      
      if (publicRecords.length > 1) {
        // Sort by owner preference: CTU5 first
        const ctu5Record = publicRecords.find(r => r.ownerId_public === 'CTU5');
        const recordsToDelete = publicRecords.filter(r => r._id.toString() !== ctu5Record._id.toString());
        
        for (const record of recordsToDelete) {
          await PublicAnimal.deleteOne({ _id: record._id });
          console.log(`✓ Deleted duplicate for ${animalId} (owner: ${record.ownerId_public})`);
          deletedCount++;
        }
      }
    }
    
    console.log(`\nTotal deleted: ${deletedCount}`);

    console.log('\n=== STEP 3: Syncing all fields from Animal to PublicAnimal ===\n');
    
    let updatedCount = 0;
    for (const animalId of transferredAnimals) {
      const animal = await Animal.findOne({ id_public: animalId }).lean();
      const publicAnimal = await PublicAnimal.findOne({ id_public: animalId }).lean();
      
      if (!animal) {
        console.log(`✗ ${animalId}: Animal not found`);
        continue;
      }
      
      if (!publicAnimal) {
        console.log(`✗ ${animalId}: PublicAnimal not found`);
        continue;
      }
      
      // Update PublicAnimal with all fields from Animal
      const updateData = {
        ownerId_public: 'CTU5',
        prefix: animal.prefix || '',
        suffix: animal.suffix || '',
        name: animal.name,
        species: animal.species,
        gender: animal.gender || '',
        birthDate: animal.birthDate || null,
        deceasedDate: animal.deceasedDate || null,
        breederyId: animal.breederyId || '',
        status: animal.status || 'Pet',
        color: animal.color || '',
        coat: animal.coat || '',
        coatPattern: animal.coatPattern || '',
        earset: animal.earset || '',
        lifeStage: animal.lifeStage || null,
        breederId_public: animal.breederId_public || null,
        isOwned: animal.isOwned !== undefined ? animal.isOwned : true,
        isPregnant: animal.isPregnant || false,
        isNursing: animal.isNursing || false,
        isInMating: animal.isInMating || false,
        isForSale: animal.isForSale || false,
        salePriceCurrency: animal.salePriceCurrency || 'USD',
        salePriceAmount: animal.salePriceAmount || null,
        availableForBreeding: animal.availableForBreeding || false,
        studFeeCurrency: animal.studFeeCurrency || 'USD',
        studFeeAmount: animal.studFeeAmount || null,
        tags: animal.tags || [],
        imageUrl: animal.imageUrl || null,
        photoUrl: animal.photoUrl || null,
        sireId_public: animal.sireId_public || null,
        damId_public: animal.damId_public || null,
        remarks: animal.remarks || '',
        geneticCode: animal.geneticCode || '',
        microchipNumber: animal.microchipNumber || null,
        pedigreeRegistrationId: animal.pedigreeRegistrationId || null,
        breed: animal.breed || null,
        strain: animal.strain || null,
        origin: animal.origin || null,
        isNeutered: animal.isNeutered || false,
        heatStatus: animal.heatStatus || null,
        lastHeatDate: animal.lastHeatDate || null,
        ovulationDate: animal.ovulationDate || null,
        matingDates: animal.matingDates || null,
        expectedDueDate: animal.expectedDueDate || null,
        litterCount: animal.litterCount || null,
        nursingStartDate: animal.nursingStartDate || null,
        weaningDate: animal.weaningDate || null,
        growthRecords: animal.growthRecords || [],
        measurementUnits: animal.measurementUnits || { weight: 'g', length: 'cm' },
        dietType: animal.dietType || null,
        feedingSchedule: animal.feedingSchedule || null,
        supplements: animal.supplements || null,
        housingType: animal.housingType || null,
        bedding: animal.bedding || null,
        enrichment: animal.enrichment || null,
        temperatureRange: animal.temperatureRange || null,
        humidity: animal.humidity || null,
        lighting: animal.lighting || null,
        noise: animal.noise || null,
        vaccinations: animal.vaccinations || null,
        dewormingRecords: animal.dewormingRecords || null,
        parasiteControl: animal.parasiteControl || null,
        medicalConditions: animal.medicalConditions || null,
        allergies: animal.allergies || null,
        medications: animal.medications || null,
        medicalProcedures: animal.medicalProcedures || null,
        labResults: animal.labResults || null,
        vetVisits: animal.vetVisits || null,
        primaryVet: animal.primaryVet || null,
        temperament: animal.temperament || null,
        handlingTolerance: animal.handlingTolerance || null,
        socialStructure: animal.socialStructure || null,
        activityCycle: animal.activityCycle || null,
        causeOfDeath: animal.causeOfDeath || null,
        necropsyResults: animal.necropsyResults || null,
        insurance: animal.insurance || null,
        legalStatus: animal.legalStatus || null,
        isDisplay: animal.isDisplay || animal.showOnPublicProfile || false,
        sectionPrivacy: animal.sectionPrivacy || {},
        inbreedingCoefficient: animal.inbreedingCoefficient || null,
        includeRemarks: animal.includeRemarks || false,
        includeGeneticCode: animal.includeGeneticCode || false
      };
      
      await PublicAnimal.updateOne({ id_public: animalId }, updateData);
      console.log(`✓ ${animalId}: Synced all fields (prefix: "${animal.prefix || '(none)'}"`);
      updatedCount++;
    }
    
    console.log(`\nTotal updated: ${updatedCount}`);

    console.log('\n=== STEP 4: Verifying final state ===\n');
    
    let issuesFound = false;
    for (const animalId of transferredAnimals) {
      const animal = await Animal.findOne({ id_public: animalId }).lean();
      const publicAnimals = await PublicAnimal.find({ id_public: animalId }).lean();
      
      if (publicAnimals.length !== 1) {
        console.log(`✗ ${animalId}: Still has ${publicAnimals.length} public records (should be 1)`);
        issuesFound = true;
      } else if (publicAnimals[0].ownerId_public !== 'CTU5') {
        console.log(`✗ ${animalId}: Wrong owner ${publicAnimals[0].ownerId_public} (should be CTU5)`);
        issuesFound = true;
      } else if (publicAnimals[0].prefix !== (animal?.prefix || '')) {
        console.log(`✗ ${animalId}: Prefix mismatch "${publicAnimals[0].prefix}" vs "${animal?.prefix || '(none)'}"`);
        issuesFound = true;
      } else {
        console.log(`✓ ${animalId}: OK (owner: CTU5, prefix: "${animal?.prefix || '(none)'}"`);
      }
    }
    
    if (!issuesFound) {
      console.log('\n✅ All animals verified - no issues found');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
