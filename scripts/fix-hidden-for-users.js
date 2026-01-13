/**
 * Fix: Remove CTU2 from hiddenForUsers for animals CTU2 should have view-only access to
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function fixHiddenForUsers() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri);

        const ctu2 = await User.findOne({ id_public: 'CTU2' });
        console.log(`CTU2 Backend ID: ${ctu2._id}\n`);

        // Find all animals where CTU2 is in viewOnlyForUsers AND hiddenForUsers
        const animals = await Animal.find({
            viewOnlyForUsers: ctu2._id,
            hiddenForUsers: ctu2._id
        }).lean();

        console.log(`Found ${animals.length} animals with CTU2 in both viewOnlyForUsers and hiddenForUsers\n`);

        if (animals.length > 0) {
            console.log('Animals to fix:');
            animals.forEach(a => {
                console.log(`  ${a.id_public} (${a.name}) - Owner: ${a.ownerId_public}`);
            });

            console.log(`\nRemoving CTU2 from hiddenForUsers for these animals...\n`);

            const result = await Animal.updateMany(
                {
                    viewOnlyForUsers: ctu2._id,
                    hiddenForUsers: ctu2._id
                },
                {
                    $pull: { hiddenForUsers: ctu2._id }
                }
            );

            console.log(`✓ Updated ${result.modifiedCount} animals`);

            // Verify
            const verifyQuery = await Animal.find({
                viewOnlyForUsers: ctu2._id,
                hiddenForUsers: { $ne: ctu2._id }
            }).lean();

            console.log(`\n✓ Verification: ${verifyQuery.length} animals now have view-only access for CTU2 (not hidden)`);
        } else {
            console.log('No animals need fixing');
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

fixHiddenForUsers();
