require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');

async function makeAnimalsPublic() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Find CTU5 user
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    if (!ctu5) {
      console.error('CTU5 user not found');
      mongoose.connection.close();
      return;
    }

    const animalIds = [
      'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564', 'CTC565',
      'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
    ];

    console.log(`Making ${animalIds.length} animals public for CTU5\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const animalId of animalIds) {
      try {
        // Get the animal
        const animal = await Animal.findOne({ 
          id_public: animalId,
          ownerId: ctu5._id
        });

        if (!animal) {
          console.log(`⚠ Animal not found or not owned by CTU5: ${animalId}`);
          continue;
        }

        // Check if PublicAnimal record exists
        let publicAnimal = await PublicAnimal.findOne({ 
          animalId_public: animalId
        });

        if (publicAnimal) {
          // Update existing record to ensure it's public
          publicAnimal = await PublicAnimal.findByIdAndUpdate(
            publicAnimal._id,
            {
              animalId_public: animalId,
              id_public: animalId,
              animalId_backend: animal._id,
              ownerId: ctu5._id,
              ownerId_public: ctu5.id_public,
              name: animal.name,
              species: animal.species,
              gender: animal.gender,
              birthDate: animal.birthDate,
              imageUrl: animal.imageUrl || animal.photoUrl,
              photoUrl: animal.photoUrl || animal.imageUrl,
              isPublic: true,
              soldStatus: 'purchased',
              transferStatus: 'accepted',
              sectionPrivacy: animal.sectionPrivacy || {}
            },
            { new: true }
          );
        } else {
          // Create new PublicAnimal record
          publicAnimal = await PublicAnimal.create({
            animalId_public: animalId,
            id_public: animalId,
            animalId_backend: animal._id,
            ownerId: ctu5._id,
            ownerId_public: ctu5.id_public,
            name: animal.name,
            species: animal.species,
            gender: animal.gender,
            birthDate: animal.birthDate,
            imageUrl: animal.imageUrl || animal.photoUrl,
            photoUrl: animal.photoUrl || animal.imageUrl,
            isPublic: true,
            soldStatus: 'purchased',
            transferStatus: 'accepted',
            sectionPrivacy: animal.sectionPrivacy || {}
          });
        }

        console.log(`✓ Made public: ${animalId} (${animal.name || 'Unnamed'})`);
        successCount++;
      } catch (error) {
        console.error(`✗ Error making ${animalId} public: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`- Successfully made public: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log('='.repeat(50));

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

makeAnimalsPublic();
