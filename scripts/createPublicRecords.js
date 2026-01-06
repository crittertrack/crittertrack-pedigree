require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');

async function createPublicRecords() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

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

    console.log('Creating public records for CTU5 animals:\n');

    let createdCount = 0;
    let updatedCount = 0;

    for (const animalId of animalIds) {
      try {
        const animal = await Animal.findOne({ 
          id_public: animalId,
          ownerId: ctu5._id
        });

        if (!animal) {
          console.log(`⚠ Animal not found: ${animalId}`);
          continue;
        }

        // Check if public record exists
        const existingPublic = await PublicAnimal.findOne({
          animalId_public: animalId,
          ownerId: ctu5._id
        });

        if (existingPublic) {
          // Update it
          await PublicAnimal.findByIdAndUpdate(
            existingPublic._id,
            {
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
          console.log(`✓ Updated public record: ${animalId}`);
          updatedCount++;
        } else {
          // Create new
          await PublicAnimal.create({
            animalId_public: animalId,
            id_public: animalId,
            animalId_backend: animal._id,
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
          console.log(`✓ Created public record: ${animalId}`);
          createdCount++;
        }
      } catch (error) {
        console.error(`✗ Error processing ${animalId}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`- Created: ${createdCount}`);
    console.log(`- Updated: ${updatedCount}`);
    console.log('='.repeat(50));

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

createPublicRecords();
