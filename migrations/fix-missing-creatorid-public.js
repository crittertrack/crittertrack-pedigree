const { MongoClient, ObjectId } = require('mongodb');

// --- CONFIGURATION ---
const MONGODB_URI = "mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev";
const DATABASE_NAME = 'crittertrackdb';
// --- END CONFIGURATION ---

async function fixMissingCreatorIds() {
  if (MONGODB_URI.includes('YOUR_MONGODB_URI_HERE')) {
    console.error('❌ Error: Please configure MONGODB_URI in the script before running.');
    return;
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Successfully connected to the database.');

    const database = client.db(DATABASE_NAME);
    const publicAnimalsCollection = database.collection('publicanimals');
    const animalsCollection = database.collection('animals');
    const usersCollection = database.collection('users');

    console.log('\n🔍 Finding public animals with missing creator or original creator IDs...');

    // Find documents where creatorId_public or originalCreatorId_public is null, undefined, or an empty string
    const problematicDocs = await publicAnimalsCollection.find({
      $or: [
        { creatorId_public: null },
        { creatorId_public: { $exists: false } },
        { creatorId_public: '' },
        { originalCreatorId_public: null },
        { originalCreatorId_public: { $exists: false } },
        { originalCreatorId_public: '' },
      ]
    }).toArray();

    if (problematicDocs.length === 0) {
      console.log('✅ No public animals with missing creator IDs found. Your data is clean!');
      return;
    }

    console.log(`Found ${problematicDocs.length} documents to fix.`);
    let fixedCount = 0;
    let notFoundCount = 0;
    const errors = [];

    for (const doc of problematicDocs) {
      const { id_public } = doc;
      console.log(`\nProcessing public animal ${id_public}...`);

      // Find the corresponding private animal to get the correct creatorId_public
      const privateAnimal = await animalsCollection.findOne({ id_public });

      if (privateAnimal) {
        const updateSet = {};

        // --- Fix creatorId_public ---
        if (privateAnimal.creatorId_public && !doc.creatorId_public) {
            updateSet.creatorId_public = privateAnimal.creatorId_public;
        }

        // --- Fix originalCreatorId_public ---
        if (privateAnimal.originalCreatorId && !doc.originalCreatorId_public) {
            try {
                const originalCreator = await usersCollection.findOne({ _id: new ObjectId(privateAnimal.originalCreatorId) });
                if (originalCreator && originalCreator.id_public) {
                    updateSet.originalCreatorId_public = originalCreator.id_public;
                } else {
                    console.warn(`  - ⚠️ Could not find user public ID for originalCreatorId: ${privateAnimal.originalCreatorId}`);
                }
            } catch (e) {
                console.error(`  - ❌ Error processing originalCreatorId ${privateAnimal.originalCreatorId}: ${e.message}`);
                errors.push(`Error on ${id_public}: ${e.message}`);
            }
        }

        if (Object.keys(updateSet).length > 0) {
          const result = await publicAnimalsCollection.updateOne(
            { _id: doc._id },
            { $set: updateSet }
          );

          if (result.modifiedCount > 0) {
            console.log(`✅ Successfully updated ${id_public} with:`, updateSet);
            fixedCount++;
          } else {
            console.warn(`⚠️  Animal ${id_public} was found but not modified. This might be unexpected.`);
          }
        } else {
            console.log(`  - No missing data to update for ${id_public}.`);
        }
      } else {
        console.warn(`❌ No corresponding private animal found for ${id_public}. Cannot fix.`);
        notFoundCount++;
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`- Total documents processed: ${problematicDocs.length}`);
    console.log(`- ✅ Documents fixed: ${fixedCount}`);
    console.log(`- ❌ Documents that could not be fixed: ${notFoundCount}`);
    if (errors.length > 0) {
        console.log(`- ❗️ Errors encountered: ${errors.length}`);
        errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    }
    console.log('-------------------------\n');

  } catch (error) {
    console.error('❌ Database operation failed:', error);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

fixMissingCreatorIds();