'use strict';
const L = require('./lib');
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { User } = L.models;
  const raw = await User.collection.find({}, { projection: { email: 1, emailVerified: 1 } }).toArray();
  console.log('emails with uppercase:', raw.filter(u => u.email && u.email !== u.email.toLowerCase()).length, 'of', raw.length);
  const u = await User.findOne({ emailVerified: true });
  u.resetPasswordToken = 'x'; u.resetPasswordExpires = new Date();
  const err = u.validateSync();
  console.log('validateSync on a restored user (no save, nothing written):', err ? Object.keys(err.errors).join(', ') : 'OK');
  await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });

