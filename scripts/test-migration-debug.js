/**
 * Debug script to test migration connectivity
 */
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';

console.log('🔗 Connecting to MongoDB...');
console.log('URI:', MONGO_URI.substring(0, 50) + '...');

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        
        // Load models
        const modelPath = path.join(__dirname, '../database/models.js');
        console.log('📦 Loading models from:', modelPath);
        const { Animal } = require(modelPath);
        console.log('✅ Models loaded');
        
        // Try a simple count
        console.log('🔍 Counting animals with parents...');
        const count = await Animal.countDocuments({
            $or: [
                { sireId_public: { $ne: null, $exists: true } },
                { damId_public: { $ne: null, $exists: true } }
            ]
        });
        console.log(`✅ Found ${count} animals with linked parents`);
        
        // Try finding one
        console.log('🔍 Finding first animal with parents...');
        const first = await Animal.findOne({
            $or: [
                { sireId_public: { $ne: null, $exists: true } },
                { damId_public: { $ne: null, $exists: true } }
            ]
        }).lean();
        
        if (first) {
            console.log(`✅ Found: ${first.id_public} ${first.name}`);
            console.log(`   Sire: ${first.sireId_public}`);
            console.log(`   Dam: ${first.damId_public}`);
        } else {
            console.log('⚠️  No animals with parents found');
        }
        
        await mongoose.disconnect();
        console.log('✅ Disconnected');
    })
    .catch(err => {
        console.error('❌ Error:', err.message);
        process.exit(1);
    });
