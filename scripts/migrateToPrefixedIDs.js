/**
 * Migration script to update existing user and animal IDs from numeric to prefixed format
 * - Users: numeric ID → CTU{ID}
 * - Animals: numeric ID → CTC{ID}
 * 
 * This script updates:
 * 1. User.id_public
 * 2. PublicProfile.id_public
 * 3. Animal.id_public, breederId_public, fatherId_public, motherId_public
 * 4. Litter.sireId_public, damId_public
 * 
 * IMPORTANT: Make a database backup before running this script!
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile, Animal, Litter } = require('../database/models.js');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in environment variables');
    process.exit(1);
}

async function migrateUserIDs() {
    console.log('\n=== Migrating User IDs ===');
    
    // Find all users with numeric id_public (not starting with CTU)
    const users = await User.find({ 
        id_public: { 
            $exists: true, 
            $type: 'number' // MongoDB type check for numbers
        } 
    });
    
    console.log(`Found ${users.length} users with numeric IDs to migrate`);
    
    let updated = 0;
    for (const user of users) {
        const oldId = user.id_public;
        const newId = `CTU${oldId}`;
        
        await User.updateOne({ _id: user._id }, { id_public: newId });
        console.log(`  User ${user.email}: ${oldId} → ${newId}`);
        updated++;
    }
    
    console.log(`✓ Migrated ${updated} user IDs`);
    return updated;
}

async function migratePublicProfileIDs() {
    console.log('\n=== Migrating PublicProfile IDs ===');
    
    const profiles = await PublicProfile.find({ 
        id_public: { 
            $exists: true, 
            $type: 'number' 
        } 
    });
    
    console.log(`Found ${profiles.length} profiles with numeric IDs to migrate`);
    
    let updated = 0;
    for (const profile of profiles) {
        const oldId = profile.id_public;
        const newId = `CTU${oldId}`;
        
        await PublicProfile.updateOne({ _id: profile._id }, { id_public: newId });
        console.log(`  Profile for user ${profile.userId}: ${oldId} → ${newId}`);
        updated++;
    }
    
    console.log(`✓ Migrated ${updated} profile IDs`);
    return updated;
}

async function migrateAnimalIDs() {
    console.log('\n=== Migrating Animal IDs ===');
    
    const animals = await Animal.find({ 
        id_public: { 
            $exists: true, 
            $type: 'number' 
        } 
    });
    
    console.log(`Found ${animals.length} animals with numeric IDs to migrate`);
    
    let updated = 0;
    for (const animal of animals) {
        const oldId = animal.id_public;
        const newId = `CTC${oldId}`;
        
        const updateData = { id_public: newId };
        
        // Also update parent references if they exist and are numeric
        if (animal.fatherId_public && typeof animal.fatherId_public === 'number') {
            updateData.fatherId_public = `CTC${animal.fatherId_public}`;
        }
        if (animal.motherId_public && typeof animal.motherId_public === 'number') {
            updateData.motherId_public = `CTC${animal.motherId_public}`;
        }
        if (animal.breederId_public && typeof animal.breederId_public === 'number') {
            updateData.breederId_public = `CTU${animal.breederId_public}`;
        }
        
        await Animal.updateOne({ _id: animal._id }, updateData);
        console.log(`  Animal ${animal.name}: ${oldId} → ${newId}`);
        updated++;
    }
    
    console.log(`✓ Migrated ${updated} animal IDs`);
    return updated;
}

async function migrateLitterIDs() {
    console.log('\n=== Migrating Litter Parent IDs ===');
    
    const litters = await Litter.find({
        $or: [
            { sireId_public: { $type: 'number' } },
            { damId_public: { $type: 'number' } }
        ]
    });
    
    console.log(`Found ${litters.length} litters with numeric parent IDs to migrate`);
    
    let updated = 0;
    for (const litter of litters) {
        const updateData = {};
        
        if (litter.sireId_public && typeof litter.sireId_public === 'number') {
            updateData.sireId_public = `CTC${litter.sireId_public}`;
        }
        if (litter.damId_public && typeof litter.damId_public === 'number') {
            updateData.damId_public = `CTC${litter.damId_public}`;
        }
        
        if (Object.keys(updateData).length > 0) {
            await Litter.updateOne({ _id: litter._id }, updateData);
            console.log(`  Litter ${litter._id}: Updated parent IDs`);
            updated++;
        }
    }
    
    console.log(`✓ Migrated ${updated} litter parent IDs`);
    return updated;
}

async function runMigration() {
    console.log('==============================================');
    console.log('  ID Prefix Migration Script');
    console.log('  CTU for Users, CTC for Animals');
    console.log('==============================================');
    console.log(`\nConnecting to MongoDB...`);
    
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB');
        
        // Run migrations in order
        const userCount = await migrateUserIDs();
        const profileCount = await migratePublicProfileIDs();
        const animalCount = await migrateAnimalIDs();
        const litterCount = await migrateLitterIDs();
        
        console.log('\n==============================================');
        console.log('  Migration Complete!');
        console.log('==============================================');
        console.log(`  Users:         ${userCount} migrated`);
        console.log(`  Profiles:      ${profileCount} migrated`);
        console.log(`  Animals:       ${animalCount} migrated`);
        console.log(`  Litters:       ${litterCount} migrated`);
        console.log('==============================================\n');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('✓ Database connection closed');
    }
}

// Run the migration
runMigration();
