/**
 * Advanced R2 Image Cleanup Script (with Cloudflare API support)
 * 
 * This script requires Cloudflare API credentials to list and delete R2 objects.
 * 
 * Setup:
 * 1. Add to .env file:
 *    CLOUDFLARE_ACCOUNT_ID=your_account_id
 *    CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
 *    CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
 *    R2_BUCKET_NAME=crittertrack-uploads
 * 
 * 2. Install AWS SDK: npm install @aws-sdk/client-s3
 * 
 * Usage: railway run node scripts/cleanupUnusedImages-advanced.js
 */

const { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Readable } = require('stream');
require('dotenv').config();

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'crittertrack-uploads';
const BACKUP_DIR = path.join(__dirname, '..', 'r2-backup-images');

// S3 Client for R2
let s3Client;
if (R2_ACCESS_KEY && R2_SECRET_KEY && CLOUDFLARE_ACCOUNT_ID) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY,
            secretAccessKey: R2_SECRET_KEY,
        },
    });
}

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
    
    const animals = await Animal.find({}, { imageUrl: 1, photoUrl: 1 });
    animals.forEach(animal => {
        if (animal.imageUrl) usedImages.add(animal.imageUrl);
        if (animal.photoUrl) usedImages.add(animal.photoUrl);
    });
    console.log(`   Found ${animals.length} animals`);
    
    const users = await User.find({}, { profileImage: 1 });
    users.forEach(user => {
        if (user.profileImage) usedImages.add(user.profileImage);
    });
    console.log(`   Found ${users.length} users`);
    
    const r2Images = Array.from(usedImages).filter(url => 
        url && (url.includes('uploads.crittertrack.net') || url.includes('/uploads/'))
    );
    
    // Extract just the filenames
    const usedFilenames = new Set(r2Images.map(url => {
        const parts = url.split('/');
        return parts[parts.length - 1];
    }));
    
    console.log(`✅ Total unique R2 images in database: ${usedFilenames.size}`);
    
    return { urls: r2Images, filenames: usedFilenames };
}

async function listAllR2Objects() {
    if (!s3Client) {
        console.log('⚠️  R2 API credentials not configured');
        return [];
    }
    
    console.log('\n📋 Listing all objects in R2 bucket...');
    
    const allObjects = [];
    let continuationToken;
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            ContinuationToken: continuationToken,
        });
        
        const response = await s3Client.send(command);
        
        if (response.Contents) {
            allObjects.push(...response.Contents);
        }
        
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`✅ Found ${allObjects.length} objects in R2 bucket`);
    
    return allObjects;
}

async function downloadR2Object(key, localPath) {
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
        });
        
        const response = await s3Client.send(command);
        const stream = Readable.from(response.Body);
        const writeStream = fs.createWriteStream(localPath);
        
        await new Promise((resolve, reject) => {
            stream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
        
        return true;
    } catch (error) {
        console.error(`   ❌ Failed to download ${key}: ${error.message}`);
        return false;
    }
}

async function deleteR2Object(key) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
        });
        
        await s3Client.send(command);
        return true;
    } catch (error) {
        console.error(`   ❌ Failed to delete ${key}: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🧹 Advanced R2 Image Cleanup Script\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (!s3Client) {
        console.log('❌ R2 API credentials not configured!');
        console.log('\nPlease add to your .env file:');
        console.log('  CLOUDFLARE_ACCOUNT_ID=your_account_id');
        console.log('  CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key');
        console.log('  CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key');
        console.log('\nRun the basic cleanup script instead: cleanupUnusedImages.js');
        process.exit(1);
    }
    
    await connectDB();
    await createBackupDirectory();
    
    // Get used images from database
    const { urls: usedUrls, filenames: usedFilenames } = await getAllImagesInDatabase();
    
    // List all R2 objects
    const allR2Objects = await listAllR2Objects();
    
    // Identify orphaned files
    const orphanedObjects = allR2Objects.filter(obj => {
        const filename = obj.Key.split('/').pop();
        return !usedFilenames.has(filename);
    });
    
    console.log('\n📊 Analysis:');
    console.log(`   Total files in R2: ${allR2Objects.length}`);
    console.log(`   Files in use: ${usedFilenames.size}`);
    console.log(`   Orphaned files: ${orphanedObjects.length}`);
    
    if (orphanedObjects.length === 0) {
        console.log('\n✅ No orphaned files found! Bucket is clean.');
        await mongoose.disconnect();
        return;
    }
    
    // Download ALL files as backup
    console.log('\n📥 Downloading ALL files as backup...');
    let downloadedCount = 0;
    for (const obj of allR2Objects) {
        const filename = obj.Key.split('/').pop();
        const localPath = path.join(BACKUP_DIR, filename);
        
        if (!fs.existsSync(localPath)) {
            const success = await downloadR2Object(obj.Key, localPath);
            if (success) downloadedCount++;
        } else {
            downloadedCount++;
        }
        process.stdout.write(`\r   Downloaded: ${downloadedCount}/${allR2Objects.length}`);
    }
    console.log('\n✅ Backup complete!');
    
    // Delete orphaned files
    console.log('\n🗑️  Deleting orphaned files from R2...');
    const deletedFiles = [];
    let deletedCount = 0;
    
    for (const obj of orphanedObjects) {
        const success = await deleteR2Object(obj.Key);
        if (success) {
            deletedCount++;
            deletedFiles.push(obj.Key);
        }
        process.stdout.write(`\r   Deleted: ${deletedCount}/${orphanedObjects.length}`);
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('\n✅ Cleanup Complete!\n');
    console.log(`📦 Backup location: ${BACKUP_DIR}`);
    console.log(`📊 Total files backed up: ${allR2Objects.length}`);
    console.log(`🗑️  Files deleted from R2: ${deletedCount}`);
    console.log(`💾 Files remaining in R2: ${allR2Objects.length - deletedCount}`);
    
    if (deletedFiles.length > 0) {
        console.log('\n📝 Deleted files:');
        deletedFiles.forEach(key => console.log(`   - ${key}`));
    }
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
    await mongoose.disconnect();
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
