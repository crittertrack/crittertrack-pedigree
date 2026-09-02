require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' }).select('deviceTokens').lean();
    console.log(JSON.stringify(user.deviceTokens, null, 2));
    await mongoose.disconnect();
})();
