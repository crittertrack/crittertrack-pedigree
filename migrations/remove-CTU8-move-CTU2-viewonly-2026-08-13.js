// Admin data fix: CTC2723, CTC2671 had CTU8 lingering in viewOnlyForUsers alongside CTU2.
// originalCreatorId was already CTU2 (not CTU8) on both, so only viewOnlyForUsers needed fixing:
// remove CTU8, keep/ensure CTU2 is present.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

const ANIMAL_IDS = ['CTC2723', 'CTC2671'];
const REMOVE_OWNER_PUBLIC_ID = 'CTU8';
const KEEP_OWNER_PUBLIC_ID = 'CTU2';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const removeUser = await User.findOne({ id_public: REMOVE_OWNER_PUBLIC_ID }).select('_id');
    const keepUser = await User.findOne({ id_public: KEEP_OWNER_PUBLIC_ID }).select('_id');
    if (!removeUser || !keepUser) {
        console.error('Could not resolve CTU8/CTU2. Aborting.');
        await mongoose.disconnect();
        return;
    }

    for (const id_public of ANIMAL_IDS) {
        const animal = await Animal.findOne({ id_public });
        if (!animal) {
            console.log(`- ${id_public}: NOT FOUND, skipping.`);
            continue;
        }

        if (animal.originalCreatorId && animal.originalCreatorId.toString() === removeUser._id.toString()) {
            animal.originalCreatorId = keepUser._id;
            console.log(`- ${id_public}: originalCreatorId CTU8 -> CTU2`);
        }

        const hadRemove = animal.viewOnlyForUsers.some(uid => uid.toString() === removeUser._id.toString());
        animal.viewOnlyForUsers = animal.viewOnlyForUsers.filter(uid => uid.toString() !== removeUser._id.toString());
        if (!animal.viewOnlyForUsers.some(uid => uid.toString() === keepUser._id.toString())) {
            animal.viewOnlyForUsers.push(keepUser._id);
        }
        console.log(`- ${id_public}: viewOnlyForUsers CTU8 removed=${hadRemove}, CTU2 ensured present.`);

        await animal.save();
    }

    console.log('\nDone.');
    await mongoose.disconnect();
})();
