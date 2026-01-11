const cron = require('node-cron');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { User, Animal, PublicProfile, PublicAnimal } = require('../database/models');
const { createAuditLog } = require('./auditLogger');

// R2 Configuration
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined;

const s3Client = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: endpoint,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    forcePathStyle: false,
});

const isR2Configured = () => !!(accessKeyId && secretAccessKey && bucket);

// Backup metadata stored in R2
const METADATA_KEY = 'backups/metadata.json';

const getBackupMetadata = async () => {
    if (!isR2Configured()) {
        console.warn('[BackupScheduler] R2 not configured, using in-memory metadata');
        return { backups: [], lastAutoBackup: null, scheduledTime: '0 3 * * *' };
    }

    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: METADATA_KEY });
        const response = await s3Client.send(command);
        const bodyString = await response.Body.transformToString();
        return JSON.parse(bodyString);
    } catch (err) {
        if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
            console.log('[BackupScheduler] No metadata found, creating new');
            return { backups: [], lastAutoBackup: null, scheduledTime: '0 3 * * *' };
        }
        console.error('[BackupScheduler] Error reading backup metadata from R2:', err);
        return { backups: [], lastAutoBackup: null, scheduledTime: '0 3 * * *' };
    }
};

const saveBackupMetadata = async (metadata) => {
    if (!isR2Configured()) {
        console.warn('[BackupScheduler] R2 not configured, cannot save metadata');
        return;
    }

    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: METADATA_KEY,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        });
        await s3Client.send(command);
        console.log('[BackupScheduler] Metadata saved to R2');
    } catch (err) {
        console.error('[BackupScheduler] Error saving backup metadata to R2:', err);
    }
};

const getCollectionStats = async () => {
    const stats = {
        users: await User.countDocuments({}),
        animals: await Animal.countDocuments({}),
        publicProfiles: await PublicProfile.countDocuments({}),
        publicAnimals: await PublicAnimal.countDocuments({})
    };
    return stats;
};

// Create automated backup - saves to R2 cloud storage
const createAutomatedBackup = async () => {
    if (!isR2Configured()) {
        console.error('[BackupScheduler] ❌ R2 not configured - cannot create backup');
        return { success: false, error: 'R2 storage not configured' };
    }

    const timestamp = new Date();
    const backupId = `auto-backup-${timestamp.toISOString().replace(/:/g, '-').split('.')[0]}`;
    const backupPrefix = `backups/${backupId}`;

    console.log(`[BackupScheduler] Starting automated backup to R2: ${backupId}`);

    try {
        // Get collection stats before backup
        const stats = await getCollectionStats();

        // Export collections to JSON
        const collections = {
            users: await User.find({}).lean(),
            animals: await Animal.find({}).lean(),
            publicProfiles: await PublicProfile.find({}).lean(),
            publicAnimals: await PublicAnimal.find({}).lean()
        };

        let totalSize = 0;
        
        // Upload each collection to R2
        for (const [name, data] of Object.entries(collections)) {
            const jsonData = JSON.stringify(data, null, 2);
            const key = `${backupPrefix}/${name}.json`;
            
            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: jsonData,
                ContentType: 'application/json'
            });
            await s3Client.send(command);
            totalSize += Buffer.byteLength(jsonData, 'utf8');
            console.log(`[BackupScheduler] Uploaded ${name}.json (${data.length} records)`);
        }

        // Create backup info file
        const backupInfo = {
            id: backupId,
            createdAt: timestamp,
            createdBy: 'system-scheduler',
            description: 'Automated daily backup',
            type: 'auto',
            stats,
            collections: Object.keys(collections),
            totalSizeBytes: totalSize,
            storageLocation: 'r2'
        };

        // Upload backup info to R2
        const infoCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: `${backupPrefix}/backup-info.json`,
            Body: JSON.stringify(backupInfo, null, 2),
            ContentType: 'application/json'
        });
        await s3Client.send(infoCommand);

        // Update metadata
        const metadata = await getBackupMetadata();
        metadata.backups.unshift({
            id: backupId,
            createdAt: timestamp,
            createdBy: 'system-scheduler',
            description: 'Automated daily backup',
            type: 'auto',
            stats,
            totalSizeBytes: totalSize,
            status: 'completed',
            storageLocation: 'r2'
        });

        // Keep only last 30 backups
        if (metadata.backups.length > 30) {
            const oldBackups = metadata.backups.slice(30);
            for (const oldBackup of oldBackups) {
                try {
                    await deleteBackupFromR2(oldBackup.id);
                    console.log(`[BackupScheduler] Removed old backup: ${oldBackup.id}`);
                } catch (err) {
                    console.error(`[BackupScheduler] Failed to remove old backup ${oldBackup.id}:`, err);
                }
            }
            metadata.backups = metadata.backups.slice(0, 30);
        }

        metadata.lastAutoBackup = timestamp;
        await saveBackupMetadata(metadata);

        // Log the action
        try {
            await createAuditLog({
                action: 'auto_backup_created',
                performedBy: null,
                details: { backupId, stats, totalSizeBytes: totalSize, storage: 'r2' }
            });
        } catch (auditErr) {
            console.error('[BackupScheduler] Failed to create audit log:', auditErr);
        }

        console.log(`[BackupScheduler] ✅ Automated backup completed: ${backupId}`);
        console.log(`[BackupScheduler] Stats: ${JSON.stringify(stats)}, Size: ${(totalSize / 1024).toFixed(2)} KB`);

        return { success: true, backupId, stats, totalSizeBytes: totalSize };
    } catch (error) {
        console.error('[BackupScheduler] ❌ Automated backup failed:', error);
        
        // Log failure
        try {
            await createAuditLog({
                action: 'auto_backup_failed',
                performedBy: null,
                details: { error: error.message }
            });
        } catch (auditErr) {
            console.error('[BackupScheduler] Failed to log backup failure:', auditErr);
        }

        return { success: false, error: error.message };
    }
};

// Delete a backup from R2
const deleteBackupFromR2 = async (backupId) => {
    if (!isR2Configured()) return;

    const prefix = `backups/${backupId}/`;
    
    // List all objects with this prefix
    const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const obj of listResponse.Contents) {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: bucket,
                Key: obj.Key
            });
            await s3Client.send(deleteCommand);
        }
    }
};

// Scheduled task reference
let scheduledTask = null;
let cachedSchedule = '0 3 * * *'; // Cache schedule in memory

// Initialize the backup scheduler
const initBackupScheduler = async () => {
    if (!isR2Configured()) {
        console.warn('[BackupScheduler] ⚠️ R2 not configured - backups will NOT be saved');
        console.warn('[BackupScheduler] Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET env vars');
    }

    const metadata = await getBackupMetadata();
    cachedSchedule = metadata.scheduledTime || '0 3 * * *';

    // Validate cron expression
    if (!cron.validate(cachedSchedule)) {
        console.error(`[BackupScheduler] Invalid cron expression: ${cachedSchedule}, using default`);
        cachedSchedule = '0 3 * * *';
    }

    return startScheduler(cachedSchedule);
};

const startScheduler = (cronExpression) => {
    // Stop existing scheduler if running
    if (scheduledTask) {
        scheduledTask.stop();
        console.log('[BackupScheduler] Stopped existing scheduler');
    }

    // Schedule the backup task
    scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`[BackupScheduler] 🕐 Scheduled backup triggered at ${new Date().toISOString()}`);
        await createAutomatedBackup();
    }, {
        scheduled: true,
        timezone: 'UTC' // Use UTC for consistency - adjust if needed
    });

    console.log(`[BackupScheduler] ✅ Backup scheduler initialized with schedule: ${cronExpression} (UTC)`);
    console.log(`[BackupScheduler] R2 configured: ${isR2Configured() ? 'YES ✅' : 'NO ❌'}`);

    return scheduledTask;
};

// Update the backup schedule
const updateBackupSchedule = async (newCronExpression) => {
    if (!cron.validate(newCronExpression)) {
        throw new Error(`Invalid cron expression: ${newCronExpression}`);
    }

    const metadata = await getBackupMetadata();
    metadata.scheduledTime = newCronExpression;
    await saveBackupMetadata(metadata);
    cachedSchedule = newCronExpression;

    startScheduler(newCronExpression);
    console.log(`[BackupScheduler] Schedule updated to: ${newCronExpression}`);

    return { success: true, schedule: newCronExpression };
};

// Get current schedule info
const getScheduleInfo = async () => {
    const metadata = await getBackupMetadata();
    return {
        schedule: metadata.scheduledTime || '0 3 * * *',
        lastAutoBackup: metadata.lastAutoBackup,
        isRunning: scheduledTask !== null,
        timezone: 'UTC',
        r2Configured: isR2Configured(),
        backupCount: metadata.backups?.length || 0
    };
};

// Manual trigger for testing
const triggerManualBackup = async () => {
    return await createAutomatedBackup();
};

module.exports = {
    initBackupScheduler,
    updateBackupSchedule,
    getScheduleInfo,
    triggerManualBackup,
    createAutomatedBackup,
    isR2Configured
};
