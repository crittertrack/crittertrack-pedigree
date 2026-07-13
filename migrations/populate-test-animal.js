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

    // Identification
    breederAssignedId: 'DD-01',
    microchipNumber: '981020012345678',
    pedigreeRegistrationId: 'FM-REG-991',
    colonyId: 'COLONY-A',
    tattooId: 'R-EAR-01',

    // Appearance
    color: 'Black Tan',
    coatPattern: 'Banded',
    coat: 'Standard',
    markings: 'Head spot',
    carrierTraits: 're, p, d',
    geneticCode: 'a/a B/b C/c D/d P/p',

    // Ownership & Legal
    isOwned: true,
    isDisplay: true,
    coOwnership: 'Co-owned with Example Breeder for two litters.',
    purchaseDate: '2025-03-01T00:00:00.000Z',
    purchasePrice: '50.00',
    purchasePriceCurrency: 'USD',
    licenseNumber: 'LIC-12345-AB',
    breedingRestrictions: 'Not to be bred with piebald lines.',
    keeperHistory: [
        { name: 'Original Breeder', userId_public: 'CTC-USER-1', country: 'US' },
        { name: 'Second Owner', userId_public: null, country: 'CA' }
    ],

    // Health
    healthStatus: 'Excellent',
    vaccinations: JSON.stringify([{ name: 'Standard Yearly', date: '2026-01-10' }]),
    dewormingRecords: JSON.stringify([{ medication: 'Ivermectin', date: '2026-06-01' }]),
    medicalConditions: JSON.stringify([{ condition: 'Slightly sensitive to dust', notes: 'Use paper bedding.' }]),
    allergies: JSON.stringify([{ allergen: 'Cedar bedding' }]),
    medications: JSON.stringify([{ medication: 'None' }]),
    vetVisits: JSON.stringify([{ reason: 'Annual Checkup', date: '2026-01-10' }]),
    primaryVet: 'Dr. Smith',
    spayNeuterDate: null,
    heartwormStatus: 'Negative',
    hipElbowScores: 'Not Applicable',

    // Care & Behavior
    dietType: 'Lab Blocks & Seed Mix',
    feedingSchedule: 'Daily',
    handlingNotes: 'Very friendly, enjoys being handled.',
    socializationNotes: 'Housed with two other females, gets along well.',
    temperament: 'Curious and Active',
    activityCycle: 'Nocturnal',
    
    // Measurements
    measurementUnits: { weight: 'g', length: 'cm' },
    growthRecords: JSON.stringify([
        { date: '2025-02-01', weight: '15', length: '5', notes: 'Weaning weight' },
        { date: '2025-04-01', weight: '25', length: '8' },
        { date: '2025-06-01', weight: '32', length: '10', notes: 'Reached adult size' },
        { date: '2025-08-01', weight: '33', length: '10' },
        { date: '2025-10-01', weight: '34', length: '10.5' },
    ]),

    // Fertility
    isNeutered: false,
    isInfertile: false,
    isInMating: false,
    isPregnant: false,
    isNursing: false,
    isDamAnimal: true,
    damFertilityStatus: 'Proven',

    // Show & Notes
    showTitles: '1st Place at National Mouse Show 2026',
    remarks: 'This is a test animal for demonstrating the new dashboard layout. All data is generated.',
    milestones: JSON.stringify([
        { label: 'Born', startDate: '2025-01-15' },
        { label: 'Weaned', startDate: '2025-02-10' },
        { label: 'First Show', startDate: '2025-09-05' },
        { label: 'First Litter', startDate: '2026-03-20' },
    ]),
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
    damFertilityStatus: null,
    remarks: 'This is the sire for the demo animal CTC6991.',
    growthRecords: JSON.stringify([
        { date: '2024-03-20', weight: '15', length: '5' },
        { date: '2024-05-20', weight: '30', length: '9' },
        { date: '2024-07-20', weight: '35', length: '11', notes: 'Reached adult size' },
    ]),
    milestones: JSON.stringify([
        { label: 'Born', startDate: '2024-02-20' },
        { label: 'Weaned', startDate: '2024-03-18' },
        { label: 'Paired', startDate: '2025-01-01' },
    ]),
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
    sireFertilityStatus: null,
    remarks: 'This is the dam for the demo animal CTC6991.',
    growthRecords: JSON.stringify([
        { date: '2024-04-15', weight: '14', length: '5' },
        { date: '2024-06-15', weight: '28', length: '8' },
        { date: '2024-08-15', weight: '31', length: '10', notes: 'Reached adult size' },
    ]),
    milestones: JSON.stringify([
        { label: 'Born', startDate: '2024-03-15' },
        { label: 'Weaned', startDate: '2024-04-10' },
        { label: 'First Litter', startDate: '2025-01-15' },
    ]),
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