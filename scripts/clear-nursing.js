const mongoose = require('mongoose');
require('dotenv').config();
const { Animal } = require('../database/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const result = await Animal.updateOne({ id_public: 'CTC107' }, { $set: { isNursing: false } });
    console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
    await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
