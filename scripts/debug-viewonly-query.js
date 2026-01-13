/**
 * Debug the view-only query
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function debugViewOnlyQuery() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri);

        const ctu2 = await User.findOne({ id_public: 'CTU2' });
        console.log(`CTU2 Backend ID: ${ctu2._id}`);
        console.log(`Type: ${typeof ctu2._id}`);
        console.log(`Is ObjectId: ${ctu2._id instanceof mongoose.Types.ObjectId}\n`);

        // Try different query variations
        console.log('Testing different query variations:\n');

        // Query 1: Using ObjectId directly
        const query1 = await Animal.find({
            viewOnlyForUsers: ctu2._id
        }).lean();
        console.log(`Query 1 - viewOnlyForUsers: ctu2._id`);
        console.log(`  Found: ${query1.length} animals\n`);

        // Query 2: Using ObjectId with hiddenForUsers check
        const query2 = await Animal.find({
            viewOnlyForUsers: ctu2._id,
            hiddenForUsers: { $ne: ctu2._id }
        }).lean();
        console.log(`Query 2 - With hiddenForUsers check`);
        console.log(`  Found: ${query2.length} animals\n`);

        // Query 3: Check one specific animal
        const testAnimal = await Animal.findOne({ id_public: 'CTC520' }).lean();
        console.log(`Test animal CTC520:`);
        console.log(`  viewOnlyForUsers:`, testAnimal.viewOnlyForUsers);
        console.log(`  hiddenForUsers:`, testAnimal.hiddenForUsers);
        console.log(`  Type of viewOnlyForUsers[0]:`, typeof testAnimal.viewOnlyForUsers[0]);
        console.log(`  viewOnlyForUsers[0] === ctu2._id:`, testAnimal.viewOnlyForUsers[0].toString() === ctu2._id.toString());
        
        if (testAnimal.hiddenForUsers) {
            console.log(`  hiddenForUsers is:`, Array.isArray(testAnimal.hiddenForUsers) ? 'array' : typeof testAnimal.hiddenForUsers);
            console.log(`  hiddenForUsers length:`, testAnimal.hiddenForUsers.length);
        } else {
            console.log(`  hiddenForUsers:`, testAnimal.hiddenForUsers);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        console.error(error.stack);
        await mongoose.disconnect();
        process.exit(1);
    }
}

debugViewOnlyQuery();
