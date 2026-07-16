// one-time-update-mating-dates.js
const { MongoClient } = require('mongodb');

// --- Configuration ---
// IMPORTANT: Replace with your actual MongoDB connection string and database name.
const MONGODB_URI = "mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev";
const DATABASE_NAME = 'crittertrackdb';
const LITTER_COLLECTION = 'litters';

// --- Data for the update ---
const litterIdsToUpdate = [
  'CTL790',
  'CTL791',
  'CTL789',
  'CTL788',
  'CTL792'
];

// The date is July 14, 2026.
// JavaScript's Date constructor handles 'YYYY-MM-DD' reliably for UTC.
const newMatingDate = new Date('2026-07-14T00:00:00.000Z');

// --- Main script logic ---
async function runUpdateScript() {
  const client = new MongoClient(MONGODB_URI);

  try {
    // Connect to the MongoDB cluster
    await client.connect();
    console.log('Successfully connected to MongoDB.');

    // Get the database and collection
    const database = client.db(DATABASE_NAME);
    const littersCollection = database.collection(LITTER_COLLECTION);

    console.log(`Attempting to update matingDate for ${litterIdsToUpdate.length} litters...`);

    // Define the filter to find the documents by their public ID
    const filter = {
      litter_id_public: { $in: litterIdsToUpdate }
    };

    // Define the update operation
    const updateDoc = {
      $set: {
        matingDate: newMatingDate
      }
    };

    // Execute the update operation
    const result = await littersCollection.updateMany(filter, updateDoc);

    // Log the results
    console.log('--- Mating Date Update Complete ---');
    console.log(`Documents matched: ${result.matchedCount}`);
    console.log(`Documents modified: ${result.modifiedCount}`);

    if (result.matchedCount !== litterIdsToUpdate.length) {
        console.warn('Warning: The number of matched documents does not equal the number of IDs provided.');
        console.warn('This could mean some litter IDs were not found in the collection.');
    }

  } catch (err) {
    console.error('An error occurred during the update script:', err);
  } finally {
    // Ensure that the client will close when you finish/error
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

// Run the script
runUpdateScript();
