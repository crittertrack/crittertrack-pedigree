require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    const ctu1 = await User.findOne({ id_public: 'CTU1' });
    const ctu2 = await User.findOne({ id_public: 'CTU2' });

    if (!ctu1 || !ctu2) {
      console.error('CTU1 or CTU2 not found');
      process.exit(1);
    }

    console.log('=== MIGRATING V14-F1 (CTC575) FROM CTU1 TO CTU2 ===\n');

    // Find the animal
    const animal = await Animal.findOne({ name: 'V14-F1' });
    
    if (!animal) {
      console.error('Animal V14-F1 not found');
      process.exit(1);
    }

    console.log(`Found: ${animal.id_public} - ${animal.name}`);
    console.log(`Current owner: CTU1\n`);

    // Transfer ownership to CTU2
    animal.ownerId = ctu2._id;
    animal.breederId_public = animal.breederId_public || 'CTU1'; // Keep original breeder info
    
    // Add CTU1 to view-only users if not already there
    if (!animal.viewOnlyForUsers.includes(ctu1._id)) {
      animal.viewOnlyForUsers.push(ctu1._id);
    }
    
    // Mark transfer status
    animal.transferStatus = 'accepted';
    animal.soldStatus = 'purchased';
    
    await animal.save();
    console.log('✓ Transferred ownership to CTU2');
    console.log('✓ Added CTU1 to view-only access');
    console.log('✓ Marked as purchased\n');

    // Create public record
    const existingPublic = await PublicAnimal.findOne({ id_public: animal.id_public });
    if (existingPublic) {
      // Update existing
      existingPublic.ownerId_public = 'CTU2';
      await existingPublic.save();
      console.log('✓ Updated existing PublicAnimal record to CTU2 owner');
    } else {
      // Create new
      await PublicAnimal.create({
        ownerId_public: 'CTU2',
        id_public: animal.id_public,
        species: animal.species,
        prefix: animal.prefix || '',
        suffix: animal.suffix || '',
        name: animal.name,
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
      });
      console.log('✓ Created new PublicAnimal record for CTU2');
    }

    console.log('\n=== VERIFICATION ===');
    const updated = await Animal.findOne({ name: 'V14-F1' }).populate('ownerId', 'id_public').lean();
    console.log(`Owner: ${updated.ownerId.id_public}`);
    console.log(`View-only users: ${updated.viewOnlyForUsers.length}`);
    const hasPublic = await PublicAnimal.findOne({ id_public: animal.id_public }).lean();
    console.log(`Has public record: ${!!hasPublic}`);
    
    if (updated.ownerId.id_public === 'CTU2' && hasPublic?.ownerId_public === 'CTU2') {
      console.log('\n✅ Migration complete!');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
