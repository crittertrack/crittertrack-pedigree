/**
 * Script to check what field is used for public visibility
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'crittertrackdb';

async function checkPublicField() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        
        // List all collections
        console.log('Database collections:');
        const collections = await db.listCollections().toArray();
        collections.forEach(c => console.log(`  - ${c.name}`));
        
        const animalsCollection = db.collection('animals');
        
        // Count animals
        const count = await animalsCollection.countDocuments();
        console.log(`\nTotal animals in 'animals' collection: ${count}`);
        
        if (count === 0) {
            console.log('No animals found in collection');
            return;
        }
        
        // Get one of your specific animals to see its structure
        const testAnimal = await animalsCollection.findOne({ id_public: 'CTC432' });
        
        if (testAnimal) {
            console.log('\nFound animal CTC432:');
            console.log('Keys:', Object.keys(testAnimal));
            console.log('\nFull animal data:');
            console.log(JSON.stringify(testAnimal, null, 2));
        } else {
            console.log('\nAnimal CTC432 not found. Fetching first animal...');
            const firstAnimal = await animalsCollection.findOne({});
            if (firstAnimal) {
                console.log('First animal keys:', Object.keys(firstAnimal));
                console.log('\nFirst few fields:');
                console.log('  id_public:', firstAnimal.id_public);
                console.log('  name:', firstAnimal.name);
                console.log('  status:', firstAnimal.status);
                console.log('  isPublic:', firstAnimal.isPublic);
                console.log('  is_public:', firstAnimal.is_public);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkPublicField();
