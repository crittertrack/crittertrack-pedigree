// Verify database state: users and all counters
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, Counter } = require('../database/models');

async function verifyDatabaseState() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    // Check users
    const users = await User.find({}).select('id_public email personalName breederName');
    console.log('═══════════════════════════════════════');
    console.log('USERS (' + users.length + ' total)');
    console.log('═══════════════════════════════════════');
    users.forEach(user => {
      console.log(`  ${user.id_public} - ${user.personalName} (${user.email})`);
    });

    // Check animals
    const animals = await Animal.find({}).select('id_public name ownerId');
    console.log('\n═══════════════════════════════════════');
    console.log('ANIMALS (' + animals.length + ' total)');
    console.log('═══════════════════════════════════════');
    for (const animal of animals) {
      const owner = await User.findById(animal.ownerId).select('id_public');
      console.log(`  ${animal.id_public} - ${animal.name} (Owner: ${owner?.id_public || 'Unknown'})`);
    }

    // Check all counters
    const counters = await Counter.find({});
    console.log('\n═══════════════════════════════════════');
    console.log('COUNTERS (' + counters.length + ' total)');
    console.log('═══════════════════════════════════════');
    counters.forEach(counter => {
      console.log(`  ${counter._id}: ${counter.seq} (next will be ${counter.seq + 1})`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✓ ${users.length} user(s) in database`);
    console.log(`✓ ${animals.length} animal(s) in database`);
    console.log(`✓ Next user will be: CTU${counters.find(c => c._id === 'userId')?.seq + 1 || '?'}`);
    console.log(`✓ Next animal will be: CTC${counters.find(c => c._id === 'animalId')?.seq + 1 || '?'}`);
    console.log('═══════════════════════════════════════\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

verifyDatabaseState();
