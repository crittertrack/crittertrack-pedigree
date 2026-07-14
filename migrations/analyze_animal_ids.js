// analyze_animal_ids.js
const mongoose = require('mongoose');
// Adjust this path if your models file is located elsewhere
const { Animal } = require('../database/models'); 

// Replace with your MongoDB connection string or set as an environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev';

const identificationFields = [
    'id_public',
    'breederAssignedId',
    'microchipNumber',
    'pedigreeRegistrationId',
    'colonyId',
    'rabiesTagNumber',
    'tattooId',
    'eartagNumber',
    'akcRegistrationNumber',
    'fciRegistrationNumber',
    'cfaRegistrationNumber',
    'workingRegistryIds', // This is an array field
    'dnaProfileId', // Added from your migration script's oldIdentificationFields
    'litterRegNumber', // Added from your migration script's oldIdentificationFields
];

async function analyzeIdentificationFields() {
    console.log('Connecting to MongoDB to analyze identification fields...');
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB.');

        const counts = {};
        identificationFields.forEach(field => {
            counts[field] = 0;
        });

        const animals = await Animal.find({}); // Fetch all animals
        console.log(`Found ${animals.length} animals in the collection.`);

        animals.forEach(animal => {
            identificationFields.forEach(field => {
                const value = animal[field];

                // Check for non-null, non-empty string, and non-empty array values
                if (value !== undefined && value !== null) {
                    if (typeof value === 'string' && value.trim() !== '') {
                        counts[field]++;
                    } else if (Array.isArray(value) && value.length > 0) {
                        counts[field]++;
                    } else if (typeof value !== 'string' && !Array.isArray(value)) {
                        // For numbers, booleans, or other types that are not empty strings/arrays
                        counts[field]++;
                    }
                }
            });
        });

        console.log('\n--- Identification Field Usage Analysis ---');
        console.log(`Total animals analyzed: ${animals.length}`);
        console.log('-----------------------------------------');

        for (const field of identificationFields) {
            console.log(`${field}: ${counts[field]} entries`);
        }

        console.log('-----------------------------------------');

    } catch (error) {
        console.error('Error during analysis:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

analyzeIdentificationFields();
