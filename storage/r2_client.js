// Minimal R2 client for the pedigree backend.
// This implementation POSTs the file buffer to an uploader endpoint (Cloudflare Worker)
// which is expected to accept multipart/form-data and return JSON { ok: true, url }.
//
// Environment variables:
// - UPLOADER_URL: full URL to the uploader endpoint (e.g. https://uploads.crittertrack.net/)
// - PUBLIC_HOST may be used as a fallback when UPLOADER_URL is not set.

const UPLOADER_URL = process.env.UPLOADER_URL || process.env.PUBLIC_HOST || null;

if (!UPLOADER_URL) {
  // Do not throw at module load time; exporting a function that will throw is clearer for runtime config.
}

async function uploadBuffer(key, buffer, contentType) {
  const target = (process.env.UPLOADER_URL || process.env.PUBLIC_HOST || '').replace(/\/$/, '');
  if (!target) throw new Error('UPLOADER_URL or PUBLIC_HOST must be set to upload to R2');

  // Use global FormData / Blob available in Node 18+ (engine set to 20.x).
  const form = new FormData();
  const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' });
  form.append('file', blob, key);

  const resp = await fetch(target, { method: 'POST', body: form });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '<no body>');
    throw new Error(`Uploader responded with ${resp.status}: ${text}`);
  }
  const json = await resp.json().catch(() => null);
  if (json && json.url) return json.url;
  // Fall back to constructing the expected uploads URL
  return `${target}/uploads/${encodeURIComponent(key)}`;
}

module.exports = { uploadBuffer };
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Minimal Cloudflare R2 client using AWS SDK v3 (S3-compatible)
// Expects environment variables:
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET
// Optional: STORAGE_BASE_URL to build public URLs (e.g., https://cdn.example.com)

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const accountId = process.env.R2_ACCOUNT_ID; // used for endpoint if needed
const bucket = process.env.R2_BUCKET;
const storageBase = process.env.STORAGE_BASE_URL || null;

if (!accessKeyId || !secretAccessKey || !bucket) {
    // Do not throw here to keep module import safe; runtime code will check.
    console.warn('R2 client: missing R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET environment variables. R2 disabled.');
}

// Build endpoint if accountId present; Cloudflare R2 endpoint form: https://<accountId>.r2.cloudflarestorage.com
const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined;

const s3Client = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: endpoint,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    forcePathStyle: false,
});

async function uploadBuffer(key, buffer, contentType) {
    if (!accessKeyId || !secretAccessKey || !bucket) {
        throw new Error('R2 not configured: missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET');
    }

    const params = {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        // Make public by default - if you want private, remove ACL and use signed URLs
        ACL: 'public-read'
    };

    const cmd = new PutObjectCommand(params);
    await s3Client.send(cmd);

    // Construct public URL: prefer STORAGE_BASE_URL if provided, otherwise attempt default R2 URL
    if (storageBase) {
        return `${storageBase.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
    }

    if (endpoint) {
        // Endpoint may be account-specific; standard public URL is endpoint/bucket/key
        return `${endpoint.replace(/\/$/, '')}/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
    }

    // Fallback: return bucket/key
    return `/${bucket}/${encodeURIComponent(key)}`;
}

module.exports = {
    uploadBuffer,
};
