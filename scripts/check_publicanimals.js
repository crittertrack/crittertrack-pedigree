#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function checkDB() {
    // Try connecting to publicanimals database
    try {
        await mongoose.connect(process.env.MONGODB_URI.replace('crittertrackdb', 'publicanimals'), { 
            serverSelectionTimeoutMS: 5000 
        });
        console.log('Connected to publicanimals database');
        
        const cols = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', cols.length > 0 ? cols.map(c => c.name) : '(empty)');
        
        // Check for any collections with animal-related names
        for (const col of cols) {
            const docCount = await mongoose.connection.db.collection(col.name).countDocuments({});
            console.log(`  ${col.name}: ${docCount} documents`);
        }
        
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err.message);
        await mongoose.disconnect();
    }
}

checkDB();