/**
 * Field Template Migration Script
 * 
 * Creates 8 comprehensive field templates for different animal categories
 * Each template defines which fields are enabled, their labels, and if they're required
 * 
 * Run with: node migrate-field-templates.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

// Import models
const models = require('./database/models');
const { FieldTemplate, Species } = models;

// Helper function to create field configuration
const createFieldConfig = (enabled = true, label = '', required = false) => ({
    enabled,
    label,
    required
});

// Template definitions
const templates = [
    {
        name: 'Small Mammal Template',
        description: 'For small rodents (mice, rats, hamsters, gerbils, guinea pigs) and other small mammals',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            
            // Physical Profile
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(true, 'Coat Type', false),
            earset: createFieldConfig(true, 'Earset', false), // Rats/mice specific
            coatPattern: createFieldConfig(true, 'Pattern', false),
            lifeStage: createFieldConfig(true, 'Life Stage', false),
            heightAtWithers: createFieldConfig(false, 'Height at Withers', false),
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(false, 'Chest Girth', false),
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(true, 'Body/Tail Length', false),
            
            // Identification
            microchipNumber: createFieldConfig(false, 'Microchip #', false),
            pedigreeRegistrationId: createFieldConfig(true, 'Pedigree Registration #', false),
            breed: createFieldConfig(true, 'Breed', false),
            strain: createFieldConfig(true, 'Strain', false), // KEY FIELD for lab rodents
            licenseNumber: createFieldConfig(false, 'License Number', false),
            licenseJurisdiction: createFieldConfig(false, 'License Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(false, 'Rabies Tag #', false),
            tattooId: createFieldConfig(false, 'Tattoo ID', false),
            akcRegistrationNumber: createFieldConfig(false, 'AKC Registration #', false),
            fciRegistrationNumber: createFieldConfig(false, 'FCI Registration #', false),
            cfaRegistrationNumber: createFieldConfig(false, 'CFA Registration #', false),
            workingRegistryIds: createFieldConfig(false, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding
            isNeutered: createFieldConfig(true, 'Neutered/Spayed', false),
            spayNeuterDate: createFieldConfig(true, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(true, 'Heat Status', false),
            lastHeatDate: createFieldConfig(true, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Ovulation Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Due Date', false),
            litterCount: createFieldConfig(true, 'Litter Count', false),
            nursingStartDate: createFieldConfig(true, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(true, 'Weaning Date', false),
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Last Mating Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Matings', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Pregnancy Date', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Stud Animal', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Stud Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Stud Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Dam Animal', false),
            damFertilityStatus: createFieldConfig(true, 'Dam Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Dam Fertility Notes', false),
            estrusCycleLength: createFieldConfig(true, 'Estrus Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Gestation Length (days)', false),
            artificialInseminationUsed: createFieldConfig(false, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(false, 'Whelping Date', false),
            queeningDate: createFieldConfig(false, 'Queening Date', false),
            deliveryMethod: createFieldConfig(false, 'Delivery Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(false, 'Reproductive Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            
            // Health & Veterinary
            vaccinations: createFieldConfig(true, 'Vaccinations', false),
            dewormingRecords: createFieldConfig(true, 'Deworming Records', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(true, 'Allergies', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Vet Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention Schedule', false),
            heartwormStatus: createFieldConfig(false, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(false, 'Hip/Elbow Scores', false),
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(false, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(false, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(false, 'Dental Records', false),
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Housing Type', false),
            bedding: createFieldConfig(true, 'Bedding', false),
            temperatureRange: createFieldConfig(true, 'Temperature Range', false),
            humidity: createFieldConfig(true, 'Humidity', false),
            lighting: createFieldConfig(true, 'Lighting', false),
            noise: createFieldConfig(true, 'Noise Levels', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(true, 'Exercise Requirements', false),
            dailyExerciseMinutes: createFieldConfig(false, 'Daily Exercise (minutes)', false),
            groomingNeeds: createFieldConfig(true, 'Grooming Needs', false),
            sheddingLevel: createFieldConfig(false, 'Shedding Level', false),
            crateTrained: createFieldConfig(false, 'Crate Trained', false),
            litterTrained: createFieldConfig(false, 'Litter Trained', false),
            leashTrained: createFieldConfig(false, 'Leash Trained', false),
            
            // Behavior & Welfare
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Structure', false),
            groupRole: createFieldConfig(true, 'Group Role', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(false, 'Training Level', false),
            trainingDisciplines: createFieldConfig(false, 'Training Disciplines', false),
            certifications: createFieldConfig(false, 'Certifications', false),
            workingRole: createFieldConfig(false, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite History', false),
            reactivityNotes: createFieldConfig(false, 'Reactivity Notes', false),
            
            // Show
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(false, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(false, 'Insurance', false),
            legalStatus: createFieldConfig(false, 'Legal Status', false),
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(false, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(false, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(false, 'Export Restrictions', false),
            
            // Genetics & Notes
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            phenotype: createFieldConfig(true, 'Phenotype', false),
            morph: createFieldConfig(false, 'Morph', false), // Not for mammals
            markings: createFieldConfig(true, 'Markings', false),
            carrierTraits: createFieldConfig(true, 'Carrier Traits', false),
            colonyId: createFieldConfig(false, 'Colony ID', false),
            freeFlightTrained: createFieldConfig(false, 'Free Flight Trained', false),
            isPregnant: createFieldConfig(true, 'Pregnant', false),
            isNursing: createFieldConfig(true, 'Nursing', false),
            isInMating: createFieldConfig(true, 'In Mating', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Full Mammal Template',
        description: 'For larger mammals (dogs, cats, rabbits, ferrets) with advanced registration and health tracking',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            
            // Physical Profile
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(true, 'Coat Type', false),
            earset: createFieldConfig(false, 'Earset', false), // Not typically for dogs/cats
            coatPattern: createFieldConfig(true, 'Pattern', false),
            lifeStage: createFieldConfig(true, 'Life Stage', false),
            heightAtWithers: createFieldConfig(true, 'Height at Withers', false), // Dogs/horses
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(true, 'Chest Girth', false), // Dogs
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(false, 'Length', false), // Not typical for mammals
            
            // Identification - FULL SUITE
            microchipNumber: createFieldConfig(true, 'Microchip #', false), // KEY for dogs/cats
            pedigreeRegistrationId: createFieldConfig(true, 'Pedigree Registration #', false),
            breed: createFieldConfig(true, 'Breed', false),
            strain: createFieldConfig(false, 'Bloodline', false), // Renamed for dogs/cats
            licenseNumber: createFieldConfig(true, 'License Number', false),
            licenseJurisdiction: createFieldConfig(true, 'License Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(true, 'Rabies Tag #', false),
            tattooId: createFieldConfig(true, 'Tattoo ID', false),
            akcRegistrationNumber: createFieldConfig(true, 'AKC Registration #', false), // Dogs
            fciRegistrationNumber: createFieldConfig(true, 'FCI Registration #', false), // Dogs
            cfaRegistrationNumber: createFieldConfig(true, 'CFA Registration #', false), // Cats
            workingRegistryIds: createFieldConfig(true, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding - FULL SUITE
            isNeutered: createFieldConfig(true, 'Neutered/Spayed', false),
            spayNeuterDate: createFieldConfig(true, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(true, 'Heat Status', false),
            lastHeatDate: createFieldConfig(true, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Ovulation Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Due Date', false),
            litterCount: createFieldConfig(true, 'Litter Count', false),
            nursingStartDate: createFieldConfig(true, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(true, 'Weaning Date', false),
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Most Recent Mating', false),
            successfulMatings: createFieldConfig(true, 'Successful Matings', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Pregnancy Date', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Stud Animal', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Stud Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Stud Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Dam Animal', false),
            damFertilityStatus: createFieldConfig(true, 'Dam Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Dam Fertility Notes', false),
            estrusCycleLength: createFieldConfig(true, 'Estrus Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Gestation Length (days)', false),
            artificialInseminationUsed: createFieldConfig(true, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(true, 'Whelping Date', false), // Dogs
            queeningDate: createFieldConfig(true, 'Queening Date', false), // Cats
            deliveryMethod: createFieldConfig(true, 'Delivery Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(true, 'Reproductive Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            
            // Health & Veterinary - FULL SUITE
            vaccinations: createFieldConfig(true, 'Vaccinations', false),
            dewormingRecords: createFieldConfig(true, 'Deworming Records', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(true, 'Allergies', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Vet Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention Schedule', false),
            heartwormStatus: createFieldConfig(true, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(true, 'Hip/Elbow Scores', false), // Dogs
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(true, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(true, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(true, 'Dental Records', false),
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Housing Type', false),
            bedding: createFieldConfig(true, 'Bedding', false),
            temperatureRange: createFieldConfig(false, 'Temperature Range', false),
            humidity: createFieldConfig(false, 'Humidity', false),
            lighting: createFieldConfig(false, 'Lighting', false),
            noise: createFieldConfig(true, 'Noise Levels', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(true, 'Exercise Requirements', false),
            dailyExerciseMinutes: createFieldConfig(true, 'Daily Exercise (minutes)', false), // Dogs
            groomingNeeds: createFieldConfig(true, 'Grooming Needs', false),
            sheddingLevel: createFieldConfig(true, 'Shedding Level', false),
            crateTrained: createFieldConfig(true, 'Crate Trained', false), // Dogs
            litterTrained: createFieldConfig(true, 'Litter Trained', false), // Cats
            leashTrained: createFieldConfig(true, 'Leash Trained', false), // Dogs
            
            // Behavior & Welfare - FULL SUITE
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Structure', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(true, 'Training Level', false),
            trainingDisciplines: createFieldConfig(true, 'Training Disciplines', false),
            certifications: createFieldConfig(true, 'Certifications', false),
            workingRole: createFieldConfig(true, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite History', false),
            reactivityNotes: createFieldConfig(true, 'Reactivity Notes', false),
            
            // Show
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(true, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal - FULL SUITE
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(true, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status', false),
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(true, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(true, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export Restrictions', false),
            
            // Genetics & Notes
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            phenotype: createFieldConfig(false, 'Phenotype', false),
            morph: createFieldConfig(false, 'Morph', false), // Not for mammals
            markings: createFieldConfig(false, 'Markings', false),
            carrierTraits: createFieldConfig(false, 'Carrier Traits', false),
            colonyId: createFieldConfig(false, 'Colony ID', false),
            groupRole: createFieldConfig(false, 'Group Role', false),
            freeFlightTrained: createFieldConfig(false, 'Free Flight Trained', false),
            isPregnant: createFieldConfig(true, 'Pregnant', false),
            isNursing: createFieldConfig(true, 'Nursing', false),
            isInMating: createFieldConfig(true, 'In Mating', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Reptile Template',
        description: 'For reptiles (snakes, lizards, turtles) with morph tracking and environmental requirements',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            
            // Physical Profile - Reptile-specific
            color: createFieldConfig(true, 'Base Color', false),
            coat: createFieldConfig(false, 'Coat Type', false), // N/A for reptiles
            earset: createFieldConfig(false, 'Earset', false), // N/A
            coatPattern: createFieldConfig(true, 'Morph/Pattern', false),
            lifeStage: createFieldConfig(true, 'Life Stage', false),
            heightAtWithers: createFieldConfig(false, 'Height at Withers', false), // N/A
            bodyLength: createFieldConfig(true, 'Snout-Vent Length (SVL)', false), // KEY for reptiles
            chestGirth: createFieldConfig(false, 'Chest Girth', false), // N/A
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(true, 'Total Length', false), // KEY for snakes/lizards
            
            // Identification
            microchipNumber: createFieldConfig(true, 'Microchip #', false),
            pedigreeRegistrationId: createFieldConfig(true, 'Registry/Studbook #', false),
            breed: createFieldConfig(false, 'Breed', false), // Usually "species" for reptiles
            strain: createFieldConfig(false, 'Strain', false), // N/A
            licenseNumber: createFieldConfig(true, 'CITES/License Number', false), // Some jurisdictions
            licenseJurisdiction: createFieldConfig(true, 'License Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(false, 'Rabies Tag #', false), // N/A
            tattooId: createFieldConfig(false, 'Tattoo ID', false), // N/A
            akcRegistrationNumber: createFieldConfig(false, 'AKC Registration #', false), // N/A
            fciRegistrationNumber: createFieldConfig(false, 'FCI Registration #', false), // N/A
            cfaRegistrationNumber: createFieldConfig(false, 'CFA Registration #', false), // N/A
            workingRegistryIds: createFieldConfig(false, 'Working Registry IDs', false), // N/A
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding - Simplified for reptiles
            isNeutered: createFieldConfig(false, 'Neutered/Spayed', false), // Rare for reptiles
            spayNeuterDate: createFieldConfig(false, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(false, 'Heat Status', false), // Different terminology
            lastHeatDate: createFieldConfig(false, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Pre-lay/Ovulation Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Lay/Birth Date', false),
            litterCount: createFieldConfig(true, 'Clutch Size', false), // Eggs/live birth
            nursingStartDate: createFieldConfig(false, 'Nursing Start Date', false), // N/A
            weaningDate: createFieldConfig(false, 'Weaning Date', false), // N/A
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Last Mating Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Matings', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Gravid Period', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Breeding Male', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Breeding Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Breeding Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Breeding Female', false),
            damFertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            estrusCycleLength: createFieldConfig(false, 'Estrus Cycle Length (days)', false), // N/A
            gestationLength: createFieldConfig(true, 'Incubation/Gestation Period (days)', false),
            artificialInseminationUsed: createFieldConfig(false, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(false, 'Whelping Date', false), // N/A
            queeningDate: createFieldConfig(false, 'Queening Date', false), // N/A
            deliveryMethod: createFieldConfig(true, 'Egg-laying/Live Birth', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(false, 'Reproductive Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            isPregnant: createFieldConfig(true, 'Gravid', false),
            isNursing: createFieldConfig(true, 'Brooding', false),
            isInMating: createFieldConfig(true, 'In Mating', false),
            
            // Health & Veterinary - Reptile-focused
            vaccinations: createFieldConfig(false, 'Vaccinations', false), // Rare for reptiles
            dewormingRecords: createFieldConfig(true, 'Deworming Records', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(false, 'Allergies', false), // Rare
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Vet Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention Schedule', false),
            heartwormStatus: createFieldConfig(false, 'Heartworm Status', false), // N/A
            hipElbowScores: createFieldConfig(false, 'Hip/Elbow Scores', false), // N/A
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(false, 'Eye Clearance', false), // N/A
            cardiacClearance: createFieldConfig(false, 'Cardiac Clearance', false), // N/A
            dentalRecords: createFieldConfig(false, 'Dental Records', false), // N/A
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry - KEY for reptiles
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Enclosure Type', false),
            bedding: createFieldConfig(true, 'Substrate', false),
            temperatureRange: createFieldConfig(true, 'Temperature Range', false), // CRITICAL
            humidity: createFieldConfig(true, 'Humidity', false), // CRITICAL
            lighting: createFieldConfig(true, 'UV/Lighting', false), // CRITICAL
            noise: createFieldConfig(false, 'Noise Levels', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(false, 'Exercise Requirements', false),
            dailyExerciseMinutes: createFieldConfig(false, 'Daily Exercise (minutes)', false),
            groomingNeeds: createFieldConfig(true, 'Shed Care', false),
            sheddingLevel: createFieldConfig(false, 'Shedding Level', false),
            crateTrained: createFieldConfig(false, 'Crate Trained', false), // N/A
            litterTrained: createFieldConfig(false, 'Litter Trained', false), // N/A
            leashTrained: createFieldConfig(false, 'Leash Trained', false), // N/A
            
            // Behavior & Welfare
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Behavior', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(false, 'Training Level', false),
            trainingDisciplines: createFieldConfig(false, 'Training Disciplines', false),
            certifications: createFieldConfig(false, 'Certifications', false),
            workingRole: createFieldConfig(false, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite History', false),
            reactivityNotes: createFieldConfig(true, 'Defensive Behavior Notes', false),
            
            // Show
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(false, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(false, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status/Permits', false), // IMPORTANT for reptiles
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(true, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(true, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export Restrictions', false), // IMPORTANT
            
            // Genetics & Notes
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            eyeColor: createFieldConfig(true, 'Eye Color', false),
            nailColor: createFieldConfig(false, 'Nail/Claw Color', false), // N/A for reptiles
            phenotype: createFieldConfig(false, 'Phenotype', false), // coatPattern (Morph/Pattern) is the primary field
            morph: createFieldConfig(false, 'Morph', false), // Use coatPattern (Morph/Pattern) to avoid duplication
            markings: createFieldConfig(false, 'Markings', false),
            carrierTraits: createFieldConfig(false, 'Carrier Traits', false),
            colonyId: createFieldConfig(false, 'Colony ID', false),
            groupRole: createFieldConfig(false, 'Group Role', false),
            freeFlightTrained: createFieldConfig(false, 'Free Flight Trained', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Bird Template',
        description: 'For pet and aviary birds with band numbers and flock management',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Band Number', false), // KEY for birds
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            colonyId: createFieldConfig(true, 'Flock/Aviary ID', false),
            carrierTraits: createFieldConfig(true, 'Carrier Traits', false),
            
            // Physical Profile
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(true, 'Feather Type', false), // Adapted
            earset: createFieldConfig(false, 'Earset', false), // N/A
            coatPattern: createFieldConfig(false, 'Plumage Pattern', false), // Disabled - use Mutation/Morph field
            lifeStage: createFieldConfig(true, 'Life Stage', false),
            heightAtWithers: createFieldConfig(false, 'Height at Withers', false),
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(false, 'Chest Girth', false),
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(true, 'Wingspan', false), // Adapted
            
            // Identification
            microchipNumber: createFieldConfig(true, 'Microchip #', false), // Some large parrots
            pedigreeRegistrationId: createFieldConfig(true, 'Registration #', false),
            breed: createFieldConfig(true, 'Breed/Variety', false),
            strain: createFieldConfig(false, 'Strain', false),
            licenseNumber: createFieldConfig(true, 'Permit Number', false),
            licenseJurisdiction: createFieldConfig(true, 'Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(false, 'Rabies Tag #', false), // N/A
            tattooId: createFieldConfig(false, 'Tattoo ID', false), // N/A
            akcRegistrationNumber: createFieldConfig(false, 'AKC Registration #', false), // N/A
            fciRegistrationNumber: createFieldConfig(false, 'FCI Registration #', false), // N/A
            cfaRegistrationNumber: createFieldConfig(false, 'CFA Registration #', false), // N/A
            workingRegistryIds: createFieldConfig(false, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding
            isNeutered: createFieldConfig(false, 'Neutered/Spayed', false), // Rare
            spayNeuterDate: createFieldConfig(false, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(false, 'Heat Status', false),
            lastHeatDate: createFieldConfig(false, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Ovulation Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Hatch Date', false),
            litterCount: createFieldConfig(true, 'Clutch Size', false),
            nursingStartDate: createFieldConfig(false, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(true, 'Fledging/Weaning Date', false), // KEY for hand-rearing
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Last Mating Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Matings', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Egg-laying Date', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Breeding Male', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Breeding Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Breeding Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Breeding Female', false),
            damFertilityStatus: createFieldConfig(true, 'Female Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Female Fertility Notes', false),
            estrusCycleLength: createFieldConfig(false, 'Estrus Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Incubation Period (days)', false),
            artificialInseminationUsed: createFieldConfig(false, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(false, 'Whelping Date', false),
            queeningDate: createFieldConfig(false, 'Queening Date', false),
            deliveryMethod: createFieldConfig(false, 'Delivery Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(false, 'Reproductive Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            isPregnant: createFieldConfig(true, 'Gravid/Egg-Laying', false),
            isNursing: createFieldConfig(true, 'Brooding/Chick Rearing', false),
            isInMating: createFieldConfig(true, 'In Mating', false),
            
            // Health & Veterinary
            vaccinations: createFieldConfig(true, 'Vaccinations', false),
            dewormingRecords: createFieldConfig(true, 'Deworming Records', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(false, 'Allergies', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Vet Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention Schedule', false),
            heartwormStatus: createFieldConfig(false, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(false, 'Hip/Elbow Scores', false),
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(false, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(false, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(true, 'Beak/Nail Care', false), // Adapted
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Housing Type', false),
            bedding: createFieldConfig(true, 'Substrate', false),
            temperatureRange: createFieldConfig(true, 'Temperature Range', false),
            humidity: createFieldConfig(true, 'Humidity', false),
            lighting: createFieldConfig(true, 'Lighting/Daylight Hours', false),
            noise: createFieldConfig(true, 'Vocalizations/Noise', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(true, 'Flight/Exercise Requirements', false),
            dailyExerciseMinutes: createFieldConfig(true, 'Out-of-Cage Time (minutes)', false),
            groomingNeeds: createFieldConfig(false, 'Grooming Needs', false), // Not applicable for birds
            sheddingLevel: createFieldConfig(false, 'Shedding Level', false),
            crateTrained: createFieldConfig(false, 'Crate Trained', false),
            litterTrained: createFieldConfig(false, 'Litter Trained', false),
            leashTrained: createFieldConfig(true, 'Harness Trained', false),
            
            // Behavior & Welfare
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Needs', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(true, 'Training Level', false),
            trainingDisciplines: createFieldConfig(true, 'Tricks/Commands', false),
            certifications: createFieldConfig(false, 'Certifications', false),
            workingRole: createFieldConfig(false, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite History', false),
            reactivityNotes: createFieldConfig(true, 'Reactivity Notes', false),
            freeFlightTrained: createFieldConfig(true, 'Free Flight Trained', false),
            groupRole: createFieldConfig(false, 'Group Role', false),
            
            // Show
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(false, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(true, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status/CITES', false), // IMPORTANT for parrots
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(true, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(true, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export Restrictions', false),
            
            // Genetics & Notes
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            eyeColor: createFieldConfig(true, 'Eye Color', false),
            nailColor: createFieldConfig(false, 'Nail/Claw Color', false), // N/A for birds
            phenotype: createFieldConfig(false, 'Phenotype', false),
            morph: createFieldConfig(true, 'Mutation/Morph', false), // For color mutations
            markings: createFieldConfig(false, 'Markings', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Amphibian Template',
        description: 'For amphibians (frogs, salamanders, newts) with environmental focus',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            
            // Physical Profile
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(false, 'Coat Type', false), // N/A
            earset: createFieldConfig(false, 'Earset', false),
            coatPattern: createFieldConfig(false, 'Pattern', false), // Disabled for amphibians
            lifeStage: createFieldConfig(true, 'Life Stage', false), // Tadpole/metamorph/adult
            heightAtWithers: createFieldConfig(false, 'Height at Withers', false),
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(false, 'Chest Girth', false),
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(true, 'Snout-Vent Length', false),
            
            // Identification
            microchipNumber: createFieldConfig(true, 'Microchip #', false),
            pedigreeRegistrationId: createFieldConfig(true, 'Registration #', false),
            breed: createFieldConfig(true, 'Species/Locality', false),
            strain: createFieldConfig(true, 'Strain/Lineage', false),
            licenseNumber: createFieldConfig(true, 'CITES/Export License', false),
            licenseJurisdiction: createFieldConfig(true, 'Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(false, 'Rabies Tag #', false),
            tattooId: createFieldConfig(false, 'Tattoo ID', false),
            akcRegistrationNumber: createFieldConfig(false, 'AKC Registration #', false),
            fciRegistrationNumber: createFieldConfig(false, 'FCI Registration #', false),
            cfaRegistrationNumber: createFieldConfig(false, 'CFA Registration #', false),
            workingRegistryIds: createFieldConfig(false, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding
            isNeutered: createFieldConfig(false, 'Neutered/Spayed', false),
            spayNeuterDate: createFieldConfig(false, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(false, 'Heat Status', false),
            lastHeatDate: createFieldConfig(false, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Ovulation Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Spawn Date', false),
            litterCount: createFieldConfig(true, 'Egg Count', false),
            nursingStartDate: createFieldConfig(false, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(false, 'Weaning Date', false),
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Last Breeding Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Breedings', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Spawn Date', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Breeding Male', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Breeding Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Breeding Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Breeding Female', false),
            damFertilityStatus: createFieldConfig(true, 'Female Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Female Fertility Notes', false),
            estrusCycleLength: createFieldConfig(false, 'Estrus Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Development Period', false),
            artificialInseminationUsed: createFieldConfig(false, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(false, 'Whelping Date', false),
            queeningDate: createFieldConfig(false, 'Queening Date', false),
            weaningDate: createFieldConfig(true, 'Metamorphosis Date', false),
            deliveryMethod: createFieldConfig(true, 'Spawning Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(true, 'Health Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            isPregnant: createFieldConfig(true, 'Egg-laying / Spawning', false),
            isNursing: createFieldConfig(true, 'Brooding / Guarding', false),
            isInMating: createFieldConfig(true, 'Amplexus', false),
            
            // Health & Veterinary
            vaccinations: createFieldConfig(true, 'Vaccinations/Treatments', false),
            dewormingRecords: createFieldConfig(true, 'Deworming Records', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(true, 'Environmental Sensitivities', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Vet Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention', false),
            heartwormStatus: createFieldConfig(false, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(false, 'Hip/Elbow Scores', false),
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(false, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(false, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(false, 'Dental Records', false),
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry - CRITICAL for amphibians
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Enclosure Type', false),
            bedding: createFieldConfig(true, 'Substrate', false),
            temperatureRange: createFieldConfig(true, 'Temperature Range', false), // CRITICAL
            humidity: createFieldConfig(true, 'Humidity', false), // CRITICAL
            lighting: createFieldConfig(true, 'Lighting', false),
            noise: createFieldConfig(true, 'Vocalization/Calling', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(true, 'Activity Space Requirements', false),
            dailyExerciseMinutes: createFieldConfig(false, 'Daily Exercise (minutes)', false),
            groomingNeeds: createFieldConfig(false, 'Grooming Needs', false),
            sheddingLevel: createFieldConfig(false, 'Shedding Level', false),
            crateTrained: createFieldConfig(false, 'Crate Trained', false),
            litterTrained: createFieldConfig(false, 'Litter Trained', false),
            leashTrained: createFieldConfig(false, 'Leash Trained', false),
            
            // Behavior & Welfare
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Behavior', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(false, 'Training Level', false),
            trainingDisciplines: createFieldConfig(false, 'Training Disciplines', false),
            certifications: createFieldConfig(false, 'Certifications', false),
            workingRole: createFieldConfig(false, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite/Toxin Contact History', false),
            reactivityNotes: createFieldConfig(true, 'Stress Response Notes', false),
            
            // Show
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(false, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(true, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status/Permits', false),
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(true, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(true, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export Restrictions', false),
            
            // Genetics & Notes
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            eyeColor: createFieldConfig(true, 'Eye Color', false),
            nailColor: createFieldConfig(false, 'Nail/Claw Color', false),
            phenotype: createFieldConfig(false, 'Phenotype', false),
            morph: createFieldConfig(true, 'Morph', false),
            markings: createFieldConfig(false, 'Markings', false),
            carrierTraits: createFieldConfig(false, 'Carrier Traits', false),
            colonyId: createFieldConfig(false, 'Colony ID', false),
            groupRole: createFieldConfig(false, 'Group Role', false),
            freeFlightTrained: createFieldConfig(false, 'Free Flight Trained', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Fish Template',
        description: 'For aquarium fish with water parameter tracking',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            
            // Physical Profile
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(false, 'Coat Type', false), // N/A
            earset: createFieldConfig(false, 'Earset', false),
            coatPattern: createFieldConfig(false, 'Pattern', false), // Disabled for fish
            lifeStage: createFieldConfig(true, 'Life Stage', false),
            heightAtWithers: createFieldConfig(false, 'Height at Withers', false),
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(false, 'Chest Girth', false),
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(true, 'Length', false), // KEY for fish
            
            // Identification
            microchipNumber: createFieldConfig(false, 'Microchip #', false),
            pedigreeRegistrationId: createFieldConfig(true, 'Registration #', false),
            breed: createFieldConfig(true, 'Variety', false),
            strain: createFieldConfig(false, 'Breeding Line', false),
            licenseNumber: createFieldConfig(true, 'Permit Number', false),
            licenseJurisdiction: createFieldConfig(true, 'Permit Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(false, 'Rabies Tag #', false),
            tattooId: createFieldConfig(false, 'Tattoo ID', false),
            akcRegistrationNumber: createFieldConfig(false, 'AKC Registration #', false),
            fciRegistrationNumber: createFieldConfig(false, 'FCI Registration #', false),
            cfaRegistrationNumber: createFieldConfig(false, 'CFA Registration #', false),
            workingRegistryIds: createFieldConfig(false, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding
            isNeutered: createFieldConfig(false, 'Neutered/Spayed', false),
            spayNeuterDate: createFieldConfig(false, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(false, 'Heat Status', false),
            lastHeatDate: createFieldConfig(false, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Spawn Readiness Date', false),
            matingDates: createFieldConfig(true, 'Spawn Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Hatch Date', false),
            litterCount: createFieldConfig(true, 'Fry Count', false),
            nursingStartDate: createFieldConfig(false, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(true, 'Free-Swimming Date', false),
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Breeding Event Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Spawns', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Spawn Date', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Breeding Male', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Breeding Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Breeding Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Breeding Female', false),
            damFertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            estrusCycleLength: createFieldConfig(false, 'Estrus Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Incubation Period', false),
            artificialInseminationUsed: createFieldConfig(false, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(false, 'Whelping Date', false),
            queeningDate: createFieldConfig(false, 'Queening Date', false),
            deliveryMethod: createFieldConfig(true, 'Spawning Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(true, 'Health Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            isPregnant: createFieldConfig(true, 'Gravid (Livebearer)', false),
            isNursing: createFieldConfig(false, 'Mouthbrooding', false), // Disabled - too species-specific
            isInMating: createFieldConfig(true, 'Breeding / Courtship', false),
            
            // Health & Veterinary
            vaccinations: createFieldConfig(false, 'Vaccinations', false),
            dewormingRecords: createFieldConfig(true, 'Deworming/Parasite Treatment', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(false, 'Allergies', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Vet Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention', false),
            heartwormStatus: createFieldConfig(false, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(false, 'Hip/Elbow Scores', false),
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(false, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(false, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(false, 'Dental Records', false),
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry - Water parameters CRITICAL
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Tank Type', false),
            bedding: createFieldConfig(true, 'Substrate', false),
            temperatureRange: createFieldConfig(true, 'Water Temperature', false), // CRITICAL
            humidity: createFieldConfig(true, 'Water Parameters/pH', false),
            lighting: createFieldConfig(true, 'Lighting', false),
            noise: createFieldConfig(true, 'Tank Environment Noise', false),
            enrichment: createFieldConfig(true, 'Tank Enrichment', false),
            exerciseRequirements: createFieldConfig(true, 'Swimming Space Requirements', false),
            dailyExerciseMinutes: createFieldConfig(false, 'Daily Exercise (minutes)', false),
            groomingNeeds: createFieldConfig(false, 'Grooming Needs', false),
            sheddingLevel: createFieldConfig(false, 'Shedding Level', false),
            crateTrained: createFieldConfig(false, 'Crate Trained', false),
            litterTrained: createFieldConfig(false, 'Litter Trained', false),
            leashTrained: createFieldConfig(false, 'Leash Trained', false),
            
            // Behavior & Welfare
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(false, 'Handling Stress Tolerance', false), // Not applicable for fish
            socialStructure: createFieldConfig(true, 'Social Behavior', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(false, 'Training Level', false),
            trainingDisciplines: createFieldConfig(false, 'Training Disciplines', false),
            certifications: createFieldConfig(false, 'Certifications', false),
            workingRole: createFieldConfig(false, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(false, 'Bite History', false),
            reactivityNotes: createFieldConfig(false, 'Reactivity Notes', false),
            
            // Show
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(false, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(true, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status/Permits', false),
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(true, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(true, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export/Import Restrictions', false),
            
            // Genetics & Notes
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            eyeColor: createFieldConfig(true, 'Eye Color', false),
            nailColor: createFieldConfig(false, 'Nail/Claw Color', false),
            phenotype: createFieldConfig(false, 'Phenotype', false),
            morph: createFieldConfig(true, 'Morph/Variety', false),
            markings: createFieldConfig(false, 'Markings', false),
            carrierTraits: createFieldConfig(false, 'Carrier Traits', false),
            colonyId: createFieldConfig(false, 'Colony ID', false),
            groupRole: createFieldConfig(false, 'Group Role', false),
            freeFlightTrained: createFieldConfig(false, 'Free Flight Trained', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Invertebrate Template',
        description: 'For invertebrates (tarantulas, scorpions, insects) with minimal tracking',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            colonyId: createFieldConfig(true, 'Colony/Hive ID', false),
            
            // Physical Profile - Minimal
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(true, 'Texture', false), // Repurposed: body/skin texture for invertebrates
            earset: createFieldConfig(false, 'Earset', false),
            coatPattern: createFieldConfig(false, 'Pattern', false), // Disabled for invertebrates
            lifeStage: createFieldConfig(true, 'Life Stage (Instar)', false), // Molt stages
            heightAtWithers: createFieldConfig(false, 'Height at Withers', false),
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(false, 'Chest Girth', false),
            adultWeight: createFieldConfig(false, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(false, 'Body Condition Score', false),
            weight: createFieldConfig(false, 'Weight', false),
            length: createFieldConfig(true, 'Leg Span/Length', false),
            
            // Identification - Minimal
            microchipNumber: createFieldConfig(false, 'Microchip #', false),
            pedigreeRegistrationId: createFieldConfig(false, 'Registration #', false),
            breed: createFieldConfig(false, 'Breed', false),
            strain: createFieldConfig(false, 'Strain', false),
            licenseNumber: createFieldConfig(true, 'CITES/Permit Number', false),
            licenseJurisdiction: createFieldConfig(false, 'Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(false, 'Rabies Tag #', false),
            tattooId: createFieldConfig(false, 'Tattoo ID', false),
            akcRegistrationNumber: createFieldConfig(false, 'AKC Registration #', false),
            fciRegistrationNumber: createFieldConfig(false, 'FCI Registration #', false),
            cfaRegistrationNumber: createFieldConfig(false, 'CFA Registration #', false),
            workingRegistryIds: createFieldConfig(false, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding - Minimal
            isNeutered: createFieldConfig(false, 'Neutered/Spayed', false),
            spayNeuterDate: createFieldConfig(false, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(false, 'Heat Status', false),
            lastHeatDate: createFieldConfig(false, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(false, 'Ovulation Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Egg Sac Date', false),
            litterCount: createFieldConfig(true, 'Spiderling/Nymph Count', false),
            nursingStartDate: createFieldConfig(false, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(false, 'Weaning Date', false),
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Last Mating Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Matings', false),
            lastPregnancyDate: createFieldConfig(false, 'Last Pregnancy Date', false),
            offspringCount: createFieldConfig(true, 'Offspring Count', false),
            isStudAnimal: createFieldConfig(true, 'Breeding Male', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Breeding Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Breeding Fee Amount', false),
            fertilityStatus: createFieldConfig(false, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(false, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Breeding Female', false),
            damFertilityStatus: createFieldConfig(false, 'Fertility Status', false),
            damFertilityNotes: createFieldConfig(false, 'Fertility Notes', false),
            estrusCycleLength: createFieldConfig(false, 'Estrus Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Egg Sac Period', false),
            artificialInseminationUsed: createFieldConfig(false, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(false, 'Whelping Date', false),
            queeningDate: createFieldConfig(false, 'Queening Date', false),
            deliveryMethod: createFieldConfig(false, 'Delivery Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(false, 'Reproductive Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(false, 'Infertile', false),
            isPregnant: createFieldConfig(true, 'Gravid', false),
            isNursing: createFieldConfig(false, 'Guarding Egg Sac', false), // Disabled - too species-specific
            isInMating: createFieldConfig(true, 'Breeding Status / Amplexus', false),
            
            // Health & Veterinary - Minimal
            vaccinations: createFieldConfig(false, 'Vaccinations', false),
            dewormingRecords: createFieldConfig(false, 'Deworming Records', false),
            parasiteControl: createFieldConfig(true, 'Mite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(false, 'Allergies', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(false, 'Medical Procedures', false),
            labResults: createFieldConfig(false, 'Lab Results', false),
            vetVisits: createFieldConfig(false, 'Vet Visits', false),
            primaryVet: createFieldConfig(false, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Mite Prevention', false),
            heartwormStatus: createFieldConfig(false, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(false, 'Hip/Elbow Scores', false),
            geneticTestResults: createFieldConfig(false, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(false, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(false, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(false, 'Dental Records', false),
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry - Environmental critical
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(false, 'Supplements', false),
            housingType: createFieldConfig(true, 'Enclosure Type', false),
            bedding: createFieldConfig(true, 'Substrate', false),
            temperatureRange: createFieldConfig(true, 'Temperature Range', false), // CRITICAL
            humidity: createFieldConfig(true, 'Humidity', false), // CRITICAL
            lighting: createFieldConfig(true, 'Lighting', false),
            noise: createFieldConfig(false, 'Noise Levels', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(false, 'Exercise Requirements', false),
            dailyExerciseMinutes: createFieldConfig(false, 'Daily Exercise (minutes)', false),
            groomingNeeds: createFieldConfig(false, 'Grooming Needs', false),
            sheddingLevel: createFieldConfig(false, 'Shedding Level', false),
            crateTrained: createFieldConfig(false, 'Crate Trained', false),
            litterTrained: createFieldConfig(false, 'Litter Trained', false),
            leashTrained: createFieldConfig(false, 'Leash Trained', false),
            
            // Behavior & Welfare - Minimal
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Behavior', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(false, 'Training Level', false),
            trainingDisciplines: createFieldConfig(false, 'Training Disciplines', false),
            certifications: createFieldConfig(false, 'Certifications', false),
            workingRole: createFieldConfig(false, 'Working Role', false),
            behavioralIssues: createFieldConfig(false, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite/Sting History', false),
            reactivityNotes: createFieldConfig(true, 'Defensive Behavior', false),
            
            // Show - Minimal
            showTitles: createFieldConfig(false, 'Show Titles', false),
            showRatings: createFieldConfig(false, 'Show Ratings', false),
            judgeComments: createFieldConfig(false, 'Judge Comments', false),
            workingTitles: createFieldConfig(false, 'Working Titles', false),
            performanceScores: createFieldConfig(false, 'Performance Scores', false),
            
            // End of Life & Legal
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(false, 'Necropsy Results', false),
            insurance: createFieldConfig(false, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status/Permits', false),
            endOfLifeCareNotes: createFieldConfig(false, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(false, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(false, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export Restrictions', false),
            
            // Genetics & Notes
            geneticCode: createFieldConfig(false, 'Genetic Code', false),
            eyeColor: createFieldConfig(true, 'Eye Color', false),
            nailColor: createFieldConfig(false, 'Nail/Claw Color', false),
            phenotype: createFieldConfig(false, 'Phenotype', false),
            morph: createFieldConfig(true, 'Morph/Color Form', false),
            markings: createFieldConfig(false, 'Markings', false),
            carrierTraits: createFieldConfig(false, 'Carrier Traits', false),
            groupRole: createFieldConfig(false, 'Group Role', false),
            freeFlightTrained: createFieldConfig(false, 'Free Flight Trained', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    },
    
    {
        name: 'Other Template',
        description: 'Flexible general template for miscellaneous animal types',
        isDefault: true,
        fields: {
            // Identity
            prefix: createFieldConfig(true, 'Prefix', false),
            suffix: createFieldConfig(true, 'Suffix', false),
            breederAssignedId: createFieldConfig(true, 'Identification', false),
            
            // Ownership
            currentOwner: createFieldConfig(true, 'Current Owner', false),
            ownershipHistory: createFieldConfig(true, 'Ownership History', false),
            isOwned: createFieldConfig(true, 'Currently Owned', false),
            manualBreederName: createFieldConfig(true, 'Breeder Name (Manual)', false),
            currentOwnerDisplay: createFieldConfig(true, 'Current Owner', false),
            colonyId: createFieldConfig(true, 'Colony ID', false),
            groupRole: createFieldConfig(true, 'Group Role', false),
            carrierTraits: createFieldConfig(true, 'Carrier Traits', false),
            freeFlightTrained: createFieldConfig(true, 'Free Flight Trained', false),
            
            // Physical Profile - All enabled for flexibility
            color: createFieldConfig(true, 'Color', false),
            coat: createFieldConfig(true, 'Coat/Covering Type', false),
            earset: createFieldConfig(true, 'Earset', false),
            coatPattern: createFieldConfig(true, 'Pattern', false),
            lifeStage: createFieldConfig(true, 'Life Stage', false),
            heightAtWithers: createFieldConfig(true, 'Height at Withers', false),
            bodyLength: createFieldConfig(true, 'Body Length', false),
            chestGirth: createFieldConfig(true, 'Chest Girth', false),
            adultWeight: createFieldConfig(true, 'Adult Weight', false),
            bodyConditionScore: createFieldConfig(true, 'Body Condition Score', false),
            weight: createFieldConfig(true, 'Weight', false),
            length: createFieldConfig(true, 'Length', false),
            
            // Identification - All enabled
            microchipNumber: createFieldConfig(true, 'Microchip #', false),
            pedigreeRegistrationId: createFieldConfig(true, 'Pedigree Registration #', false),
            breed: createFieldConfig(true, 'Breed/Species/Type', false),
            strain: createFieldConfig(true, 'Strain/Line', false),
            licenseNumber: createFieldConfig(true, 'License/Permit Number', false),
            licenseJurisdiction: createFieldConfig(true, 'License Jurisdiction', false),
            rabiesTagNumber: createFieldConfig(true, 'Rabies Tag #', false),
            tattooId: createFieldConfig(true, 'Tattoo ID', false),
            akcRegistrationNumber: createFieldConfig(true, 'AKC Registration #', false),
            fciRegistrationNumber: createFieldConfig(true, 'FCI Registration #', false),
            cfaRegistrationNumber: createFieldConfig(true, 'CFA Registration #', false),
            workingRegistryIds: createFieldConfig(true, 'Working Registry IDs', false),
            
            // Lineage & Origin
            origin: createFieldConfig(true, 'Origin', false),
            
            // Reproduction & Breeding - All enabled
            isNeutered: createFieldConfig(true, 'Neutered/Spayed', false),
            spayNeuterDate: createFieldConfig(true, 'Spay/Neuter Date', false),
            heatStatus: createFieldConfig(true, 'Heat Status', false),
            lastHeatDate: createFieldConfig(true, 'Last Heat Date', false),
            ovulationDate: createFieldConfig(true, 'Ovulation/Reproduction Date', false),
            matingDates: createFieldConfig(true, 'Mating Dates', false),
            expectedDueDate: createFieldConfig(true, 'Expected Due Date', false),
            litterCount: createFieldConfig(true, 'Litter/Clutch Count', false),
            nursingStartDate: createFieldConfig(true, 'Nursing Start Date', false),
            weaningDate: createFieldConfig(true, 'Weaning/Independence Date', false),
            breedingRole: createFieldConfig(true, 'Breeding Role', false),
            lastMatingDate: createFieldConfig(true, 'Last Mating Date', false),
            successfulMatings: createFieldConfig(true, 'Successful Matings', false),
            lastPregnancyDate: createFieldConfig(true, 'Last Pregnancy/Reproduction Date', false),
            offspringCount: createFieldConfig(true, 'Total Offspring', false),
            isStudAnimal: createFieldConfig(true, 'Breeding Male', false),
            availableForBreeding: createFieldConfig(true, 'Available for Breeding', false),
            studFeeCurrency: createFieldConfig(true, 'Breeding Fee Currency', false),
            studFeeAmount: createFieldConfig(true, 'Breeding Fee Amount', false),
            fertilityStatus: createFieldConfig(true, 'Fertility Status', false),
            fertilityNotes: createFieldConfig(true, 'Fertility Notes', false),
            isDamAnimal: createFieldConfig(true, 'Breeding Female', false),
            damFertilityStatus: createFieldConfig(true, 'Female Fertility Status', false),
            damFertilityNotes: createFieldConfig(true, 'Female Fertility Notes', false),
            estrusCycleLength: createFieldConfig(true, 'Cycle Length (days)', false),
            gestationLength: createFieldConfig(true, 'Gestation/Incubation Period', false),
            artificialInseminationUsed: createFieldConfig(true, 'Artificial Insemination Used', false),
            whelpingDate: createFieldConfig(true, 'Birth/Hatch Date', false),
            queeningDate: createFieldConfig(true, 'Queening Date', false),
            deliveryMethod: createFieldConfig(true, 'Delivery/Birth Method', false),
            reproductiveComplications: createFieldConfig(true, 'Reproductive Complications', false),
            reproductiveClearances: createFieldConfig(true, 'Reproductive Clearances', false),
            isForSale: createFieldConfig(true, 'For Sale', false),
            salePriceCurrency: createFieldConfig(true, 'Sale Price Currency', false),
            salePriceAmount: createFieldConfig(true, 'Sale Price Amount', false),
            isInfertile: createFieldConfig(true, 'Infertile', false),
            isPregnant: createFieldConfig(true, 'Pregnant', false),
            isNursing: createFieldConfig(true, 'Nursing', false),
            isInMating: createFieldConfig(true, 'In Mating', false),
            
            // Health & Veterinary - All enabled
            vaccinations: createFieldConfig(true, 'Vaccinations/Treatments', false),
            dewormingRecords: createFieldConfig(true, 'Deworming/Parasite Records', false),
            parasiteControl: createFieldConfig(true, 'Parasite Control', false),
            medicalConditions: createFieldConfig(true, 'Medical Conditions', false),
            allergies: createFieldConfig(true, 'Allergies/Sensitivities', false),
            medications: createFieldConfig(true, 'Medications', false),
            medicalProcedures: createFieldConfig(true, 'Medical Procedures', false),
            labResults: createFieldConfig(true, 'Lab Results', false),
            vetVisits: createFieldConfig(true, 'Veterinary Visits', false),
            primaryVet: createFieldConfig(true, 'Primary Veterinarian', false),
            parasitePreventionSchedule: createFieldConfig(true, 'Parasite Prevention', false),
            heartwormStatus: createFieldConfig(true, 'Heartworm Status', false),
            hipElbowScores: createFieldConfig(true, 'Hip/Elbow Scores', false),
            geneticTestResults: createFieldConfig(true, 'Genetic Test Results', false),
            eyeClearance: createFieldConfig(true, 'Eye Clearance', false),
            cardiacClearance: createFieldConfig(true, 'Cardiac Clearance', false),
            dentalRecords: createFieldConfig(true, 'Dental Records', false),
            chronicConditions: createFieldConfig(true, 'Chronic Conditions', false),
            
            // Nutrition & Husbandry - All enabled
            dietType: createFieldConfig(true, 'Diet Type', false),
            feedingSchedule: createFieldConfig(true, 'Feeding Schedule', false),
            supplements: createFieldConfig(true, 'Supplements', false),
            housingType: createFieldConfig(true, 'Housing/Enclosure Type', false),
            bedding: createFieldConfig(true, 'Bedding/Substrate', false),
            temperatureRange: createFieldConfig(true, 'Temperature Range', false),
            humidity: createFieldConfig(true, 'Humidity', false),
            lighting: createFieldConfig(true, 'Lighting', false),
            noise: createFieldConfig(true, 'Environmental Noise', false),
            enrichment: createFieldConfig(true, 'Enrichment', false),
            exerciseRequirements: createFieldConfig(true, 'Activity Requirements', false),
            dailyExerciseMinutes: createFieldConfig(true, 'Daily Exercise (minutes)', false),
            groomingNeeds: createFieldConfig(true, 'Grooming Needs', false),
            sheddingLevel: createFieldConfig(true, 'Shedding Level', false),
            crateTrained: createFieldConfig(true, 'Crate Trained', false),
            litterTrained: createFieldConfig(true, 'Litter Trained', false),
            leashTrained: createFieldConfig(true, 'Leash/Harness Trained', false),
            
            // Behavior & Welfare - All enabled
            temperament: createFieldConfig(true, 'Temperament', false),
            handlingTolerance: createFieldConfig(true, 'Handling Tolerance', false),
            socialStructure: createFieldConfig(true, 'Social Behavior', false),
            activityCycle: createFieldConfig(true, 'Activity Cycle', false),
            trainingLevel: createFieldConfig(true, 'Training Level', false),
            trainingDisciplines: createFieldConfig(true, 'Training Disciplines', false),
            certifications: createFieldConfig(true, 'Certifications', false),
            workingRole: createFieldConfig(true, 'Working Role', false),
            behavioralIssues: createFieldConfig(true, 'Behavioral Issues', false),
            biteHistory: createFieldConfig(true, 'Bite/Defensive History', false),
            reactivityNotes: createFieldConfig(true, 'Behavioral Notes', false),
            
            // Show - All enabled
            showTitles: createFieldConfig(true, 'Show Titles', false),
            showRatings: createFieldConfig(true, 'Show Ratings', false),
            judgeComments: createFieldConfig(true, 'Judge Comments', false),
            workingTitles: createFieldConfig(true, 'Working Titles', false),
            performanceScores: createFieldConfig(true, 'Performance Scores', false),
            
            // End of Life & Legal - All enabled
            causeOfDeath: createFieldConfig(true, 'Cause of Death', false),
            necropsyResults: createFieldConfig(true, 'Necropsy Results', false),
            insurance: createFieldConfig(true, 'Insurance', false),
            legalStatus: createFieldConfig(true, 'Legal Status/Permits', false),
            endOfLifeCareNotes: createFieldConfig(true, 'End of Life Care Notes', false),
            coOwnership: createFieldConfig(true, 'Co-Ownership', false),
            transferHistory: createFieldConfig(true, 'Transfer History', false),
            breedingRestrictions: createFieldConfig(true, 'Breeding Restrictions', false),
            exportRestrictions: createFieldConfig(true, 'Export Restrictions', false),
            
            // Genetics & Notes - All enabled
            geneticCode: createFieldConfig(true, 'Genetic Code', false),
            phenotype: createFieldConfig(true, 'Phenotype', false),
            morph: createFieldConfig(true, 'Morph/Variety', false),
            markings: createFieldConfig(true, 'Markings', false),
            remarks: createFieldConfig(true, 'Notes/Remarks', false)
        }
    }
];

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully.');
        
        console.log('\n========================================');
        console.log('FIELD TEMPLATE MIGRATION');
        console.log('========================================\n');
        
        const results = {
            created: [],
            updated: [],
            skipped: [],
            errors: []
        };
        
        for (const templateData of templates) {
            try {
                console.log(`\nProcessing template: ${templateData.name}...`);
                
                const existingTemplate = await FieldTemplate.findOne({ name: templateData.name });
                
                if (existingTemplate) {
                    console.log(`  ⚠️  Template "${templateData.name}" already exists.`);
                    console.log(`  Updating with latest field configurations...`);
                    
                    existingTemplate.description = templateData.description;
                    existingTemplate.fields = templateData.fields;
                    existingTemplate.updatedAt = new Date();
                    await existingTemplate.save();
                    
                    results.updated.push(templateData.name);
                    console.log(`  ✅ Updated template: ${templateData.name}`);
                } else {
                    const newTemplate = new FieldTemplate(templateData);
                    await newTemplate.save();
                    
                    results.created.push({
                        name: templateData.name,
                        id: newTemplate._id
                    });
                    console.log(`  ✅ Created template: ${templateData.name} (${newTemplate._id})`);
                }
            } catch (error) {
                console.error(`  ❌ Error processing template ${templateData.name}:`, error.message);
                results.errors.push({ name: templateData.name, error: error.message });
            }
        }
        
        console.log('\n========================================');
        console.log('MIGRATION SUMMARY');
        console.log('========================================\n');
        console.log(`✅ Templates created: ${results.created.length}`);
        results.created.forEach(t => console.log(`   - ${t.name} (${t.id})`));
        console.log(`\n📝 Templates updated: ${results.updated.length}`);
        results.updated.forEach(name => console.log(`   - ${name}`));
        console.log(`\n⏭️  Templates skipped: ${results.skipped.length}`);
        results.skipped.forEach(name => console.log(`   - ${name}`));
        console.log(`\n❌ Errors: ${results.errors.length}`);
        results.errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
        
        console.log('\n========================================');
        console.log('NEXT STEPS');
        console.log('========================================\n');
        console.log('1. Update species records to assign appropriate field templates');
        console.log('2. Update frontend to fetch and use field template configurations');
        console.log('3. Test animal forms with different species templates');
        console.log('4. Adjust field labels/enabled status as needed via admin panel\n');
        
        await mongoose.disconnect();
        console.log('Disconnected from database.');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ MIGRATION FAILED:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run migration
migrate();
