const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, User } = require('../database/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    // Check for multiple users with CTU87 or that email
    const users = await User.find({
        $or: [{ id_public: 'CTU87' }, { email: 'alissonhuin@gmail.com' }]
    }).select('_id id_public email username createdAt').lean();
    console.log('All CTU87/email users:', JSON.stringify(users, null, 2));

    // Check what ownerId values the animals actually have
    const ownerIds = await Animal.distinct('ownerId', { ownerId_public: 'CTU87' });
    console.log('\nDistinct ownerIds on CTU87 animals:', ownerIds);

    // Cross-reference: do any of those ownerIds match a user?
    for (const oid of ownerIds) {
        const u = await User.findById(oid).select('_id id_public email').lean();
        console.log(`  ownerId ${oid} -> user:`, u ? `${u.id_public} (${u.email})` : 'NOT FOUND');
    }

    mongoose.disconnect();
});
