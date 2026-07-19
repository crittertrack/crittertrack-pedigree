/**
 * one-time script to check all current database fieldnames.
 *
 * This script audits the 'animals' collection in a MongoDB database to ensure
 * backward compatibility with a new UI schema by identifying every unique
 * field name currently in use across all documents.
 *
 * How to use:
 * 1. Make sure you have `mongodb` driver installed (`npm install mongodb`).
 * 2. Update the `MONGO_URI` and `DATABASE_NAME` constants below to match your environment.
 * 3. Run the script from your terminal: `node ./scripts/check_field_compatibility.js`
 * 4. The script will output a sorted list of all unique field names found.
 */

const { MongoClient } = require('mongodb');

// --- CONFIGURATION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev';
const DATABASE_NAME = 'crittertrackdb';

/**
 * Main function to run the database field audit.
 */
async function auditAllDatabaseFields() {
  console.log('Starting database field audit...');

  const client = new MongoClient(MONGODB_URI);
  let animals = [];
  try {
    await client.connect();
    console.log('Successfully connected to the database.');
    const db = client.db(DATABASE_NAME);
    const animalsCollection = db.collection('animals');
    animals = await animalsCollection.find({}).toArray();
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }

  const allFields = new Set();
  let animalsScanned = 0;

  for (const animal of animals) {
    animalsScanned++;
    Object.keys(animal).forEach(field => {
      allFields.add(field);
    });
  }

  const sortedFields = Array.from(allFields).sort();

  console.log('\n--- Database Field Audit Report ---');
  console.log(`\nScanned ${animalsScanned} animals.`);
  console.log(`Found ${sortedFields.length} unique fields in the database:\n`);

  console.log(sortedFields.join('\n'));

  console.log('\n--- End of Report ---\n');
}

auditAllDatabaseFields().catch(console.error);