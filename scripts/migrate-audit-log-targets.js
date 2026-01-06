/**
 * Migration script to backfill targetUserId/targetAnimalId fields in AuditLog
 * Run with: node scripts/migrate-audit-log-targets.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Define minimal schemas for migration
const AuditLogSchema = new mongoose.Schema({
    targetType: String,
    targetId: mongoose.Schema.Types.ObjectId,
    targetUserId: mongoose.Schema.Types.ObjectId,
    targetAnimalId: mongoose.Schema.Types.ObjectId
}, { strict: false });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

async function migrateAuditLogTargets() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!');

        // Find audit logs where targetType is 'user' but targetUserId is not set
        const userLogsCount = await AuditLog.countDocuments({ 
            targetType: { $regex: /user/i },
            targetId: { $exists: true, $ne: null },
            targetUserId: { $eq: null }
        });
        
        console.log(`Found ${userLogsCount} user audit logs without targetUserId`);

        if (userLogsCount > 0) {
            const userResult = await AuditLog.updateMany(
                { 
                    targetType: { $regex: /user/i },
                    targetId: { $exists: true, $ne: null },
                    targetUserId: { $eq: null }
                },
                [{ 
                    $set: { targetUserId: '$targetId' } 
                }]
            );
            console.log(`Updated ${userResult.modifiedCount} user audit logs with targetUserId`);
        }

        // Find audit logs where targetType is 'animal' but targetAnimalId is not set
        const animalLogsCount = await AuditLog.countDocuments({ 
            targetType: { $regex: /animal/i },
            targetId: { $exists: true, $ne: null },
            targetAnimalId: { $eq: null }
        });
        
        console.log(`Found ${animalLogsCount} animal audit logs without targetAnimalId`);

        if (animalLogsCount > 0) {
            const animalResult = await AuditLog.updateMany(
                { 
                    targetType: { $regex: /animal/i },
                    targetId: { $exists: true, $ne: null },
                    targetAnimalId: { $eq: null }
                },
                [{ 
                    $set: { targetAnimalId: '$targetId' } 
                }]
            );
            console.log(`Updated ${animalResult.modifiedCount} animal audit logs with targetAnimalId`);
        }

        console.log('\nMigration complete!');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrateAuditLogTargets();
