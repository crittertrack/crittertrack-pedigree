/**
 * Find public animals with deceased (actual date) parents
 * All must be public: child + at least one parent with deceasedDate
 * Usage: node find-animals-with-deceased-parents.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { PublicAnimal } = require('../database/models');

async function run() {
    try {
        const url = process.env.MONGODB_URI;
        if (!url) {
            console.error('MONGODB_URI not set in .env');
            process.exit(1);
        }

        console.log('Connecting to database...');
        await mongoose.connect(url);
        console.log('Connected!\n');

        // Query for public animals with deceased parents (actual deceasedDate, all public)
        const animalsWithDeceasedParents = await PublicAnimal.aggregate([
            // Match animals with parent references
            { 
                $match: { 
                    $or: [
                        { sireId_public: { $ne: null } }, 
                        { damId_public: { $ne: null } }
                    ] 
                } 
            },
            
            // Lookup sire details
            { 
                $lookup: { 
                    from: 'publicanimals', 
                    localField: 'sireId_public', 
                    foreignField: 'id_public', 
                    as: 'sireData' 
                } 
            },
            
            // Lookup dam details
            { 
                $lookup: { 
                    from: 'publicanimals', 
                    localField: 'damId_public', 
                    foreignField: 'id_public', 
                    as: 'damData' 
                } 
            },
            
            // Filter where at least one parent is public AND has deceasedDate populated
            { 
                $match: { 
                    $or: [
                        { 
                            'sireData': { $ne: [] },
                            'sireData.0.deceasedDate': { $exists: true, $ne: null }
                        }, 
                        { 
                            'damData': { $ne: [] },
                            'damData.0.deceasedDate': { $exists: true, $ne: null }
                        }
                    ] 
                } 
            },
            
            // Project relevant fields
            {
                $project: {
                    id_public: 1,
                    name: 1,
                    prefix: 1,
                    suffix: 1,
                    sireId_public: 1,
                    sireName: { $arrayElemAt: ['$sireData.name', 0] },
                    sirePrefix: { $arrayElemAt: ['$sireData.prefix', 0] },
                    sireDeceasedDate: { $arrayElemAt: ['$sireData.deceasedDate', 0] },
                    damId_public: 1,
                    damName: { $arrayElemAt: ['$damData.name', 0] },
                    damPrefix: { $arrayElemAt: ['$damData.prefix', 0] },
                    damDeceasedDate: { $arrayElemAt: ['$damData.deceasedDate', 0] }
                }
            },
            
            // Limit to first 20 results
            { $limit: 20 }
        ]).exec();

        console.log(`Found ${animalsWithDeceasedParents.length} animals with public parents who have deceased dates:\n`);
        
        animalsWithDeceasedParents.forEach(animal => {
            const fullName = [animal.prefix, animal.name].filter(Boolean).join(' ');
            console.log(`\n${animal.id_public} — ${fullName}`);
            
            if (animal.sireDeceasedDate) {
                const deceasedDate = new Date(animal.sireDeceasedDate).toLocaleDateString();
                const sireName = [animal.sirePrefix, animal.sireName].filter(Boolean).join(' ');
                console.log(`  ♂ Sire: ${animal.sireId_public} (${sireName}) — † ${deceasedDate}`);
            }
            
            if (animal.damDeceasedDate) {
                const deceasedDate = new Date(animal.damDeceasedDate).toLocaleDateString();
                const damName = [animal.damPrefix, animal.damName].filter(Boolean).join(' ');
                console.log(`  ♀ Dam: ${animal.damId_public} (${damName}) — † ${deceasedDate}`);
            }
        });

        if (animalsWithDeceasedParents.length === 0) {
            console.log('No public animals with public deceased parents (deceasedDate populated) found.');
        } else {
            console.log(`\n\nTotal: ${animalsWithDeceasedParents.length} animals found`);
        }

        mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();

