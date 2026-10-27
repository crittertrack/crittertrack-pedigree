require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

let A, P;

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        A = require('../database/models').Animal;
        P = require('../database/models').PublicAnimal;

        // Get counts first
        return Promise.all([
            A.countDocuments({ species: 'Fancy Mouse' }),
            P.countDocuments({ species: 'Fancy Mouse' })
        ]);
    })
    .then(([totalAnimal, totalPublic]) => {
        console.log('=== Fancy Mouse Count Summary ===');
        console.log('Total in Animal collection:', totalAnimal);
        console.log('Total in PublicAnimal collection:', totalPublic);
        console.log();

        // Get all Animal Fancy Mouse with lifeStage
        return A.find({ species: 'Fancy Mouse' }, { id_public: 1, lifeStage: 1 }).lean()
            .then((animals) => {
                // Get all PublicAnimal Fancy Mouse with lifeStage
                return P.find({ species: 'Fancy Mouse' }, { id_public: 1, lifeStage: 1 }).lean()
                    .then((publics) => {
                        // Now we have both arrays, compare them
                        return compareRecords(animals, publics);
                    });
            });
    })
    .then(result => {
        console.log(result);
        
        if (result.missingInPublic === 0 && result.differentLifeStage === 0) {
            console.log('✅ ALL FANCY MOUSE RECORDS ARE UP TO DATE!');
        } else {
            console.log('⚠️  Some records need attention');
        }
        
        mongoose.disconnect();
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });

function compareRecords(animals, publics) {
    let matching = 0;
    let missingInPublic = 0;
    let differentLifeStage = 0;
    
    // Build a map of public animal lifeStages
    const publicStageMap = new Map();
    publics.forEach(p => {
        publicStageMap.set(p.id_public, p.lifeStage);
    });
    
    // Compare each animal
    animals.forEach(a => {
        const publicStage = publicStageMap.get(a.id_public);
        if (publicStage === undefined) {
            // Not in public collection
            missingInPublic++;
            console.log('[MISSING] ' + a.id_public + ': Animal lifeStage=' + a.lifeStage + ' - NOT in PublicAnimal');
        } else if (publicStage !== a.lifeStage) {
            // Different lifeStage
            differentLifeStage++;
            console.log('[DIFFERENT] ' + a.id_public + ': Animal=' + a.lifeStage + ' Public=' + publicStage);
        } else {
            // Matching
            matching++;
        }
    });
    
    console.log();
    console.log('=== Sync Summary ===');
    console.log('Total Animal records:', animals.length);
    console.log('Total PublicAnimal records:', publics.length);
    console.log('Matching lifeStage:', matching);
    console.log('Missing from PublicAnimal:', missingInPublic);
    console.log('Different lifeStage:', differentLifeStage);
    console.log();
    
    return {
        matching,
        missingInPublic,
        differentLifeStage,
        animalsCount: animals.length,
        publicsCount: publics.length
    };
}