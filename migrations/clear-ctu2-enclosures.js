/**
 * clear-ctu2-enclosures.js
 *
 * This is a one-time script that connects directly to the MongoDB database to clear
 * the `enclosureId` for all animals belonging to a specific user (CTU2).
 */
const path = require('path');
// Load environment variables from .env file at the project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
// Assuming the models are exported from this path, relative to your project root.
// Adjust the path if your project structure is different.
const { Animal } = require('../database/models');

// --- CONFIGURATION ---
// It's highly recommended to use an environment variable for the connection string.
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const USER_PUBLIC_ID = 'CTU2';

/**
 * Main function to perform the database update.
 */
async function clearEnclosuresForUser() {
  let connection;
  try {
    // 1. Connect to the database
    connection = await mongoose.connect(MONGO_URI);
    console.log('Successfully connected to MongoDB.');

    // 2. Perform the update operation
    // This query finds all animals created by the specified user and sets their enclosureId to null.
    // NOTE: This assumes the `Animal` model has a `creatorId_public` field as indicated by frontend code.
    console.log(`Searching for animals from user "${USER_PUBLIC_ID}" to clear enclosure assignments...`);

    const result = await Animal.updateMany(
      { creatorId_public: USER_PUBLIC_ID },
      { $set: { enclosureId: null } }
    );

    // 3. Log the results
    console.log('----------------------------------------');
    console.log('Script execution finished.');
    console.log(`- Animals matched: ${result.matchedCount}`);
    console.log(`- Animals modified: ${result.modifiedCount}`);
    console.log(`All enclosure assignments have been cleared for user ${USER_PUBLIC_ID}.`);
    console.log('----------------------------------------');

  } catch (error) {
    console.error('An error occurred during the script execution:', error);
    process.exit(1); // Exit with an error code
  } finally {
    // 4. Disconnect from the database
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    }
  }
}

// Run the script
clearEnclosuresForUser();