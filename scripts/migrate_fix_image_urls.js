#!/usr/bin/env node
/*
 * Migration helper: rewrite stored upload URLs to use PUBLIC_HOST.
 * Usage (PowerShell):
 *   $env:PUBLIC_HOST = 'https://www.crittertrack.net'; $env:MONGODB_URI = '<uri>'; node .\scripts\migrate_fix_image_urls.js
 * Or pass PUBLIC_HOST and MONGODB_URI as env vars in your hosting provider.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const { User, PublicProfile, Animal, PublicAnimal } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI;
let PUBLIC_HOST = process.env.PUBLIC_HOST || process.env.PUBLIC_URL || process.env.DOMAIN || null;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is required. Set it via environment variable.');
  process.exit(1);
}
if (!PUBLIC_HOST) {
  console.error('PUBLIC_HOST (or PUBLIC_URL / DOMAIN) is required. Set it via environment variable.');
  process.exit(1);
}

// Normalize PUBLIC_HOST
if (!/^https?:\/\//i.test(PUBLIC_HOST)) PUBLIC_HOST = `https://${PUBLIC_HOST}`;
PUBLIC_HOST = PUBLIC_HOST.replace(/\/$/, '');

const containsUploads = (s) => typeof s === 'string' && s.indexOf('/uploads/') !== -1;

const buildNewUrl = (oldUrl) => {
  if (!oldUrl || typeof oldUrl !== 'string') return null;
  try {
    const u = new URL(oldUrl);
    // Use the pathname and search/hash if present
    return `${PUBLIC_HOST}${u.pathname}${u.search || ''}${u.hash || ''}`;
  } catch (e) {
    // If URL constructor fails, try to find the /uploads/ substring and use remainder
    const idx = oldUrl.indexOf('/uploads/');
    if (idx === -1) return null;
    const suffix = oldUrl.slice(idx);
    return `${PUBLIC_HOST}${suffix}`;
  }
};

const run = async () => {
  await mongoose.connect(MONGODB_URI, { });
  console.log('Connected to MongoDB');

  // Update Users (profileImage) and corresponding PublicProfile
  const users = await User.find({ profileImage: { $regex: '/uploads/' } }).lean();
  console.log('Users with profileImage to rewrite:', users.length);
  let usersUpdated = 0;
  for (const u of users) {
    if (!containsUploads(u.profileImage)) continue;
    const newUrl = buildNewUrl(u.profileImage);
    if (!newUrl) continue;
    await User.updateOne({ _id: u._id }, { $set: { profileImage: newUrl } });
    await PublicProfile.updateOne({ userId_backend: u._id }, { $set: { profileImage: newUrl } });
    usersUpdated++;
    console.log(`Updated User ${u._id} profileImage -> ${newUrl}`);
  }

  // Update Animals
  const animals = await Animal.find({ $or: [ { imageUrl: { $regex: '/uploads/' } }, { photoUrl: { $regex: '/uploads/' } } ] }).lean();
  console.log('Animals with imageUrl/photoUrl to rewrite:', animals.length);
  let animalsUpdated = 0;
  for (const a of animals) {
    const updates = {};
    if (containsUploads(a.imageUrl)) {
      const newUrl = buildNewUrl(a.imageUrl);
      if (newUrl) updates.imageUrl = newUrl;
    }
    if (containsUploads(a.photoUrl)) {
      const newUrl = buildNewUrl(a.photoUrl);
      if (newUrl) updates.photoUrl = newUrl;
    }
    if (Object.keys(updates).length > 0) {
      await Animal.updateOne({ _id: a._id }, { $set: updates });
      // Also update public animal if exists
      await PublicAnimal.updateOne({ id_public: a.id_public }, { $set: updates });
      animalsUpdated++;
      console.log(`Updated Animal CT${a.id_public} ->`, updates);
    }
  }

  console.log(`Done. Users updated: ${usersUpdated}. Animals updated: ${animalsUpdated}.`);
  await mongoose.disconnect();
  console.log('Disconnected. Migration complete.');
  process.exit(0);
};

run().catch(err => {
  console.error('Migration failed:', err && err.message ? err.message : err);
  process.exit(2);
});
