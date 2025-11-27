#!/usr/bin/env node
/**
 * Quick check script to count and sample documents that still reference '/uploads/'.
 * Usage (PowerShell):
 *   $env:MONGODB_URI = '<your uri>'
 *   node .\scripts\check_image_counts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is required. Set it via environment variable.');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {});
    console.log('Connected to MongoDB');

    const animalQuery = { $or: [ { imageUrl: { $regex: '/uploads/' } }, { photoUrl: { $regex: '/uploads/' } } ] };
    const animalsCount = await Animal.countDocuments(animalQuery);
    console.log(`Animals referencing /uploads/: ${animalsCount}`);
    if (animalsCount > 0) {
      const samples = await Animal.find(animalQuery, { id_public:1, name:1, imageUrl:1, photoUrl:1 }).limit(10).lean();
      console.log('Sample animals:');
      console.dir(samples, { depth: 2, colors: false });
    }

    const userQuery = { profileImage: { $regex: '/uploads/' } };
    const usersCount = await User.countDocuments(userQuery);
    console.log(`Users referencing /uploads/: ${usersCount}`);
    if (usersCount > 0) {
      const samples = await User.find(userQuery, { id_public:1, email:1, profileImage:1 }).limit(10).lean();
      console.log('Sample users:');
      console.dir(samples, { depth: 2, colors: false });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
};

run();
