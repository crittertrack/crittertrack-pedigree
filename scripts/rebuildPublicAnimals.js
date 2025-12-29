#!/usr/bin/env node

/**
 * Rebuild public animals from main Animal collection
 * This script syncs all animals marked as isDisplay=true to the PublicAnimal collection
 * with the newly expanded schema fields.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Animal, PublicAnimal, User } = require('../database/models');

async function rebuildPublicAnimals() {
    try {
        const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
        console.log('[rebuildPublicAnimals] Connecting to database...');
        
        await mongoose.connect(dbUri);
        console.log('[rebuildPublicAnimals] Connected to database');

        // Find all animals that should be public (isDisplay = true)
        const publicAnimals = await Animal.find({ isDisplay: true }).lean();
        console.log(`[rebuildPublicAnimals] Found ${publicAnimals.length} animals to sync to public`);

        let syncCount = 0;
        let errorCount = 0;

        for (const animal of publicAnimals) {
            try {
                // Get owner's privacy settings
                const owner = await User.findById(animal.ownerId).select('id_public privacySettings').lean();
                if (!owner) {
                    console.log(`[rebuildPublicAnimals] Owner not found for animal ${animal.id_public}, skipping`);
                    continue;
                }

                const ownerPrivacySettings = owner.privacySettings || {};
                const showRemarksPublic = ownerPrivacySettings.showRemarksPublic || false;
                const showGeneticCodePublic = ownerPrivacySettings.showGeneticCodePublic || false;

                // Build complete public updates
                const publicUpdates = {
                    ownerId_public: animal.ownerId_public,
                    id_public: animal.id_public,
                    species: animal.species,
                    prefix: animal.prefix,
                    suffix: animal.suffix,
                    name: animal.name,
                    gender: animal.gender,
                    birthDate: animal.birthDate,
                    deceasedDate: animal.deceasedDate || null,
                    breederyId: animal.breederyId || null,
                    status: animal.status || 'Pet',
                    color: animal.color || null,
                    coat: animal.coat || null,
                    coatPattern: animal.coatPattern || null,
                    earset: animal.earset || null,
                    lifeStage: animal.lifeStage || null,
                    breederId_public: animal.breederId_public || null,
                    isOwned: animal.isOwned || false,
                    isPregnant: animal.isPregnant || false,
                    isNursing: animal.isNursing || false,
                    isInMating: animal.isInMating || false,
                    tags: animal.tags || [],
                    imageUrl: animal.imageUrl || null,
                    photoUrl: animal.photoUrl || null,
                    sireId_public: animal.sireId_public || null,
                    damId_public: animal.damId_public || null,
                    remarks: showRemarksPublic ? (animal.remarks || '') : '',
                    geneticCode: showGeneticCodePublic ? (animal.geneticCode || null) : null,
                    isDisplay: animal.isDisplay || false,
                    sectionPrivacy: animal.sectionPrivacy || {},
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
                    growthRecords: animal.growthRecords || null,
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
                    inbreedingCoefficient: animal.inbreedingCoefficient || null,
                    includeRemarks: animal.includeRemarks || false,
                    includeGeneticCode: animal.includeGeneticCode || false,
                };

                await PublicAnimal.updateOne(
                    { id_public: animal.id_public },
                    { $set: publicUpdates },
                    { upsert: true }
                );

                syncCount++;
                if (syncCount % 10 === 0) {
                    console.log(`[rebuildPublicAnimals] Synced ${syncCount} animals...`);
                }
            } catch (error) {
                errorCount++;
                console.error(`[rebuildPublicAnimals] Error syncing animal ${animal.id_public}:`, error.message);
            }
        }

        console.log(`[rebuildPublicAnimals] Complete! Synced ${syncCount} animals, ${errorCount} errors`);
        process.exit(0);
    } catch (error) {
        console.error('[rebuildPublicAnimals] Fatal error:', error);
        process.exit(1);
    }
}

rebuildPublicAnimals();
