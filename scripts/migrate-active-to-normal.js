/**
 * Migration script to convert accountStatus from 'active' to 'normal'
 * Run with: node scripts/migrate-active-to-normal.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Define minimal User schema for migration
const UserSchema = new mongoose.Schema({
    accountStatus: { 
        type: String, 
        enum: ['active', 'normal', 'suspended', 'banned'], // Include both for migration
        default: 'normal'
    }
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function migrateActiveToNormal() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!');

        // Find users with 'active' accountStatus
        const activeCount = await User.countDocuments({ accountStatus: 'active' });
        console.log(`Found ${activeCount} users with accountStatus='active'`);

        if (activeCount === 0) {
            console.log('No migration needed - no users with active status');
            return;
        }

        // Update all users with 'active' to 'normal'
        const result = await User.updateMany(
            { accountStatus: 'active' },
            { $set: { accountStatus: 'normal' } }
        );

        console.log(`Migration complete!`);
        console.log(`  - Matched: ${result.matchedCount}`);
        console.log(`  - Modified: ${result.modifiedCount}`);

        // Verify the migration
        const verifyCount = await User.countDocuments({ accountStatus: 'active' });
        console.log(`\nVerification: ${verifyCount} users still have 'active' status (should be 0)`);

        // Show the count of each status
        const statusCounts = await User.aggregate([
            { $group: { _id: '$accountStatus', count: { $sum: 1 } } }
        ]);
        console.log('\nCurrent status distribution:');
        statusCounts.forEach(s => console.log(`  - ${s._id || 'null'}: ${s.count}`));

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

migrateActiveToNormal();
