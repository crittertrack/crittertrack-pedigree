// Private file storage for financial documents (receipts, later invoices).
//
// Unlike images (which go through the public uploader and get a link anyone can open), these
// files are written straight to a PRIVATE R2 bucket with the S3 API and are only ever read back
// through an authenticated backend route. Nothing here returns a public URL.
//
// Configure with R2_PRIVATE_BUCKET (a bucket with NO public access and NO custom domain). It uses
// the same R2 credentials as backups, so that API token must be allowed to access this bucket too.
// If the bucket isn't configured, uploads are refused - they never fall back to public storage.

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const notConfigured = () => {
    const err = new Error('Private file storage is not configured.');
    err.code = 'STORAGE_NOT_CONFIGURED';
    return err;
};

// `client` and `bucket` can be injected so the logic is unit-testable without real storage.
function createPrivateStorage({ client, bucket } = {}) {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const targetBucket = bucket !== undefined ? bucket : process.env.R2_PRIVATE_BUCKET;

    let s3 = client || null;
    const getClient = () => {
        if (!s3) {
            s3 = new S3Client({
                region: process.env.R2_REGION || 'auto',
                endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
                credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
            });
        }
        return s3;
    };

    const isConfigured = () => !!targetBucket && (!!client || !!(accessKeyId && secretAccessKey && accountId));

    return {
        isConfigured,

        async put(key, buffer, contentType) {
            if (!isConfigured()) throw notConfigured();
            await getClient().send(new PutObjectCommand({
                Bucket: targetBucket, Key: key, Body: buffer, ContentType: contentType,
            }));
        },

        // Returns { buffer, contentType } or null when the object doesn't exist.
        async get(key) {
            if (!isConfigured()) throw notConfigured();
            try {
                const out = await getClient().send(new GetObjectCommand({ Bucket: targetBucket, Key: key }));
                const bytes = await out.Body.transformToByteArray();
                return { buffer: Buffer.from(bytes), contentType: out.ContentType || null };
            } catch (err) {
                if (err && (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return null;
                throw err;
            }
        },

        // Best-effort: failing to delete must never block the user's own delete action.
        async remove(key) {
            if (!key || !isConfigured()) return false;
            try {
                await getClient().send(new DeleteObjectCommand({ Bucket: targetBucket, Key: key }));
                return true;
            } catch (err) {
                console.warn('[privateStorage] Could not delete', key, '-', err && err.message ? err.message : err);
                return false;
            }
        },
    };
}

module.exports = { createPrivateStorage, privateStorage: createPrivateStorage() };
