require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Get CTU5 and CTU2
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    const ctu2 = await User.findOne({ id_public: 'CTU2' });

    console.log('=== Searching for V14-F1 ===\n');

    // Search by name
    const byName = await Animal.findOne({ name: 'V14-F1' }).lean();
    
    if (byName) {
      console.log('Found animal by name:\n');
      console.log(`  ID: ${byName.id_public}`);
      console.log(`  Name: ${byName.name}`);
      console.log(`  Prefix: ${byName.prefix || '(none)'}`);
      console.log(`  Owner ID: ${byName.ownerId}`);
      
      const ownerInfo = byName.ownerId.toString() === ctu5._id.toString() ? 'CTU5' : 
                       byName.ownerId.toString() === ctu2._id.toString() ? 'CTU2' : 'OTHER';
      console.log(`  Owner: ${ownerInfo}`);
      
      console.log(`  ViewOnlyForUsers: ${byName.viewOnlyForUsers.map(id => 
        id.toString() === ctu5._id.toString() ? 'CTU5' :
        id.toString() === ctu2._id.toString() ? 'CTU2' : 'OTHER'
      ).join(', ') || 'none'}`);
      
      // Check public
      const pubRecord = await PublicAnimal.findOne({ id_public: byName.id_public }).lean();
      console.log(`  Has public record: ${pubRecord ? 'Yes' : 'No'}`);
      
      if (pubRecord) {
        console.log(`    Public owner: ${pubRecord.ownerId_public}`);
      }
    } else {
      console.log('❌ Animal named "V14-F1" not found in database');
      
      // Try partial search
      const partial = await Animal.find({ name: { $regex: 'V14', $options: 'i' } }).lean();
      if (partial.length > 0) {
        console.log(`\nFound ${partial.length} animals with "V14" in name:`);
        partial.forEach(a => {
          console.log(`  - ${a.id_public}: ${a.name}`);
        });
      }
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
