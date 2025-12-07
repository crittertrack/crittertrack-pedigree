/**
 * Script to fix Content-Type metadata for all images in R2 bucket
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

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

/**
 * Determine Content-Type from filename
 */
function getContentTypeFromFilename(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

async function fixContentTypes() {
  console.log('🔧 Fixing R2 Content-Type metadata\n');
  console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

  try {
    // List all objects
    const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];

    console.log(`📋 Found ${objects.length} files\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const obj of objects) {
      const key = obj.Key;
      
      try {
        // Get the object to read its content
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        const getResponse = await s3Client.send(getCommand);
        
        // Read the body
        const chunks = [];
        for await (const chunk of getResponse.Body) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Determine correct Content-Type
        const contentType = getContentTypeFromFilename(key);
        const currentContentType = getResponse.ContentType;

        if (currentContentType === contentType) {
          console.log(`⏭️  ${key} - already correct (${contentType})`);
          skippedCount++;
          continue;
        }

        // Re-upload with correct Content-Type
        const putCommand = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        });

        await s3Client.send(putCommand);
        console.log(`✅ ${key} - fixed: ${currentContentType || 'none'} → ${contentType}`);
        fixedCount++;

      } catch (error) {
        console.error(`❌ Error processing ${key}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`Total files: ${objects.length}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Already correct: ${skippedCount}`);
    console.log('\n✨ Done!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

fixContentTypes();
