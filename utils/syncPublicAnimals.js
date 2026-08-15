/**
 * Utility function to sync an animal to the publicanimals collection
 * When public, all data is synced (simplified single privacy toggle)
 */

// Single source of truth for which Animal fields are mirrored into PublicAnimal.
// Used by resyncAnimalToPublic()/resyncAnimalToPublicById() below, which any route
// that writes to Animal directly (bypassing updateAnimal()) should call afterward so
// PublicAnimal never drifts stale again.
const buildPublicAnimalFields = (a) => ({
    creatorId_public: a.creatorId_public,
    id_public: a.id_public,
    species: a.species,
    prefix: a.prefix,
    suffix: a.suffix,
    name: a.name,
    gender: a.gender,
    birthDate: a.birthDate,
    deceasedDate: a.deceasedDate || null,
    color: a.color,
    coat: a.coat,
    coatPattern: a.coatPattern || null,
    manualownerName: a.manualownerName || null,
    earset: a.earset || null,
    status: a.status || null,
    lifeStage: a.lifeStage || null,
    carrierTraits: a.carrierTraits || null,
    morph: a.morph || null,
    markings: a.markings || null,
    eyeColor: a.eyeColor || null,
    nailColor: a.nailColor || null,
    size: a.size || null,
    weight: a.weight || null,
    length: a.length || null,
    breederId_public: a.breederId_public || null,
    manualBreederName: a.manualBreederName || null,
    imageUrl: a.imageUrl || null,
    photoUrl: a.photoUrl || null,
    sireId_public: a.sireId_public || null,
    damId_public: a.damId_public || null,
    isOwned: a.isOwned || false,
    isPregnant: a.isPregnant || false,
    isNursing: a.isNursing || false,
    isInMating: a.isInMating || false,
    isPlannedMating: a.isPlannedMating || false,
    isForSale: a.isForSale || false,
    availableForBreeding: a.availableForBreeding || false,
    salePriceAmount: a.salePriceAmount || null,
    salePriceCurrency: a.salePriceCurrency || 'USD',
    studFeeAmount: a.studFeeAmount || null,
    studFeeCurrency: a.studFeeCurrency || 'USD',
    publicRemarks: a.publicRemarks || null,
    tags: a.tags || [],
    originalCreatorId_public: a.originalCreatorId_public || null,
    originalBreederName: a.originalBreederName || null,
    remarks: a.remarks || '',
    geneticCode: a.geneticCode || null,
    isDisplay: a.isDisplay || false,
    microchipNumber: a.microchipNumber || '',
    pedigreeRegistrationId: a.pedigreeRegistrationId || '',
    identifiers: a.identifiers || null,
    ringId: a.ringId || '',
    eartagNumber: a.eartagNumber || '',
    breed: a.breed || null,
    strain: a.strain || null,
    origin: a.origin || null,
    vaccinations: a.vaccinations || [],
    medications: a.medications || [],
    medicalConditions: a.medicalConditions || [],
    allergies: a.allergies || [],
    labResults: a.labResults || [],
    vetVisits: a.vetVisits || [],
    parasiteControl: a.parasiteControl || [],
    dewormingRecords: a.dewormingRecords || [],
    healthClearances: a.healthClearances || [],
    parasitePreventionSchedule: a.parasitePreventionSchedule || [],
    spayNeuterDate: a.spayNeuterDate || null,
    isNeutered: a.isNeutered || false,
    heartwormStatus: a.heartwormStatus || null,
    hipElbowScores: a.hipElbowScores || null,
    geneticTestResults: a.geneticTestResults || null,
    eyeClearance: a.eyeClearance || null,
    cardiacClearance: a.cardiacClearance || null,
    aggressionLevel: a.aggressionLevel || 3,
    aggressionTriggers: a.aggressionTriggers || null,
    fearAnxietyLevel: a.fearAnxietyLevel || 3,
    preyDriveLevel: a.preyDriveLevel || 'Unknown',
    biteHistory: a.biteHistory || null,
    foodAggressionLevel: a.foodAggressionLevel || 'None',
    reactivityNotes: a.reactivityNotes || null,
    temperament: a.temperament || null,
    handlingTolerance: a.handlingTolerance || null,
    trainingLevel: a.trainingLevel || null,
    trainingDisciplines: a.trainingDisciplines || null,
    certifications: a.certifications || null,
    workingRole: a.workingRole || null,
    breedingRole: a.breedingRole || null,
    lastMatingDate: a.lastMatingDate || null,
    successfulMatings: a.successfulMatings || null,
    lastPregnancyDate: a.lastPregnancyDate || null,
    offspringCount: a.offspringCount || null,
    fertilityStatus: a.fertilityStatus || 'Unknown',
    fertilityNotes: a.fertilityNotes || null,
    breedingRecords: a.breedingRecords || [],
    artificialInseminationUsed: a.artificialInseminationUsed || null,
    reproductiveClearances: a.reproductiveClearances || null,
    heatStatus: a.heatStatus || null,
    lastHeatDate: a.lastHeatDate || null,
    ovulationDate: a.ovulationDate || null,
    expectedDueDate: a.expectedDueDate || null,
    litterCount: a.litterCount || null,
    litterSizeBorn: a.litterSizeBorn || null,
    litterSizeWeaned: a.litterSizeWeaned || null,
    stillbornCount: a.stillbornCount || null,
    lossesCount: a.lossesCount || null,
    dietType: a.dietType || null,
    feedingSchedule: a.feedingSchedule || null,
    supplements: a.supplements || null,
    housingType: a.housingType || null,
    bedding: a.bedding || null,
    enrichment: a.enrichment || null,
    temperatureRange: a.temperatureRange || '',
    humidity: a.humidity || '',
    lighting: a.lighting || '',
    noise: a.noise || '',
    exerciseRequirements: a.exerciseRequirements || null,
    dailyExerciseMinutes: a.dailyExerciseMinutes || null,
    groomingNeeds: a.groomingNeeds || null,
    sheddingLevel: a.sheddingLevel || null,
    crateTrained: a.crateTrained || null,
    litterTrained: a.litterTrained || null,
    leashTrained: a.leashTrained || null,
    shows: a.shows || [],
    workingTitles: a.workingTitles || null,
    breedingRestrictions: a.breedingRestrictions || null,
    exportRestrictions: a.exportRestrictions || null,
    breederBuybackClause: a.breederBuybackClause || null,
    socialStructure: a.socialStructure || null,
    activityCycle: a.activityCycle || null,
    growthRecords: a.growthRecords || [],
    measurementUnits: a.measurementUnits || null,
    updatedAt: new Date(),
});

// Upserts/removes a PublicAnimal mirror from an already-fetched Animal doc/lean-object.
// Safe to call unconditionally after any write to Animal — no-ops cleanly either way.
async function resyncAnimalToPublic(animal) {
    try {
        const { PublicAnimal } = require('../database/models');
        if (!animal || !animal.id_public) return;

        if (animal.isDisplay) {
            await PublicAnimal.updateOne(
                { id_public: animal.id_public },
                { $set: buildPublicAnimalFields(animal) },
                { upsert: true }
            );
        } else {
            await PublicAnimal.deleteOne({ id_public: animal.id_public });
        }
    } catch (error) {
        console.error('[resyncAnimalToPublic] Error syncing animal to public collection:', error);
    }
}

// Convenience wrapper for call sites that only have the id_public (e.g. after a raw
// Animal.updateOne/updateMany that didn't fetch the full document back).
async function resyncAnimalToPublicById(id_public) {
    try {
        const { Animal } = require('../database/models');
        const animal = await Animal.findOne({ id_public }).lean();
        if (!animal) return;
        await resyncAnimalToPublic(animal);
    } catch (error) {
        console.error('[resyncAnimalToPublicById] Error syncing animal to public collection:', error);
    }
}

async function syncAnimalToPublic(animal) {
    try {
        const { PublicAnimal } = require('../database/models');
        
        if (!animal || !animal.id_public) {
            console.log('[syncAnimalToPublic] Invalid animal data, skipping sync');
            return;
        }
        
        // If animal should be public, upsert to publicanimals
        if (animal.isDisplay === true) {
            // Remove _id to avoid immutable field error
            const { _id, ...animalWithoutId } = animal.toObject ? animal.toObject() : animal;
            
            // When public, sync all data
            await PublicAnimal.replaceOne(
                { id_public: animal.id_public },
                animalWithoutId,
                { upsert: true }
            );
            console.log(`[syncAnimalToPublic] Synced animal ${animal.id_public} to publicanimals`);
        } else {
            // If animal is private or not public, remove from publicanimals
            await PublicAnimal.deleteOne({ id_public: animal.id_public });
            console.log(`[syncAnimalToPublic] Removed animal ${animal.id_public} from publicanimals`);
        }
    } catch (error) {
        console.error('[syncAnimalToPublic] Error syncing animal to public collection:', error);
        // Don't throw - this is a background sync operation
    }
}

module.exports = { syncAnimalToPublic, resyncAnimalToPublic, resyncAnimalToPublicById, buildPublicAnimalFields };
