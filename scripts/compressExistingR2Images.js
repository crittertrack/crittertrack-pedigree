/**
 * Script to compress existing R2 images
 * Downloads all images from R2, compresses them, and re-uploads
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// R2 Configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.85;

// Backup directory
const backupDir = path.join(__dirname, '..', 'r2-compression-backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Compress image using node-canvas
 */
async function compressImage(inputPath, contentType) {
  const isCompressible = contentType === 'image/jpeg' || 
                         contentType === 'image/png' || 
                         contentType === 'image/webp' ||
                         contentType === 'image/jpg';
  
  if (!isCompressible) {
    console.log(`  ⏭️  Skipping non-compressible type: ${contentType}`);
    return { buffer: fs.readFileSync(inputPath), contentType, skipped: true };
  }

  try {
    const img = await loadImage(inputPath);
    let width = img.width;
    let height = img.height;

    // Calculate new dimensions
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }

    // Create canvas and draw resized image
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to JPEG buffer
    const outputType = contentType === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const buffer = canvas.toBuffer(
      outputType === 'image/webp' ? 'image/webp' : 'image/jpeg',
      { quality: JPEG_QUALITY }
    );

    return { buffer, contentType: outputType, skipped: false };
  } catch (error) {
    console.error(`  ❌ Compression failed: ${error.message}`);
    return { buffer: fs.readFileSync(inputPath), contentType, skipped: true };
  }
}

/**
 * Download file from R2
 */
async function downloadFromR2(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks = [];
  
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType || 'application/octet-stream',
  };
}

/**
 * Upload compressed file to R2
 */
async function uploadToR2(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

/**
 * Main compression process
 */
async function compressAllR2Images() {
  console.log('🗜️  Starting R2 Image Compression\n');
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  console.log(`💾 Backup: ${backupDir}\n`);

  // List all objects
  const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
  const listResponse = await s3Client.send(listCommand);
  const objects = listResponse.Contents || [];

  console.log(`📋 Found ${objects.length} files in R2\n`);

  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  let processedCount = 0;
  let skippedCount = 0;

  for (const obj of objects) {
    const key = obj.Key;
    console.log(`\n📄 Processing: ${key}`);
    console.log(`   Original size: ${(obj.Size / 1024).toFixed(1)} KB`);

    try {
      // Download from R2
      const { buffer: originalBuffer, contentType } = await downloadFromR2(key);
      totalOriginalSize += originalBuffer.length;

      // Save backup
      const backupPath = path.join(backupDir, key.replace(/\//g, '_'));
      fs.writeFileSync(backupPath, originalBuffer);
      console.log(`   ✅ Backed up to: ${path.basename(backupPath)}`);

      // Compress locally
      const tempPath = path.join(backupDir, `temp_${key.replace(/\//g, '_')}`);
      fs.writeFileSync(tempPath, originalBuffer);
      
      const { buffer: compressedBuffer, contentType: newContentType, skipped } = await compressImage(tempPath, contentType);
      fs.unlinkSync(tempPath); // Clean up temp file

      if (skipped) {
        skippedCount++;
        totalCompressedSize += compressedBuffer.length;
        console.log(`   ⏭️  Skipped (not compressible)`);
        continue;
      }

      totalCompressedSize += compressedBuffer.length;

      // Calculate savings
      const originalSizeKB = originalBuffer.length / 1024;
      const compressedSizeKB = compressedBuffer.length / 1024;
      const savingsPercent = ((1 - compressedBuffer.length / originalBuffer.length) * 100).toFixed(1);

      console.log(`   🗜️  Compressed: ${originalSizeKB.toFixed(1)} KB → ${compressedSizeKB.toFixed(1)} KB (${savingsPercent}% reduction)`);

      // Re-upload compressed version
      await uploadToR2(key, compressedBuffer, newContentType);
      console.log(`   ✅ Re-uploaded to R2`);

      processedCount++;

    } catch (error) {
      console.error(`   ❌ Error processing ${key}:`, error.message);
      skippedCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Compression Summary');
  console.log('='.repeat(60));
  console.log(`Total files: ${objects.length}`);
  console.log(`Compressed: ${processedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`\nOriginal total size: ${(totalOriginalSize / 1024).toFixed(1)} KB (${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Compressed total size: ${(totalCompressedSize / 1024).toFixed(1)} KB (${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB)`);
  
  const totalSavings = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1);
  const savedKB = ((totalOriginalSize - totalCompressedSize) / 1024).toFixed(1);
  console.log(`\n💰 Total savings: ${savedKB} KB (${totalSavings}% reduction)`);
  console.log(`\n✅ All originals backed up to: ${backupDir}`);
}

// Run the script
compressAllR2Images()
  .then(() => {
    console.log('\n✨ Compression complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
