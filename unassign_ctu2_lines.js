#!/usr/bin/env node
// Unassign all breeding lines from CTU2 animals
// This script clears the animalBreedingLines field for CTU2's public profile

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const usersColl = db.collection('users');
  const publicProfiles = db.collection('publicprofiles');

  // Find CTU2 user
  const ctu2User = await usersColl.findOne({ id_public: 'CTU2' });
  if (!ctu2User) {
    console.error('CTU2 user not found');
    await client.close();
    process.exit(1);
  }

  console.log('Found CTU2 user:', ctu2User._id);

  // Find CTU2's public profile
  const prof = await publicProfiles.findOne({ userId_backend: ctu2User._id });
  if (!prof) {
    console.error('PublicProfile not found for CTU2');
    await client.close();
    process.exit(1);
  }

  console.log('Found CTU2 profile:', prof._id);
  console.log('Current animalBreedingLines:', JSON.stringify(prof.animalBreedingLines));

  // Update: clear all animal breeding lines by setting to empty object
  await publicProfiles.updateOne(
    { _id: prof._id },
    { $set: { animalBreedingLines: {} } }
  );

  console.log('Successfully cleared animalBreedingLines for CTU2');

  // Verify the update
  const updatedProf = await publicProfiles.findOne({ _id: prof._id });
  console.log('Updated animalBreedingLines:', JSON.stringify(updatedProf.animalBreedingLines));

  await client.close();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });