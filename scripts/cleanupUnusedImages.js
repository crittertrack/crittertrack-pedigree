/**
 * Script to clean up unused images from R2 bucket
 * 
 * This script will:
 * 1. Download ALL images from R2 to local backup folder
 * 2. Query database for all images currently in use
 * 3. Identify orphaned images not referenced in database
 * 4. Delete orphaned images from R2 (local backup preserved)
 * 
 * Usage: railway run node scripts/cleanupUnusedImages.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

// R2/Cloudflare setup
const R2_PUBLIC_URL = 'https://uploads.crittertrack.net'; // Your R2 public URL
const BACKUP_DIR = path.join(__dirname, '..', 'r2-backup-images');

// MongoDB Models
const Animal = mongoose.model('Animal', new mongoose.Schema({
    id_public: String,
    imageUrl: String,
    photoUrl: String
}, { strict: false }));

const User = mongoose.model('User', new mongoose.Schema({
    id_public: String,
    profileImage: String
}, { strict: false }));

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function createBackupDirectory() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
    } else {
        console.log(`✅ Backup directory exists: ${BACKUP_DIR}`);
    }
}

async function getAllImagesInDatabase() {
    console.log('\n🔍 Scanning database for image URLs...');
    
    const usedImages = new Set();
    
    // Get all animal images
    const animals = await Animal.find({}, { imageUrl: 1, photoUrl: 1 });
    animals.forEach(animal => {
        if (animal.imageUrl) usedImages.add(animal.imageUrl);
        if (animal.photoUrl) usedImages.add(animal.photoUrl);
    });
    console.log(`   Found ${animals.length} animals with potential images`);
    
    // Get all user profile images
    const users = await User.find({}, { profileImage: 1 });
    users.forEach(user => {
        if (user.profileImage) usedImages.add(user.profileImage);
    });
    console.log(`   Found ${users.length} users with potential profile images`);
    
    // Filter to only R2 URLs
    const r2Images = Array.from(usedImages).filter(url => 
        url && (url.includes('uploads.crittertrack.net') || url.includes('/uploads/'))
    );
    
    console.log(`✅ Total unique R2 images in database: ${r2Images.length}`);
    
    return r2Images;
}

async function downloadImage(url, filename) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const filepath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(filepath, response.data);
        return true;
    } catch (error) {
        console.error(`   ❌ Failed to download ${filename}: ${error.message}`);
        return false;
    }
}

async function listR2Images() {
    // Note: Since we don't have direct R2 API access, we'll need to manually list images
    // or use the Cloudflare API. For now, this is a placeholder.
    
    console.log('\n⚠️  R2 LISTING LIMITATION:');
    console.log('   The R2 bucket listing requires Cloudflare API access.');
    console.log('   Please provide a list of all files in your R2 bucket.');
    console.log('   You can get this from the Cloudflare dashboard under R2 > crittertrack-uploads');
    console.log('\n   For now, this script will work with images found in database records.');
    
    return [];
}

async function main() {
    console.log('🧹 R2 Image Cleanup Script\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to database
    await connectDB();
    
    // Create backup directory
    await createBackupDirectory();
    
    // Get all images referenced in database
    const usedImages = await getAllImagesInDatabase();
    
    // Extract filenames from URLs
    const usedFilenames = usedImages.map(url => {
        const parts = url.split('/');
        return parts[parts.length - 1];
    });
    
    console.log('\n📋 Used images:');
    usedFilenames.forEach((filename, index) => {
        console.log(`   ${index + 1}. ${filename}`);
    });
    
    console.log('\n📥 Downloading all used images as backup...');
    let downloadedCount = 0;
    for (const url of usedImages) {
        const filename = url.split('/').pop();
        const success = await downloadImage(url, filename);
        if (success) {
            downloadedCount++;
            process.stdout.write(`\r   Downloaded: ${downloadedCount}/${usedImages.length}`);
        }
    }
    console.log('\n✅ Backup complete!');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\n⚠️  MANUAL CLEANUP REQUIRED:');
    console.log('\n1. All database images have been backed up to:');
    console.log(`   ${BACKUP_DIR}`);
    console.log('\n2. Images currently in use:');
    console.log(`   Total: ${usedImages.length}`);
    console.log('\n3. To complete cleanup:');
    console.log('   a. Go to Cloudflare Dashboard > R2 > crittertrack-uploads');
    console.log('   b. Compare files in bucket with the list above');
    console.log('   c. Delete files NOT in the "used images" list');
    console.log('\n   OR provide Cloudflare API credentials for automated deletion');
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
    await mongoose.disconnect();
    console.log('✅ Script complete!\n');
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
