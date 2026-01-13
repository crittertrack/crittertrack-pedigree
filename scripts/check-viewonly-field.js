/**
 * Check viewOnlyForUsers field for CTU5's animals
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function checkViewOnlyField() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('ERROR: MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);

        const ctu2 = await User.findOne({ id_public: 'CTU2' });
        const ctu5 = await User.findOne({ id_public: 'CTU5' });

        console.log(`CTU2 Backend ID: ${ctu2._id}`);
        console.log(`CTU5 Backend ID: ${ctu5._id}\n`);

        const animals = await Animal.find({ ownerId: ctu5._id }).sort({ id_public: 1 }).lean();

        console.log(`Checking ${animals.length} animals owned by CTU5:\n`);
        console.log('─'.repeat(100));

        animals.forEach(a => {
            const hasViewOnlyArray = Array.isArray(a.viewOnlyForUsers);
            const viewOnlyCount = hasViewOnlyArray ? a.viewOnlyForUsers.length : 0;
            const includesCTU2 = hasViewOnlyArray && a.viewOnlyForUsers.some(
                id => id.toString() === ctu2._id.toString()
            );
            
            const viewOnlyUsers = hasViewOnlyArray && a.viewOnlyForUsers.length > 0
                ? a.viewOnlyForUsers.map(id => id.toString()).join(', ')
                : 'none';

            console.log(`${a.id_public.padEnd(10)} | viewOnlyForUsers: [${viewOnlyUsers}]`);
            console.log(`              ${includesCTU2 ? '✓ Includes CTU2' : '✗ Does NOT include CTU2'}`);
        });

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

checkViewOnlyField();
