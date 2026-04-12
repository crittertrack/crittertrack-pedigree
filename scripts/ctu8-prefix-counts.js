const mongoose = require('mongoose');
require('dotenv').config();
const { Animal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await Animal.aggregate([
    { $match: { ownerId_public: 'CTU8' } },
    { $group: { _id: '$prefix', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  const total = result.reduce((s, r) => s + r.count, 0);
  console.log('Prefix | Count');
  console.log('-------|------');
  for (const r of result) {
    console.log((r._id || '(none)') + ' | ' + r.count);
  }
  console.log('-------|------');
  console.log('TOTAL: ' + result.length + ' prefixes, ' + total + ' animals');
  await mongoose.disconnect();
})();
