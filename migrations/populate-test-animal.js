const { MongoClient } = require('mongodb');

// --- USER CONFIGURATION ---
// This script now connects directly to your database.
// WARNING: This contains sensitive credentials. Do not commit this file to a public repository.
const MONGODB_URI = "mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev";
const DATABASE_NAME = 'crittertrackdb';
// --------------------------

const generatedData = {
    // Overview
    name: 'Dashboard Demo',
    prefix: 'Test',
    suffix: 'v2',
    species: 'Fancy Mouse',
    breed: 'Standard',
    strain: 'Black/Tan Line',
    gender: 'Female',
    birthDate: '2025-01-15T00:00:00.000Z',
    status: 'Breeder',
    lifeStage: 'Adult',
    origin: 'Captive-bred',
    tags: ['Show Winner', 'Line A', 'High Yield'],
    imageUrl: 'https://critter-track-dev.s3.amazonaws.com/animal-images/6673624a63115edde0c3f5b0-1718837322839.jpg', // Example image
    photoUrl: 'https://critter-track-dev.s3.amazonaws.com/animal-images/6673624a63115edde0c3f5b0-1718837322839.jpg', // Legacy support
    extraImages: [
        'https://critter-track-dev.s3.amazonaws.com/animal-images/6673624a63115edde0c3f5b0-1718837322839.jpg',
        'https://critter-track-dev.s3.amazonaws.com/animal-images/6673624a63115edde0c3f5b0-1718837322839.jpg'
    ],

    // Identification
    breederAssignedId: 'DD-01',
    microchipNumber: '981020012345678',
    pedigreeRegistrationId: 'FM-REG-991',
    colonyId: 'COLONY-A',
    tattooId: 'R-EAR-01',
    ringId: 'BAND-001',
    eartagNumber: 'ET-991',
    dnaProfile: 'ISAG2020-12345',    
    identifiers: [
        { title: 'Lab ID', value: 'LAB-X-55' },
        { title: 'Registry ID', value: 'OTHER-REG-77' }
    ],

    // Appearance
    color: 'Black Tan',
    coatPattern: 'Banded',
    coat: 'Standard',
    earset: 'Standard',
    phenotype: 'Show Quality',
    morph: 'N/A',
    markings: 'Head spot',
    eyeColor: 'Black',
    nailColor: 'Pink',
    size: 'Medium',
    carrierTraits: 're, p, d',
    geneticCode: 'a/a B/b C/c D/d P/p',

    // Ownership & Legal
    isOwned: true,
    isDisplay: true,
    coOwnership: 'Co-owned with Example Breeder for two litters.',
    purchaseDate: '2025-03-01T00:00:00.000Z',
    purchasePrice: '50.00',
    purchasePriceCurrency: 'USD',
    purchaseLocation: 'Online Breeder',
    isForSale: true,
    salePriceAmount: '100.00',
    salePriceCurrency: 'USD',
    saleDate: null,
    saleLocation: null,
    licenseNumber: 'LIC-12345-AB',
    licenseJurisdiction: 'State of Example',
    insurance: 'PetPlan - Policy #PP-98765',
    legalStatus: 'Clear',
    breedingRestrictions: 'Not to be bred with piebald lines.',
    exportRestrictions: 'Not for export outside North America.',
    keeperHistory: [
        { name: 'Original Breeder', userId_public: 'CTC-USER-1', country: 'US' },
        { name: 'Second Owner', userId_public: null, country: 'CA' }
    ],

    // Health
    healthStatus: 'Excellent',
    quarantineStatus: { active: false, startDate: null, endDate: null, reason: '' },
    vaccinations: [{ name: 'Standard Yearly', date: '2026-01-10' }],
    dewormingRecords: [{ medication: 'Ivermectin', date: '2026-06-01' }],
    medicalConditions: [{ condition: 'Slightly sensitive to dust', notes: 'Use paper bedding.', status: 'active', severity: 'minor' }],
    allergies: [{ allergen: 'Cedar bedding', reaction: 'Sneezing' }],
    medications: [{ medication: 'None', status: 'inactive' }],
    vetVisits: [{ reason: 'Annual Checkup', date: '2026-01-10', vetName: 'Dr. Smith' }],
    primaryVet: 'Dr. Smith',
    spayNeuterDate: null,
    heartwormStatus: 'Negative',
    hipElbowScores: 'Not Applicable',
    geneticHealth: [{ test: 'Myco-PCR', result: 'Negative', date: '2025-02-01' }],
    healthTests: [{ test: 'Fecal Float', result: 'Clear', date: '2026-01-10' }],
    healthNotes: 'Overall very healthy animal. Good weight and temperament.',

    // Care & Behavior
    dietType: 'Lab Blocks & Seed Mix',
    feedingSchedule: 'Daily',
    supplements: 'Calcium drops in water twice a week.',
    enclosureId: null, // This would be a real ObjectId
    housingType: 'Tank with wire mesh lid',
    bedding: 'Aspen shavings',
    enrichment: 'Wheels, tubes, and chew toys.',    
    careTasks: [{ taskName: 'Enclosure full clean', frequencyDays: 14, lastDoneDate: '2026-07-01' }],
    animalCareTasks: [{ taskName: 'Nail trim', frequencyDays: 30, lastDoneDate: '2026-06-15' }],
    handlingNotes: 'Very friendly, enjoys being handled.',
    socializationNotes: 'Housed with two other females, gets along well.',
    specialCareRequirements: 'Ensure bedding is low-dust.',
    temperatureRange: '68-75°F',
    humidity: '40-60%',
    lighting: 'Natural room light',
    noise: 'Tolerates normal household noise.',
    exerciseRequirements: 'Daily wheel access',
    dailyExerciseMinutes: 60,
    groomingNeeds: 'Minimal, self-groomer.',
    sheddingLevel: 'Low',
    crateTrained: true,
    litterTrained: false,
    leashTrained: false,
    freeFlightTrained: false,
    temperament: 'Curious and Active',
    handlingTolerance: 'High',
    socialStructure: 'Group-housed female',
    activityCycle: 'Nocturnal',
    trainingLevel: 'Basic',
    trainingDisciplines: 'N/A',
    workingRole: 'Pet/Breeder',
    certifications: 'N/A',
    behavioralIssues: 'None noted.',
    biteHistory: 'No bites recorded.',
    reactivityNotes: 'Not reactive.',
    
    // Measurements
    measurementUnits: { weight: 'g', length: 'cm' },
    bodyWeight: '34',
    bodyLength: '10.5',
    heightAtWithers: '3',
    chestGirth: '5',
    adultWeight: '32',
    bodyConditionScore: '3/5',
    length: '10.5', // Redundant with bodyLength, but for completeness
    growthRecords: [
        { date: '2025-02-01', weight: '15', length: '5', notes: 'Weaning weight' },
        { date: '2025-04-01', weight: '25', length: '8' },
        { date: '2025-06-01', weight: '32', length: '10', notes: 'Reached adult size' },
        { date: '2025-08-01', weight: '33', length: '10' },
        { date: '2025-10-01', weight: '34', length: '10.5' },
    ],

    // Fertility
    isNeutered: false,
    isInfertile: false,
    isInMating: false,
    isPregnant: false,
    isNursing: false,
    availableForBreeding: true,
    studFeeAmount: null,
    studFeeCurrency: null,
    isDamAnimal: true,
    damFertilityStatus: 'Proven',
    heatStatus: 'Normal',
    lastHeatDate: '2026-06-20T00:00:00.000Z',
    ovulationDate: null,
    estrusCycleLength: 5,
    gestationLength: 21,
    deliveryMethod: 'Natural',
    whelpingDate: null,
    queeningDate: null,
    damFertilityNotes: 'Consistently produces large, healthy litters.',
    reproductiveClearances: 'Cleared for breeding by vet.',
    reproductiveComplications: 'None.',
    lastMatingDate: '2026-03-01T00:00:00.000Z',
    lastPregnancyDate: '2026-03-01T00:00:00.000Z',
    litterCount: 1,
    offspringCount: 8,

    // Show & Notes
    showTitles: '1st Place at National Mouse Show 2026',
    showRatings: 'Excellent Type, Good Color',
    judgeComments: 'A very promising young doe. Excellent head and ear set. Tail could be slightly longer.',
    workingTitles: 'N/A',    
    performanceScores: 'N/A',
    remarks: 'This is a test animal for demonstrating the new dashboard layout. All data is generated.',
    milestones: [
        { label: 'Born', startDate: '2025-01-15' },
        { label: 'Weaned', startDate: '2025-02-10' },
        { label: 'First Show', startDate: '2025-09-05' },
        { label: 'First Litter', startDate: '2026-03-20' },
    ],

    // End of Life
    deceasedDate: null,
    causeOfDeath: null,
    necropsyResults: null,
    endOfLifeCareNotes: null,

    // Manual Pedigree
    manualPedigree: {},
};

const childData = {
    ...generatedData,
    sireId_public: 'CTC6995',
    damId_public: 'CTC6996',
};

const sireData = {
    ...generatedData,
    name: 'Demo Sire',
    suffix: 'v1',
    gender: 'Male',
    birthDate: '2024-02-20T00:00:00.000Z',
    status: 'Retired',
    tags: ['Sire Line', 'Foundation'],

    // Identification overrides
    breederAssignedId: 'DS-01',
    microchipNumber: '981020087654321',
    pedigreeRegistrationId: 'FM-REG-995',
    tattooId: 'L-EAR-05',

    geneticCode: 'a/a B/B C/c D/d P/p',
    isDamAnimal: false,
    isSireAnimal: true,
    sireFertilityStatus: 'Proven',
    fertilityNotes: 'Very reliable sire.',
    availableForBreeding: false, // Retired
    damFertilityStatus: null,    
    remarks: 'This is the sire for the demo animal CTC6991.',
    growthRecords: [
        { date: '2024-03-20', weight: '15', length: '5' },
        { date: '2024-05-20', weight: '30', length: '9' },
        { date: '2024-07-20', weight: '35', length: '11', notes: 'Reached adult size' },
    ],
    milestones: [
        { label: 'Born', startDate: '2024-02-20' },
        { label: 'Weaned', startDate: '2024-03-18' },
        { label: 'Paired', startDate: '2025-01-01' },
    ],
    showTitles: '',
};

const damData = {
    ...generatedData,
    name: 'Demo Dam',
    suffix: 'v1',
    gender: 'Female',
    birthDate: '2024-03-15T00:00:00.000Z',
    status: 'Breeder',
    tags: ['Dam Line', 'High Yield'],

    // Identification overrides
    breederAssignedId: 'DD-02',
    microchipNumber: '981020011223344',
    pedigreeRegistrationId: 'FM-REG-996',
    colonyId: 'COLONY-B',
    tattooId: 'R-EAR-06',

    geneticCode: 'a/a b/b C/c D/d p/p',
    isDamAnimal: true,
    isSireAnimal: false,
    damFertilityStatus: 'Proven',
    availableForBreeding: true,
    sireFertilityStatus: null,    
    remarks: 'This is the dam for the demo animal CTC6991.',
    growthRecords: [
        { date: '2024-04-15', weight: '14', length: '5' },
        { date: '2024-06-15', weight: '28', length: '8' },
        { date: '2024-08-15', weight: '31', length: '10', notes: 'Reached adult size' },
    ],
    milestones: [
        { label: 'Born', startDate: '2024-03-15' },
        { label: 'Weaned', startDate: '2024-04-10' },
        { label: 'First Litter', startDate: '2025-01-15' },
    ],
    showTitles: 'Best of Breed 2025',
};

const animalsToUpdate = [
    { id_public: 'CTC6991', data: childData },
    { id_public: 'CTC6995', data: sireData },
    { id_public: 'CTC6996', data: damData },
];

async function updateAnimals() {
    if (!MONGODB_URI || MONGODB_URI.includes('<password>')) {
        console.error('Error: Please provide a valid MONGODB_URI in the script.');
        return;
    }

    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Successfully connected to the database.');

        const database = client.db(DATABASE_NAME);
        const animalsCollection = database.collection('animals');

        for (const animal of animalsToUpdate) {
            console.log(`Attempting to update animal with id_public: ${animal.id_public}...`);

            const result = await animalsCollection.updateOne(
                { id_public: animal.id_public },
                { $set: animal.data }
            );

            if (result.matchedCount === 0) {
                console.error(`Error: No animal found with id_public: ${animal.id_public}`);
            } else if (result.modifiedCount === 0) {
                console.warn(`Warning: Animal ${animal.id_public} was found, but no fields were modified. The data might already be up to date.`);
            } else {
                console.log(`Successfully updated ${result.modifiedCount} document(s) for ${animal.id_public}.`);
            }
        }
        console.log('All updates complete. Refresh the application to see the changes.');

    } catch (error) {
        console.error('Failed to update animals:', error);
    } finally {
        await client.close();
        console.log('Database connection closed.');
    }
}

updateAnimals();