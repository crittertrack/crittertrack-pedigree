const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { User, Animal, PublicProfile, PublicAnimal } = require('../database/models');
const { createAuditLog } = require('./auditLogger');

// Backup metadata helpers
const backupMetadataPath = path.join(__dirname, '..', 'backups', 'metadata.json');

const getBackupMetadata = () => {
    try {
        if (fs.existsSync(backupMetadataPath)) {
            return JSON.parse(fs.readFileSync(backupMetadataPath, 'utf-8'));
        }
    } catch (err) {
        console.error('[BackupScheduler] Error reading backup metadata:', err);
    }
    return { backups: [], lastAutoBackup: null, scheduledTime: '0 3 * * *' };
};

const saveBackupMetadata = (metadata) => {
    try {
        const dir = path.dirname(backupMetadataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(backupMetadataPath, JSON.stringify(metadata, null, 2));
    } catch (err) {
        console.error('[BackupScheduler] Error saving backup metadata:', err);
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

// Create automated backup
const createAutomatedBackup = async () => {
    const timestamp = new Date();
    const backupId = `auto-backup-${timestamp.toISOString().replace(/:/g, '-').split('.')[0]}`;
    const backupDir = path.join(__dirname, '..', 'backups', backupId);

    console.log(`[BackupScheduler] Starting automated backup: ${backupId}`);

    try {
        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

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
        for (const [name, data] of Object.entries(collections)) {
            const filePath = path.join(backupDir, `${name}.json`);
            const jsonData = JSON.stringify(data, null, 2);
            fs.writeFileSync(filePath, jsonData);
            totalSize += Buffer.byteLength(jsonData, 'utf8');
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
            totalSizeBytes: totalSize
        };

        fs.writeFileSync(
            path.join(backupDir, 'backup-info.json'),
            JSON.stringify(backupInfo, null, 2)
        );

        // Update metadata
        const metadata = getBackupMetadata();
        metadata.backups.unshift({
            id: backupId,
            createdAt: timestamp,
            createdBy: 'system-scheduler',
            description: 'Automated daily backup',
            type: 'auto',
            stats,
            totalSizeBytes: totalSize,
            status: 'completed'
        });

        // Keep only last 30 backups (auto backups can accumulate)
        if (metadata.backups.length > 30) {
            // Remove old backups from disk too
            const oldBackups = metadata.backups.slice(30);
            for (const oldBackup of oldBackups) {
                const oldDir = path.join(__dirname, '..', 'backups', oldBackup.id);
                if (fs.existsSync(oldDir)) {
                    try {
                        fs.rmSync(oldDir, { recursive: true, force: true });
                        console.log(`[BackupScheduler] Removed old backup: ${oldBackup.id}`);
                    } catch (err) {
                        console.error(`[BackupScheduler] Failed to remove old backup ${oldBackup.id}:`, err);
                    }
                }
            }
            metadata.backups = metadata.backups.slice(0, 30);
        }

        metadata.lastAutoBackup = timestamp;
        saveBackupMetadata(metadata);

        // Log the action
        try {
            await createAuditLog({
                action: 'auto_backup_created',
                performedBy: null,
                details: { backupId, stats, totalSizeBytes: totalSize }
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

// Scheduled task reference
let scheduledTask = null;

// Initialize the backup scheduler
const initBackupScheduler = () => {
    const metadata = getBackupMetadata();
    const cronExpression = metadata.scheduledTime || '0 3 * * *'; // Default: 3:00 AM daily

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
        console.error(`[BackupScheduler] Invalid cron expression: ${cronExpression}, using default`);
        return startScheduler('0 3 * * *');
    }

    return startScheduler(cronExpression);
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
    console.log(`[BackupScheduler] Next backup will run at 3:00 AM UTC daily`);

    return scheduledTask;
};

// Update the backup schedule
const updateBackupSchedule = (newCronExpression) => {
    if (!cron.validate(newCronExpression)) {
        throw new Error(`Invalid cron expression: ${newCronExpression}`);
    }

    const metadata = getBackupMetadata();
    metadata.scheduledTime = newCronExpression;
    saveBackupMetadata(metadata);

    startScheduler(newCronExpression);
    console.log(`[BackupScheduler] Schedule updated to: ${newCronExpression}`);

    return { success: true, schedule: newCronExpression };
};

// Get current schedule info
const getScheduleInfo = () => {
    const metadata = getBackupMetadata();
    return {
        schedule: metadata.scheduledTime || '0 3 * * *',
        lastAutoBackup: metadata.lastAutoBackup,
        isRunning: scheduledTask !== null,
        timezone: 'UTC'
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
    createAutomatedBackup
};
