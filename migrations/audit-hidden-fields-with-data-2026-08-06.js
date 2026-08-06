// Read-only diagnostic: for each species category, checks whether any *actually-used*
// species (from the 2026-08-05 usage audit) has real data populated in fields the new
// frontend species-template system (speciesFieldTemplates.js) hides for that category.
// Helps decide whether hiding a field would bury pre-existing user data.
// Run with: node migrations/audit-hidden-fields-with-data-2026-08-06.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

// Mirrors HIDDEN_FIELDS_BY_CATEGORY in crittertrack-frontend/src/utils/speciesFieldTemplates.js
const HIDDEN_FIELDS_BY_CATEGORY = {
    Amphibian: [
        'earset', 'heightAtWithers', 'eartagNumber', 'heatStatus', 'lastHeatDate', 'estrusCycleLength',
        'isNursing', 'nursingStartDate', 'weaningDate', 'heartwormStatus', 'hipElbowScores', 'eyeClearance',
        'cardiacClearance', 'reproductiveClearances', 'sheddingLevel', 'brushingFrequency', 'coatCareNotes',
        'brushingSchedule', 'freeFlightTrained', 'flightRiskTrainingSchedule', 'leashTrained', 'leashTrainingSchedule',
        'crateTrained', 'crateTrainingSchedule', 'litterTrained', 'litterTrainingSchedule', 'nailColor', 'strain',
        'pedigreeRegistrationId', 'tattooId', 'exerciseRequirements', 'dailyExerciseMinutes', 'trainingLevel',
        'trainingDisciplines', 'certifications', 'workingRole', 'workingRoleTrainingSchedule',
        'behavioralIssueTrainingSchedule', 'reactivityTrainingSchedule', 'exerciseSchedule', 'attachmentStyle',
        'bondingBehavior',
    ],
    Bird: [
        'earset', 'heightAtWithers', 'eartagNumber', 'heatStatus', 'lastHeatDate', 'estrusCycleLength',
        'isNursing', 'nursingStartDate', 'weaningDate', 'heartwormStatus', 'hipElbowScores', 'eyeClearance',
        'cardiacClearance', 'reproductiveClearances', 'dentalRecords', 'dentalCareRequirements', 'dentalCareSchedule',
        'sheddingRecords', 'waterParameterChecks', 'brushingFrequency', 'coatCareNotes', 'brushingSchedule', 'strain', 'tattooId',
    ],
    Fish: [
        'earset', 'heightAtWithers', 'eartagNumber', 'ringId', 'nailColor', 'heatStatus', 'lastHeatDate',
        'estrusCycleLength', 'isNursing', 'nursingStartDate', 'weaningDate', 'isNeutered', 'spayNeuterDate',
        'heartwormStatus', 'hipElbowScores', 'eyeClearance', 'cardiacClearance', 'reproductiveClearances',
        'sheddingRecords', 'moltingRecords', 'sheddingLevel', 'brushingFrequency', 'coatCareNotes', 'brushingSchedule',
        'freeFlightTrained', 'flightRiskTrainingSchedule', 'leashTrained', 'leashTrainingSchedule', 'crateTrained',
        'crateTrainingSchedule', 'litterTrained', 'litterTrainingSchedule', 'breed', 'bodyConditionScore',
        'pedigreeRegistrationId', 'tattooId', 'studFeeCurrency', 'studFeeAmount', 'exerciseRequirements',
        'dailyExerciseMinutes', 'trainingLevel', 'trainingDisciplines', 'certifications', 'workingRole',
        'workingRoleTrainingSchedule', 'behavioralIssueTrainingSchedule', 'reactivityTrainingSchedule',
        'exerciseSchedule', 'attachmentStyle', 'bondingBehavior',
    ],
    Invertebrate: [
        'earset', 'nailColor', 'heightAtWithers', 'eartagNumber', 'microchipNumber', 'heatStatus', 'lastHeatDate',
        'estrusCycleLength', 'isNursing', 'nursingStartDate', 'weaningDate', 'isNeutered', 'spayNeuterDate',
        'artificialInseminationUsed', 'dewormingRecords', 'allergies', 'heartwormStatus', 'hipElbowScores',
        'eyeClearance', 'cardiacClearance', 'reproductiveClearances', 'dentalRecords', 'dentalCareRequirements', 'dentalCareSchedule',
        'sheddingRecords', 'waterParameterChecks', 'vaccinations', 'sheddingLevel', 'brushingFrequency',
        'coatCareNotes', 'brushingSchedule', 'leashTrained', 'leashTrainingSchedule', 'crateTrained',
        'crateTrainingSchedule', 'litterTrained', 'litterTrainingSchedule', 'bodyConditionScore',
        'pedigreeRegistrationId', 'tattooId', 'studFeeCurrency', 'studFeeAmount', 'exerciseRequirements',
        'dailyExerciseMinutes', 'trainingLevel', 'trainingDisciplines', 'certifications', 'workingRole',
        'workingRoleTrainingSchedule', 'behavioralIssueTrainingSchedule', 'reactivityTrainingSchedule',
        'exerciseSchedule', 'attachmentStyle', 'bondingBehavior',
    ],
    Mammal: [
        'sheddingRecords', 'moltingRecords', 'waterParameterChecks', 'freeFlightTrained',
        'flightRiskTrainingSchedule',
    ],
    Reptile: [
        'earset', 'heightAtWithers', 'eartagNumber', 'heatStatus', 'lastHeatDate', 'estrusCycleLength',
        'isNursing', 'nursingStartDate', 'weaningDate', 'heartwormStatus', 'hipElbowScores', 'eyeClearance',
        'cardiacClearance', 'reproductiveClearances', 'sheddingLevel', 'brushingFrequency', 'coatCareNotes',
        'brushingSchedule', 'freeFlightTrained', 'flightRiskTrainingSchedule', 'crateTrained',
        'crateTrainingSchedule', 'litterTrained', 'litterTrainingSchedule', 'strain', 'tattooId',
        'exerciseRequirements', 'dailyExerciseMinutes', 'trainingLevel', 'trainingDisciplines', 'certifications',
        'workingRole', 'workingRoleTrainingSchedule', 'behavioralIssueTrainingSchedule', 'reactivityTrainingSchedule',
        'exerciseSchedule',
    ],
    Other: [],
};

// Species -> category, using the exact names seen live in the DB (including casing quirks).
const SPECIES_CATEGORY = {
    'Fancy Mouse': 'Mammal', 'Fancy Rat': 'Mammal', 'Campbells Dwarf Hamster': 'Mammal',
    'Syrian Hamster': 'Mammal', 'Rabbit': 'Mammal', 'Ferret': 'Mammal', 'Fat-tailed Gerbil': 'Mammal',
    'Roborovski Dwarf Hamster': 'Mammal', 'Guinea Pig': 'Mammal', 'Cat': 'Mammal',
    'Chinese Dwarf Hamster': 'Mammal', 'Natal Rats': 'Mammal', 'Deer mouse': 'Mammal',
    'Thicktail Gecko': 'Reptile', 'Centralian Rough Knobtail Gecko': 'Reptile', 'Banded Knobtails Gecko': 'Reptile',
    'Pilbara Knobtail Gecko': 'Reptile', 'Cape African House Snake': 'Reptile', 'Ball Python': 'Reptile',
    '3 Lined Knobtail Gecko': 'Reptile', 'Giant Day Gecko': 'Reptile', 'Corn Snake': 'Reptile',
    'Eastern Kingsnake': 'Reptile', 'Bearded Dragon': 'Reptile',
    'Budgie': 'Bird', 'Cockatiel': 'Bird',
    'Plum isopod': 'Invertebrate', 'Pill millipede': 'Invertebrate', 'Roly-Poly isopod': 'Invertebrate',
    'Curlyhair Tarantula': 'Invertebrate', 'Giant Yellow Spotted Isopod': 'Invertebrate',
    'Gooty Sapphire Ornamental Tarantula': 'Invertebrate', 'Smooth Isopod': 'Invertebrate', 'Cubaris Isopod': 'Invertebrate',
};

// How to detect "has real data" per field, based on its Animal schema type/default.
const SCHEDULE_FIELDS = new Set([
    'brushingSchedule', 'flightRiskTrainingSchedule', 'leashTrainingSchedule', 'crateTrainingSchedule',
    'litterTrainingSchedule', 'workingRoleTrainingSchedule', 'behavioralIssueTrainingSchedule',
    'reactivityTrainingSchedule', 'exerciseSchedule', 'dentalCareSchedule',
]);
const BOOL_TRUE_FIELDS = new Set([
    'isNursing', 'freeFlightTrained', 'leashTrained', 'crateTrained', 'litterTrained', 'isNeutered', 'artificialInseminationUsed',
]);
const ARRAY_FIELDS = new Set(['dewormingRecords', 'allergies', 'vaccinations']);
const SKIP_FIELDS = new Set(['studFeeCurrency']); // default 'USD' isn't meaningful on its own; studFeeAmount covers it

function conditionFor(field) {
    if (SCHEDULE_FIELDS.has(field)) {
        return { $or: [{ [`${field}.lastDoneDate`]: { $ne: null } }, { [`${field}.frequencyDays`]: { $ne: null } }] };
    }
    if (BOOL_TRUE_FIELDS.has(field)) return { [field]: true };
    if (ARRAY_FIELDS.has(field)) return { [`${field}.0`]: { $exists: true } };
    if (field === 'attachmentStyle') return { [field]: { $nin: [null, '', 'Unknown'] } };
    return { [field]: { $nin: [null, ''] } };
}

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');

    // Group used species by category
    const speciesByCategory = {};
    for (const [name, cat] of Object.entries(SPECIES_CATEGORY)) {
        (speciesByCategory[cat] = speciesByCategory[cat] || []).push(name);
    }

    let anyFindings = false;
    for (const [category, speciesNames] of Object.entries(speciesByCategory)) {
        const hiddenFields = HIDDEN_FIELDS_BY_CATEGORY[category] || [];
        console.log(`\n=== ${category} (species: ${speciesNames.join(', ')}) ===`);
        let categoryHasFindings = false;
        for (const field of hiddenFields) {
            if (SKIP_FIELDS.has(field)) continue;
            const query = { species: { $in: speciesNames }, ...conditionFor(field) };
            const count = await Animal.countDocuments(query);
            if (count > 0) {
                categoryHasFindings = true;
                anyFindings = true;
                const examples = await Animal.find(query).select('id_public name species').limit(3).lean();
                const exampleStr = examples.map(e => `${e.name} (${e.species}, ${e.id_public})`).join('; ');
                console.log(`  HAS DATA: ${field} -> ${count} animal(s). e.g. ${exampleStr}`);
            }
        }
        if (!categoryHasFindings) console.log('  (no hidden fields have any data - safe to hide)');
    }

    if (!anyFindings) console.log('\nNo hidden fields contain any existing data across any actively-used species.');

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
