/**
 * Diagnostic: Check animal and its parents' visibility status
 */

require('dotenv').config();

const { Animal } = require('../database/models');

async function checkAnimalParents(animalId) {
    try {
        console.log(`\n[DIAGNOSTIC] Checking ${animalId} and parent visibility...\n`);
        
        const animal = await Animal.findOne({ id_public: animalId })
            .select('id_public name sireId_public damId_public showOnPublicProfile isOwned archived')
            .lean();
        
        if (!animal) {
            console.log(`❌ Animal ${animalId} not found`);
            return;
        }
        
        console.log(`[ANIMAL] ${animal.id_public} "${animal.name}"`);
        console.log(`  showOnPublicProfile: ${animal.showOnPublicProfile}`);
        console.log(`  isOwned: ${animal.isOwned}`);
        console.log(`  archived: ${animal.archived}\n`);
        
        if (animal.sireId_public) {
            const sire = await Animal.findOne({ id_public: animal.sireId_public })
                .select('id_public name showOnPublicProfile isOwned archived creatorId_public')
                .lean();
            
            console.log(`[SIRE] ${sire.id_public} "${sire.name}"`);
            console.log(`  showOnPublicProfile: ${sire.showOnPublicProfile}`);
            console.log(`  isOwned: ${sire.isOwned}`);
            console.log(`  archived: ${sire.archived}`);
            console.log(`  creatorId_public: ${sire.creatorId_public}`);
            console.log(`  Status: ${sire.showOnPublicProfile ? '✓ PUBLIC' : '❌ PRIVATE'}\n`);
        } else {
            console.log(`[SIRE] None linked\n`);
        }
        
        if (animal.damId_public) {
            const dam = await Animal.findOne({ id_public: animal.damId_public })
                .select('id_public name showOnPublicProfile isOwned archived creatorId_public')
                .lean();
            
            console.log(`[DAM] ${dam.id_public} "${dam.name}"`);
            console.log(`  showOnPublicProfile: ${dam.showOnPublicProfile}`);
            console.log(`  isOwned: ${dam.isOwned}`);
            console.log(`  archived: ${dam.archived}`);
            console.log(`  creatorId_public: ${dam.creatorId_public}`);
            console.log(`  Status: ${dam.showOnPublicProfile ? '✓ PUBLIC' : '❌ PRIVATE'}\n`);
        } else {
            console.log(`[DAM] None linked\n`);
        }
        
    } catch (error) {
        console.error('[ERROR]', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const animalId = args[0] || 'CTC6652';
    
    const { connectDB } = require('../database/db_service');
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
        console.error('ERROR: MONGODB_URI not set in environment variables');
        process.exit(1);
    }
    
    connectDB(MONGODB_URI).then(() => {
        checkAnimalParents(animalId).then(() => process.exit(0));
    }).catch(err => {
        console.error('Failed to connect to database:', err.message);
        process.exit(1);
    });
}

module.exports = { checkAnimalParents };
