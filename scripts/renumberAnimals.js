// Renumber all animals to CTC1-CTC9 and reset counter
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Counter, PublicProfile } = require('../database/models');

async function renumberAnimals() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    // Get all animals sorted by their current numeric ID
    const animals = await Animal.find({}).sort({ id_public: 1 });
    
    console.log('Current animals:');
    animals.forEach(a => console.log(`  ${a.id_public} - ${a.name}`));
    
    console.log('\nRenumbering animals...\n');

    // Create mapping of old to new IDs
    const idMapping = {};
    
    // Renumber each animal sequentially
    for (let i = 0; i < animals.length; i++) {
      const animal = animals[i];
      const oldId = animal.id_public;
      const newId = `CTC${i + 1}`;
      
      idMapping[oldId] = newId;
      
      // Update the animal's ID
      animal.id_public = newId;
      await animal.save();
      
      console.log(`✓ ${oldId} → ${newId} (${animal.name})`);
    }

    // Update parent references in all animals
    console.log('\nUpdating parent references...');
    for (const animal of animals) {
      let updated = false;
      
      if (animal.sireId_public && idMapping[animal.sireId_public]) {
        animal.sireId_public = idMapping[animal.sireId_public];
        updated = true;
      }
      
      if (animal.damId_public && idMapping[animal.damId_public]) {
        animal.damId_public = idMapping[animal.damId_public];
        updated = true;
      }
      
      if (updated) {
        await animal.save();
        console.log(`✓ Updated parents for ${animal.id_public}`);
      }
    }

    // Update offspring arrays
    console.log('\nUpdating offspring arrays...');
    for (const animal of animals) {
      if (animal.offspring && animal.offspring.length > 0) {
        let updated = false;
        animal.offspring = animal.offspring.map(offspringId => {
          if (idMapping[offspringId]) {
            updated = true;
            return idMapping[offspringId];
          }
          return offspringId;
        });
        
        if (updated) {
          await animal.save();
          console.log(`✓ Updated offspring for ${animal.id_public}`);
        }
      }
    }

    // Reset the animal counter to 9
    console.log('\nResetting animal counter...');
    await Counter.findOneAndUpdate(
      { _id: 'animalId' },
      { seq: 9 },
      { upsert: true }
    );
    console.log('✓ Animal counter reset to 9 (next animal will be CTC10)');

    console.log('\n═══════════════════════════════════════');
    console.log('✅ RENUMBERING COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Animals renumbered: CTC1 - CTC${animals.length}`);
    console.log(`Next animal will be: CTC${animals.length + 1}`);
    console.log('═══════════════════════════════════════\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

renumberAnimals();
