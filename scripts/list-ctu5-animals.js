/**
 * List all animals owned by CTU5
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function listCTU5Animals() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('ERROR: MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        // Find user CTU5
        const ctu5 = await User.findOne({ id_public: 'CTU5' });
        if (!ctu5) {
            console.log('User CTU5 not found');
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log(`User: ${ctu5.personalName || ctu5.breederName} (CTU5)`);
        console.log(`Backend ID: ${ctu5._id}\n`);

        // Get all animals owned by CTU5
        const animals = await Animal.find({ ownerId: ctu5._id })
            .sort({ id_public: 1 })
            .lean();

        console.log(`Total animals owned by CTU5: ${animals.length}\n`);

        if (animals.length > 0) {
            console.log('All animals:');
            console.log('─'.repeat(80));
            animals.forEach(a => {
                const viewOnly = a.viewOnlyForUsers && a.viewOnlyForUsers.length > 0 
                    ? `(${a.viewOnlyForUsers.length} view-only users)` 
                    : '';
                console.log(`${a.id_public.padEnd(10)} | ${(a.name || 'Unnamed').padEnd(25)} | isOwned: ${a.isOwned} ${viewOnly}`);
            });
            console.log('─'.repeat(80));

            // Group by isOwned status
            const owned = animals.filter(a => a.isOwned === true);
            const notOwned = animals.filter(a => a.isOwned !== true);

            console.log(`\nBreakdown:`);
            console.log(`  isOwned = true:  ${owned.length}`);
            console.log(`  isOwned = false: ${notOwned.length}`);

            if (notOwned.length > 0) {
                console.log('\nAnimals with isOwned = false:');
                notOwned.forEach(a => {
                    console.log(`  ${a.id_public} (${a.name})`);
                });
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

listCTU5Animals();
