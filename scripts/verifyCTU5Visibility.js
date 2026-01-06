require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

const transferredAnimals = [
  'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564',
  'CTC565', 'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
];

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Get CTU5
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    if (!ctu5) {
      console.error('CTU5 not found');
      process.exit(1);
    }

    console.log('=== CTU5 ANIMAL VISIBILITY ===\n');

    console.log('CTU5 ID: ' + ctu5._id);
    console.log('CTU5 Public ID: ' + ctu5.id_public + '\n');

    // Check private animals (what shows in "my animals" list)
    console.log('--- PRIVATE ANIMALS (My Animals List) ---');
    const privateAnimals = await Animal.find({ ownerId: ctu5._id }).select('id_public name prefix').lean();
    console.log(`Found ${privateAnimals.length} private animals for CTU5:\n`);
    
    privateAnimals.forEach(animal => {
      const displayName = animal.prefix ? `${animal.prefix} ${animal.name}` : animal.name;
      console.log(`  ✓ ${animal.id_public}: ${displayName}`);
    });

    // Check public animals (what shows on public profile)
    console.log('\n--- PUBLIC ANIMALS (Public Profile) ---');
    const publicAnimals = await PublicAnimal.find({ ownerId_public: 'CTU5' }).select('id_public name prefix').lean();
    console.log(`Found ${publicAnimals.length} public animals for CTU5:\n`);
    
    publicAnimals.forEach(animal => {
      const displayName = animal.prefix ? `${animal.prefix} ${animal.name}` : animal.name;
      console.log(`  ✓ ${animal.id_public}: ${displayName}`);
    });

    // Cross-check
    console.log('\n--- VERIFICATION ---');
    
    // Private but not public
    const onlyPrivate = privateAnimals.filter(p => 
      !publicAnimals.some(pub => pub.id_public === p.id_public)
    );
    
    // Public but not private
    const onlyPublic = publicAnimals.filter(pub => 
      !privateAnimals.some(p => p.id_public === pub.id_public)
    );

    if (onlyPrivate.length > 0) {
      console.log(`\n⚠️  Private but NOT public (${onlyPrivate.length}):`);
      onlyPrivate.forEach(a => console.log(`  ${a.id_public}`));
    }

    if (onlyPublic.length > 0) {
      console.log(`\n⚠️  Public but NOT private (${onlyPublic.length}):`);
      onlyPublic.forEach(a => console.log(`  ${a.id_public}`));
    }

    if (onlyPrivate.length === 0 && onlyPublic.length === 0) {
      console.log('\n✅ PERFECT: All animals are both private AND public');
    }

    // Check the transferred animals specifically
    console.log('\n--- TRANSFERRED ANIMALS CHECK ---');
    let allPresent = true;
    for (const animalId of transferredAnimals) {
      const priv = privateAnimals.find(a => a.id_public === animalId);
      const pub = publicAnimals.find(a => a.id_public === animalId);
      
      if (!priv || !pub) {
        console.log(`✗ ${animalId}: Missing ${!priv ? 'private' : ''} ${!pub ? 'public' : ''}`);
        allPresent = false;
      } else {
        console.log(`✓ ${animalId}: Has both private and public`);
      }
    }

    if (allPresent) {
      console.log('\n✅ All 11 transferred animals are complete');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
