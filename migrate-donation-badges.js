const mongoose = require('mongoose');
const { User, PublicProfile } = require('./database/models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';

async function migrateDonationBadges() {
    try {
        console.log('🚀 Starting donation badge migration...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Update User collection - add donation fields to users without them
        const userResult = await User.updateMany(
            {
                $or: [
                    { monthlyDonationActive: { $exists: false } },
                    { lastDonationDate: { $exists: false } }
                ]
            },
            {
                $set: {
                    monthlyDonationActive: false,
                    lastDonationDate: null
                }
            }
        );
        
        console.log(`✅ Updated ${userResult.modifiedCount} User documents with donation badge fields`);

        // Update PublicProfile collection - add donation fields to profiles without them
        const profileResult = await PublicProfile.updateMany(
            {
                $or: [
                    { monthlyDonationActive: { $exists: false } },
                    { lastDonationDate: { $exists: false } }
                ]
            },
            {
                $set: {
                    monthlyDonationActive: false,
                    lastDonationDate: null
                }
            }
        );
        
        console.log(`✅ Updated ${profileResult.modifiedCount} PublicProfile documents with donation badge fields`);

        // Verify the migration
        const totalUsers = await User.countDocuments({});
        const usersWithDonationFields = await User.countDocuments({
            monthlyDonationActive: { $exists: true },
            lastDonationDate: { $exists: true }
        });
        
        const totalProfiles = await PublicProfile.countDocuments({});
        const profilesWithDonationFields = await PublicProfile.countDocuments({
            monthlyDonationActive: { $exists: true },
            lastDonationDate: { $exists: true }
        });

        console.log('\n📊 Migration Summary:');
        console.log(`   Users: ${usersWithDonationFields}/${totalUsers} have donation fields`);
        console.log(`   Profiles: ${profilesWithDonationFields}/${totalProfiles} have donation fields`);

        if (usersWithDonationFields === totalUsers && profilesWithDonationFields === totalProfiles) {
            console.log('🎉 Migration completed successfully!');
        } else {
            console.log('⚠️  Some documents may need manual review');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the migration if this script is executed directly
if (require.main === module) {
    migrateDonationBadges()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateDonationBadges };