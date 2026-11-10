'use strict';
// READ-ONLY: lists backup-related objects in the R2 bucket (no downloads, no writes, no deletes).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: true });
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const buckets = [...new Set([process.env.R2_BUCKET, process.env.R2_BUCKET_NAME, process.env.R2_PRIVATE_BUCKET].filter(Boolean))];
const client = new S3Client({ region: process.env.R2_REGION || 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });

(async () => {
    console.log('buckets from env:', buckets.join(', '));
    for (const Bucket of buckets) {
        console.log(`\n=== ${Bucket} ===`);
        let token, total = 0; const byTop = {}; const backups = [];
        try {
            do {
                const r = await client.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token, MaxKeys: 1000 }));
                for (const o of r.Contents || []) {
                    total++;
                    const top = o.Key.split('/')[0]; byTop[top] = (byTop[top] || 0) + 1;
                    if (/backup|dump|export|litter|\.bson|\.gz|\.zip/i.test(o.Key) && !/^uploads?\//i.test(o.Key)) backups.push([o.Key, o.Size, o.LastModified.toISOString()]);
                }
                token = r.IsTruncated ? r.NextContinuationToken : undefined;
            } while (token);
            console.log('objects:', total, '| by top-level folder:', JSON.stringify(byTop));
            console.log('backup-like objects:', backups.length);
            backups.sort((a, b) => a[2].localeCompare(b[2])).forEach(b => console.log('  ', b[2].slice(0, 16), String(b[1]).padStart(10), b[0]));
        } catch (e) { console.log('ERROR:', e.name, e.message); }
    }
})();
