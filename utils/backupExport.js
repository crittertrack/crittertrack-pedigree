'use strict';
/**
 * Shared backup export logic (used by the daily scheduler AND the admin "trigger backup" route).
 *
 * Why this exists: backups used to hard-code 4 models, so every other collection (litters, transactions,
 * enclosures, waitlists, contacts, ...) was silently never backed up. This module discovers collections from
 * the live database instead, so NEW collections are included automatically.
 *
 * Format: Extended JSON (EJSON) keeps ObjectIds and Dates exact, so a restore is lossless.
 * Secrets: password hashes and one-time tokens are stripped from `users` (see SECRET_USER_FIELDS) so backups
 * never contain credentials. Set BACKUP_INCLUDE_SECRETS=true to keep them (restorable logins; higher risk).
 */
const { BSON } = require('mongoose').mongo;
const { EJSON } = BSON;

// Collections that are ephemeral, regenerated, or pure log noise: not worth backing up.
const DEFAULT_EXCLUDED = ['two_factor_codes', 'adminaccountsessions', 'login_audit_logs', 'useractivitylogs'];

// Fields removed from every `users` document before it is written to a backup.
const SECRET_USER_FIELDS = [
    'password', 'adminPassword', 'resetPasswordToken', 'resetPasswordExpires',
    'verificationCode', 'verificationCodeExpires',
    'pendingRecoveryEmail', 'recoveryEmailVerificationCode', 'recoveryEmailVerificationExpires', 'recoveryEmailVerificationAttempts',
];

// Collection name in MongoDB -> file name used in backups (kept for compatibility with old backups / admin UI).
const LEGACY_FILE_NAMES = { publicprofiles: 'publicProfiles', publicanimals: 'publicAnimals' };
const fileNameFor = (collection) => LEGACY_FILE_NAMES[collection] || collection;
const collectionFor = (fileName) => Object.keys(LEGACY_FILE_NAMES).find(k => LEGACY_FILE_NAMES[k] === fileName) || fileName;

const includeSecrets = () => String(process.env.BACKUP_INCLUDE_SECRETS || '').toLowerCase() === 'true';
const extraExcluded = () => String(process.env.BACKUP_EXCLUDE_COLLECTIONS || '').split(',').map(s => s.trim()).filter(Boolean);

// All collections that should be in a backup, discovered from the live database.
async function listBackupCollections(db) {
    const excluded = new Set([...DEFAULT_EXCLUDED, ...extraExcluded()]);
    const cols = await db.listCollections({}, { nameOnly: true }).toArray();
    return cols
        .filter(c => c.type !== 'view' && !c.name.startsWith('system.') && !excluded.has(c.name))
        .map(c => c.name)
        .sort();
}

// NEW: Get collections that have changed since last backup snapshot
async function getChangedCollections(db, lastBackupStats) {
    const allCollections = await listBackupCollections(db);
    const changed = [];
    
    for (const name of allCollections) {
        const nowCount = await db.collection(name).estimatedDocumentCount();
        const prevCount = Number(lastBackupStats[name] || 0);
        
        // If count changed OR this is the first backup (no previous stats), include it
        if (prevCount === 0 || nowCount !== prevCount) {
            changed.push(name);
        }
    }
    return changed;
}

// NEW: Export only changed collections, using previous stats for reference
async function exportChangedCollections(db, lastBackupStats, s3Client, bucket, prefix) {
    const changed = await getChangedCollections(db, lastBackupStats);
    const exports = [];
    
    for (const name of changed) {
        const result = await exportCollection(db, name);
        // Upload to primary storage
        const key = `${prefix}${name}/${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`;
        await uploadVerified(s3Client, bucket, key, result.body);
        exports.push({ collection: name, fileName: result.fileName, count: result.count, key });
    }
    return exports;
}

const stripSecrets = (collection, docs) => {
    if (collection !== 'users' || includeSecrets()) return docs;
    return docs.map(d => { const copy = { ...d }; for (const f of SECRET_USER_FIELDS) delete copy[f]; return copy; });
};

// Read one collection and serialise it. Returns { collection, fileName, count, body }.
async function exportCollection(db, collection) {
    const docs = stripSecrets(collection, await db.collection(collection).find({}).toArray());
    return { collection, fileName: fileNameFor(collection), count: docs.length, body: EJSON.stringify(docs, { relaxed: false }) };
}

// Current document counts keyed by backup file name (what the admin UI compares against).
async function getAllCounts(db) {
    const counts = {};
    for (const name of await listBackupCollections(db)) counts[fileNameFor(name)] = await db.collection(name).estimatedDocumentCount();
    return counts;
}

// Upload and verify: a backup that silently failed to upload is worse than no backup.
async function uploadVerified(s3Client, bucket, key, body) {
    const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' }));
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const expected = Buffer.byteLength(body, 'utf8');
    if (head.ContentLength !== expected) throw new Error(`Upload verification failed for ${key}: stored ${head.ContentLength} bytes, expected ${expected}`);
    return expected;
}

/**
 * Guards against backing up an empty/wrong database and then rotating out the good backups
 * (e.g. the app pointed at a fresh "test" database). Compares against the previous backup.
 */
function looksLikeDataLoss(newStats, prevStats, { keys = ['users', 'animals'], minRatio = 0.5, minPrev = 20 } = {}) {
    if (!prevStats) return null;
    for (const k of keys) {
        const prev = Number(prevStats[k] || 0), now = Number(newStats[k] || 0);
        if (prev >= minPrev && now < prev * minRatio) return `${k} dropped from ${prev} to ${now}`;
    }
    return null;
}

module.exports = {
    DEFAULT_EXCLUDED, SECRET_USER_FIELDS, LEGACY_FILE_NAMES,
    fileNameFor, collectionFor, includeSecrets, listBackupCollections, stripSecrets,
    exportCollection, getAllCounts, uploadVerified, looksLikeDataLoss, EJSON,
    getChangedCollections, exportChangedCollections
};
