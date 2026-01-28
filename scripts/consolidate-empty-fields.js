const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Animal, GeneticsData, Species, SpeciesConfig, User } = require('../database/models');

// Helper function to recursively convert empty values to null
function normalizeObject(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') {
        if (obj === '' || obj === undefined) return null;
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => normalizeObject(item));
    }
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            normalized[key] = null;
        } else if (value === '') {
            normalized[key] = null;
        } else if (typeof value === 'object') {
            normalized[key] = normalizeObject(value);
        } else {
            normalized[key] = value;
        }
    }
    return normalized;
}

async function consolidateEmptyFields() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Track stats
        let stats = {
            animals: 0,
            genetics: 0,
            species: 0,
            speciesConfig: 0,
            users: 0
        };

        // Consolidate Animals
        console.log('\n🔄 Processing Animals...');
        let animals = await Animal.find({});
        for (let animal of animals) {
            let normalized = normalizeObject(animal.toObject());
            let changed = JSON.stringify(animal.toObject()) !== JSON.stringify(normalized);
            if (changed) {
                await Animal.updateOne(
                    { _id: animal._id },
                    { $set: normalized }
                );
                stats.animals++;
                if (stats.animals % 100 === 0) {
                    console.log(`  ✓ Updated ${stats.animals} animals...`);
                }
            }
        }
        console.log(`✓ Animals: ${stats.animals} documents updated`);

        // Consolidate GeneticsData
        console.log('\n🔄 Processing GeneticsData...');
        let geneticsDataList = await GeneticsData.find({});
        for (let geneticsData of geneticsDataList) {
            let normalized = normalizeObject(geneticsData.toObject());
            let changed = JSON.stringify(geneticsData.toObject()) !== JSON.stringify(normalized);
            if (changed) {
                await GeneticsData.updateOne(
                    { _id: geneticsData._id },
                    { $set: normalized }
                );
                stats.genetics++;
                if (stats.genetics % 10 === 0) {
                    console.log(`  ✓ Updated ${stats.genetics} genetics documents...`);
                }
            }
        }
        console.log(`✓ GeneticsData: ${stats.genetics} documents updated`);

        // Consolidate Species
        console.log('\n🔄 Processing Species...');
        let species = await Species.find({});
        for (let s of species) {
            let normalized = normalizeObject(s.toObject());
            let changed = JSON.stringify(s.toObject()) !== JSON.stringify(normalized);
            if (changed) {
                await Species.updateOne(
                    { _id: s._id },
                    { $set: normalized }
                );
                stats.species++;
            }
        }
        console.log(`✓ Species: ${stats.species} documents updated`);

        // Consolidate SpeciesConfig
        console.log('\n🔄 Processing SpeciesConfig...');
        let speciesConfigs = await SpeciesConfig.find({});
        for (let config of speciesConfigs) {
            let normalized = normalizeObject(config.toObject());
            let changed = JSON.stringify(config.toObject()) !== JSON.stringify(normalized);
            if (changed) {
                await SpeciesConfig.updateOne(
                    { _id: config._id },
                    { $set: normalized }
                );
                stats.speciesConfig++;
            }
        }
        console.log(`✓ SpeciesConfig: ${stats.speciesConfig} documents updated`);

        // Consolidate Users
        console.log('\n🔄 Processing Users...');
        let users = await User.find({});
        for (let user of users) {
            let normalized = normalizeObject(user.toObject());
            let changed = JSON.stringify(user.toObject()) !== JSON.stringify(normalized);
            if (changed) {
                await User.updateOne(
                    { _id: user._id },
                    { $set: normalized }
                );
                stats.users++;
            }
        }
        console.log(`✓ Users: ${stats.users} documents updated`);

        console.log('\n✅ Consolidation complete!');
        console.log('Summary:', stats);
        console.log('\nAll empty strings and undefined values have been converted to null');
    } catch (error) {
        console.error('Error during consolidation:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
        process.exit(0);
    }
}

consolidateEmptyFields();
