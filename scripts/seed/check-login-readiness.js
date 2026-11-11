'use strict';
// READ-ONLY. Counts how many restored users would be blocked from the password-reset flow.
// Prints aggregate numbers only (no emails, no hashes). Writes nothing.
const L = require('./lib');
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { User } = L.models;
  const c = User.collection;
  const total = await c.countDocuments({});
  const unverified = await c.countDocuments({ emailVerified: { $ne: true } });
  const noPassword = await c.countDocuments({ $or: [{ password: { $exists: false } }, { password: null }] });
  const mixedCaseOrSpaces = await c.countDocuments({ $expr: { $ne: ['$email', { $trim: { input: { $toLower: '$email' } } }] } });
  const noEmail = await c.countDocuments({ $or: [{ email: { $exists: false } }, { email: null }, { email: '' }] });
  console.log(JSON.stringify({ total, unverified, noPassword, mixedCaseOrSpaces, noEmail }, null, 2));
  await L.mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
