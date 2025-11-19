/**
 * HTTP Cloud Function that fetches the pedigree of an animal
 * from MongoDB, using the animalId passed in the request body.
 * * The function connects to MongoDB using the MONGO_URI and DB_NAME
 * environment variables configured in the Cloud Run service.
 * * @param {object} req Cloud Function request context.
 * @param {object} res Cloud Function response context.
 */

const { MongoClient } = require('mongodb');

// Get environment variables
const MONGODB_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

// Ensure connection URI is available
if (!MONGODB_URI) {
  throw new Error('MONGO_URI environment variable not set.');
}

// Global variable to store the database connection
let cachedDb = null;

/**
 * Connects to the MongoDB database, reusing a cached connection if available.
 * @returns {Promise<Db>} The MongoDB database object.
 */
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  // Connect to our MongoDB database instance
  const client = await MongoClient.connect(MONGODB_URI);

  // Specify the database name
  const db = client.db(DB_NAME);
  cachedDb = db;
  return db;
}

/**
 * Main function handler for the Cloud Function.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.getAnimalPedigree = async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle pre-flight CORS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Only allow POST requests for data retrieval
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed. Use POST.');
  }

  // Validate the request body
  const { animalId } = req.body;
  if (!animalId) {
    return res.status(400).json({ error: 'Missing required parameter: animalId' });
  }

  let db;
  try {
    // 1. Connect to the database
    db = await connectToDatabase();
    const collection = db.collection('animals');

    // 2. Find the animal and its pedigree information
    const animal = await collection.findOne(
      { animalId: animalId },
      { projection: { _id: 0, animalId: 1, name: 1, breed: 1, fatherId: 1, motherId: 1 } }
    );

    if (!animal) {
      return res.status(404).json({ error: 'Animal not found.' });
    }
    
    // 3. Construct the response object
    const response = {
      animalId: animal.animalId,
      name: animal.name,
      breed: animal.breed,
      pedigree: {}
    };

    // 4. Fetch parents if IDs exist
    const parentIds = [animal.fatherId, animal.motherId].filter(id => id);
    if (parentIds.length > 0) {
      const parents = await collection.find(
        { animalId: { $in: parentIds } },
        { projection: { _id: 0, animalId: 1, name: 1 } }
      ).toArray();

      // Map parents to the response structure
      if (animal.fatherId) {
        response.pedigree.father = parents.find(p => p.animalId === animal.fatherId) || { animalId: animal.fatherId, name: 'Unknown' };
      }
      if (animal.motherId) {
        response.pedigree.mother = parents.find(p => p.animalId === animal.motherId) || { animalId: animal.motherId, name: 'Unknown' };
      }
    }

    // 5. Send the successful response
    res.status(200).json(response);

  } catch (error) {
    console.error('Database query failed:', error);
    res.status(500).json({ error: 'Failed to retrieve animal pedigree due to a server error.' });
  }
};
