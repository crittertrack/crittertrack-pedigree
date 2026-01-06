/**
 * Migration script to set accountStatus to 'normal' for users where it's null
 * Run with: node scripts/migrate-user-status.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Define minimal User schema for migration
const UserSchema = new mongoose.Schema({
    accountStatus: { 
        type: String, 
        enum: ['normal', 'suspended', 'banned'], 
        default: 'normal'
    }
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function migrateUserStatus() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!');

        // Find users with null accountStatus
        const nullStatusCount = await User.countDocuments({ 
            $or: [
                { accountStatus: null },
                { accountStatus: { $exists: false } }
            ]
        });
        
        console.log(`Found ${nullStatusCount} users with null/missing accountStatus`);

        if (nullStatusCount === 0) {
            console.log('No migration needed - all users have accountStatus set');
            return;
        }

        // Update all users with null/missing accountStatus to 'normal'
        const result = await User.updateMany(
            { 
                $or: [
                    { accountStatus: null },
                    { accountStatus: { $exists: false } }
                ]
            },
            { 
                $set: { accountStatus: 'normal' } 
            }
        );

        console.log(`Migration complete!`);
        console.log(`  - Matched: ${result.matchedCount}`);
        console.log(`  - Modified: ${result.modifiedCount}`);

        // Verify the migration
        const verifyCount = await User.countDocuments({ 
            $or: [
                { accountStatus: null },
                { accountStatus: { $exists: false } }
            ]
        });
        console.log(`\nVerification: ${verifyCount} users still have null/missing accountStatus`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrateUserStatus();
