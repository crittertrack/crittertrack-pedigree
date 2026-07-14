const { MongoClient } = require('mongodb');

// --- CONFIGURATION ---
// Please fill in these values before running the script.

// The connection string for your MongoDB database.
// Example: 'mongodb+srv://user:password@cluster.mongodb.net/yourdb?retryWrites=true&w=majority'
const MONGODB_URI = "mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev";
const DATABASE_NAME = 'crittertrackdb';

// The public IDs of the animals to fix.
const ANIMAL_IDS = ['CTC6991', 'CTC6996', 'CTC6995'];

// --- END CONFIGURATION ---

async function clearImages() {
  if (MONGODB_URI === 'YOUR_MONGODB_URI_HERE' || !MONGODB_URI) {
    console.error('❌ Error: Please configure MONGODB_URI in the script before running.');
    return;
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Successfully connected to the database.');

    const database = client.db(DATABASE_NAME);
    const animalsCollection = database.collection('animals');

    console.log(`\nStarting script to clear images for ${ANIMAL_IDS.length} animals...`);

    for (const animalId of ANIMAL_IDS) {
      const result = await animalsCollection.updateOne(
        { id_public: animalId },
        { $set: { imageUrl: null, photoUrl: null, extraImages: [] } }
      );

      if (result.matchedCount === 0) {
        console.warn(`⚠️  No animal found with id_public: ${animalId}. No update performed.`);
      } else if (result.modifiedCount === 0) {
        console.log(`✅ Images for ${animalId} were already cleared. No update needed.`);
      } else {
        console.log(`✅ Successfully cleared images for ${animalId}.`);
      }
    }
  } catch (error) {
    console.error('❌ Database operation failed:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed.');
  }

  console.log('\\nScript finished.');
}

clearImages();