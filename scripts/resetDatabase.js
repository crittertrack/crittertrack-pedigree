/**
 * Database Reset Script
 * Drops all collections in the CritterTrack database for a fresh start
 */

require('dotenv').config();
const mongoose = require('mongoose');

const resetDatabase = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        console.log('✅ Connected successfully');

        const db = mongoose.connection.db;
        
        // Get all collection names
        const collections = await db.listCollections().toArray();
        console.log(`\n📋 Found ${collections.length} collections:\n`);
        
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });

        if (collections.length === 0) {
            console.log('\n⚠️  No collections to delete. Database is already empty.');
            await mongoose.connection.close();
            return;
        }

        console.log('\n🗑️  Dropping all collections...\n');

        // Drop each collection
        for (const collection of collections) {
            await db.dropCollection(collection.name);
            console.log(`   ✓ Dropped: ${collection.name}`);
        }

        console.log('\n✨ Database reset complete! All collections have been deleted.');
        console.log('💡 Collections will be recreated automatically when the app runs.');

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('\n❌ Error resetting database:', error.message);
        process.exit(1);
    }
};

// Run the reset
resetDatabase();
