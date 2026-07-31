const { MongoClient } = require('mongodb');
const path = require('path');

// Load environment variables from .env file at the project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// --- CONFIGURATION ---
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const DB_NAME = 'crittertrackdb'; // This should match the database name in your MongoDB instance

const LITTER_ID = 'CTL753';
const OFFSPRING_IDS = [
    'CTC7166', 'CTC7165', 'CTC7164', 'CTC7159', 'CTC7160', 
    'CTC7161', 'CTC7162', 'CTC7163', 'CTC7167'
];

async function runScript() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB.');

        const db = client.db(DB_NAME);
        const littersCollection = db.collection('litters');
        const animalsCollection = db.collection('animals');

        // 1. Find the litter and get its sire
        console.log(`\n🔍 Finding litter with ID: ${LITTER_ID}`);
        const litter = await littersCollection.findOne({ litter_id_public: LITTER_ID });

        if (!litter) {
            console.error(`❌ Error: Litter with ID ${LITTER_ID} not found.`);
            return;
        }

        console.log(`👍 Found litter: ${litter.breedingPairCodeName || litter._id}`);
        const sireId = litter.sireId_public;
        if (!sireId) {
            console.warn(`⚠️ Warning: Litter ${LITTER_ID} does not have a sire. Offspring will not be linked to a sire.`);
        } else {
            console.log(`ℹ️ Litter's sire is: ${sireId}`);
        }

        // 2. Update litter details: remove dam and set offspring counts
        console.log(`\n🔄 Updating litter ${LITTER_ID}...`);
        const updateLitterResult = await littersCollection.updateOne(
            { _id: litter._id },
            { $set: {
                damId_public: null,
                maleCount: 4,
                femaleCount: 5,
                unknownCount: 0,
                unknownLossesCount: 0
            } }
        );

        if (updateLitterResult.modifiedCount > 0) {
            console.log(`✅ Successfully updated litter ${LITTER_ID} with new counts and removed dam.`);
        } else {
            console.log(`- Litter ${LITTER_ID} did not need updating.`);
        }

        // 3. Link offspring
        console.log(`\n🔄 Linking ${OFFSPRING_IDS.length} offspring...`);
        
        // 3a. Update parent fields on offspring documents
        const updateOffspringResult = await animalsCollection.updateMany(
            { id_public: { $in: OFFSPRING_IDS } },
            { 
                $set: { 
                    fatherId_public: sireId, 
                    sireId_public: sireId,
                    motherId_public: null,
                    damId_public: null
                } 
            }
        );
        console.log(`✅ ${updateOffspringResult.modifiedCount} offspring documents updated with new parentage.`);
        if (updateOffspringResult.matchedCount !== OFFSPRING_IDS.length) {
            console.warn(`⚠️ Warning: Matched ${updateOffspringResult.matchedCount} offspring, but ${OFFSPRING_IDS.length} were provided. Some IDs may be incorrect or not found.`);
        }

        // 3b. Add offspring public IDs to the litter's offspring array
        const linkOffspringResult = await littersCollection.updateOne(
            { _id: litter._id },
            { $addToSet: { offspringIds_public: { $each: OFFSPRING_IDS } } }
        );
        console.log(`✅ Updated litter's offspring list. Modified count: ${linkOffspringResult.modifiedCount}`);

        console.log('\n🎉 Script finished successfully.');

    } catch (error) {
        console.error('❌ An error occurred:', error);
    } finally {
        await client.close();
        console.log('🔌 MongoDB connection closed.');
    }
}

runScript();