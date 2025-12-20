/**
 * Migration script to sync public animals from animals collection to publicanimals collection
 * Run with: node scripts/sync-public-animals.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'crittertrackdb';

async function syncPublicAnimals() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        console.log('Connected successfully!');
        
        const db = client.db(DB_NAME);
        const animalsCollection = db.collection('animals');
        const publicAnimalsCollection = db.collection('publicanimals');
        
        // Find all animals that should be public
        console.log('\nFinding animals marked as public...');
        const publicAnimals = await animalsCollection.find({ 
            showOnPublicProfile: true 
        }).toArray();
        
        console.log(`Found ${publicAnimals.length} animals marked as public in animals collection`);
        
        if (publicAnimals.length === 0) {
            console.log('No public animals to sync. Exiting.');
            return;
        }
        
        // Get existing public animal IDs
        const existingPublicAnimals = await publicAnimalsCollection.find({}, { 
            projection: { id_public: 1 } 
        }).toArray();
        const existingIds = new Set(existingPublicAnimals.map(a => a.id_public));
        
        console.log(`\nExisting public animals in publicanimals collection: ${existingIds.size}`);
        
        // Prepare animals to insert (those not already in publicanimals)
        const animalsToInsert = publicAnimals.filter(animal => !existingIds.has(animal.id_public));
        const animalsToUpdate = publicAnimals.filter(animal => existingIds.has(animal.id_public));
        
        console.log(`\nAnimals to insert: ${animalsToInsert.length}`);
        console.log(`Animals to update: ${animalsToUpdate.length}`);
        
        // Insert new public animals
        if (animalsToInsert.length > 0) {
            console.log('\nInserting new public animals...');
            const insertResult = await publicAnimalsCollection.insertMany(animalsToInsert);
            console.log(`Successfully inserted ${insertResult.insertedCount} animals`);
            
            // Log some of the inserted animals
            console.log('\nSample inserted animals:');
            animalsToInsert.slice(0, 5).forEach(animal => {
                console.log(`  - ${animal.id_public}: ${animal.name} (${animal.status})`);
            });
        }
        
        // Update existing public animals
        if (animalsToUpdate.length > 0) {
            console.log('\nUpdating existing public animals...');
            let updateCount = 0;
            
            for (const animal of animalsToUpdate) {
                // Remove _id from the update to avoid immutable field error
                const { _id, ...animalWithoutId } = animal;
                
                await publicAnimalsCollection.replaceOne(
                    { id_public: animal.id_public },
                    animalWithoutId
                );
                updateCount++;
            }
            
            console.log(`Successfully updated ${updateCount} animals`);
            
            // Log some of the updated animals
            console.log('\nSample updated animals:');
            animalsToUpdate.slice(0, 5).forEach(animal => {
                console.log(`  - ${animal.id_public}: ${animal.name} (${animal.status})`);
            });
        }
        
        // Check for animals in publicanimals that shouldn't be there (not public in animals)
        console.log('\nChecking for animals that should be removed from publicanimals...');
        const publicAnimalIds = new Set(publicAnimals.map(a => a.id_public));
        const toRemove = existingPublicAnimals.filter(pa => !publicAnimalIds.has(pa.id_public));
        
        if (toRemove.length > 0) {
            console.log(`Found ${toRemove.length} animals in publicanimals that are no longer public`);
            const removeResult = await publicAnimalsCollection.deleteMany({
                id_public: { $in: toRemove.map(a => a.id_public) }
            });
            console.log(`Removed ${removeResult.deletedCount} animals from publicanimals`);
        } else {
            console.log('No animals to remove from publicanimals');
        }
        
        // Final verification
        const finalCount = await publicAnimalsCollection.countDocuments();
        console.log(`\n✅ Sync complete! Total public animals: ${finalCount}`);
        
    } catch (error) {
        console.error('Error syncing public animals:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the sync
console.log('🔄 Starting public animals sync...\n');
syncPublicAnimals()
    .then(() => {
        console.log('\n✨ Migration completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
