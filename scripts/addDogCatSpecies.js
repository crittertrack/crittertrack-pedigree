/**
 * Script to add Dog and Cat as default species with proper field configurations
 * Run with: node scripts/addDogCatSpecies.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Species, SpeciesConfig } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI;

// Dog species configuration
const dogConfig = {
    speciesName: 'Dog',
    fieldReplacements: {
        // Identification tab
        'breederyId': 'Internal ID',
        'strain': 'Bloodline',
        // Reproduction - rename to canine terminology
        'heatStatus': 'Estrus Status',
        'lastHeatDate': 'Last Estrus Date',
        'ovulationDate': 'Estimated Ovulation Date',
        // Origin
        'origin': 'Origin/Source'
    },
    hiddenFields: [
        // Rodent-specific fields to hide
        'earset',
        'housingType',
        'noise',
        'bedding',
        'geneticCode' // Rodent genetics calculator specific
    ],
    customFields: [],
    adminNotes: 'Default Dog species configuration. Includes canine-specific fields for registration, health clearances, and training.'
};

// Cat species configuration
const catConfig = {
    speciesName: 'Cat',
    fieldReplacements: {
        // Identification tab
        'breederyId': 'Internal ID',
        'strain': 'Bloodline',
        // Reproduction - rename to feline terminology
        'heatStatus': 'Estrus Status',
        'lastHeatDate': 'Last Estrus Date',
        'ovulationDate': 'Estimated Ovulation Date',
        // Origin
        'origin': 'Origin/Source'
    },
    hiddenFields: [
        // Rodent-specific fields to hide
        'earset',
        'housingType',
        'noise',
        'bedding',
        'geneticCode' // Rodent genetics calculator specific
    ],
    customFields: [],
    adminNotes: 'Default Cat species configuration. Includes feline-specific fields for registration and health clearances.'
};

async function addDogCatSpecies() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Add Dog species
        const existingDog = await Species.findOne({ name: 'Dog' });
        if (!existingDog) {
            const dog = new Species({
                name: 'Dog',
                latinName: 'Canis lupus familiaris',
                category: 'Mammal',
                isDefault: true,
                userId: null
            });
            await dog.save();
            console.log('✅ Added Dog species');
        } else {
            console.log('⏭️  Dog species already exists');
        }

        // Add Cat species
        const existingCat = await Species.findOne({ name: 'Cat' });
        if (!existingCat) {
            const cat = new Species({
                name: 'Cat',
                latinName: 'Felis catus',
                category: 'Mammal',
                isDefault: true,
                userId: null
            });
            await cat.save();
            console.log('✅ Added Cat species');
        } else {
            console.log('⏭️  Cat species already exists');
        }

        // Add Dog config
        const existingDogConfig = await SpeciesConfig.findOne({ speciesName: 'Dog' });
        if (!existingDogConfig) {
            const dogConfigDoc = new SpeciesConfig(dogConfig);
            await dogConfigDoc.save();
            console.log('✅ Added Dog species configuration');
        } else {
            // Update existing config
            await SpeciesConfig.updateOne({ speciesName: 'Dog' }, { $set: dogConfig });
            console.log('🔄 Updated Dog species configuration');
        }

        // Add Cat config
        const existingCatConfig = await SpeciesConfig.findOne({ speciesName: 'Cat' });
        if (!existingCatConfig) {
            const catConfigDoc = new SpeciesConfig(catConfig);
            await catConfigDoc.save();
            console.log('✅ Added Cat species configuration');
        } else {
            // Update existing config
            await SpeciesConfig.updateOne({ speciesName: 'Cat' }, { $set: catConfig });
            console.log('🔄 Updated Cat species configuration');
        }

        console.log('\n📋 Summary:');
        const allSpecies = await Species.find({ isDefault: true }).sort({ name: 1 });
        console.log('Default species:');
        allSpecies.forEach(s => console.log(`  - ${s.name} (${s.category})`));

        const allConfigs = await SpeciesConfig.find({});
        console.log('\nSpecies configurations:');
        allConfigs.forEach(c => {
            const replacements = c.fieldReplacements ? Object.keys(c.fieldReplacements).length : 0;
            const hidden = c.hiddenFields ? c.hiddenFields.length : 0;
            console.log(`  - ${c.speciesName}: ${replacements} field replacements, ${hidden} hidden fields`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

addDogCatSpecies();
