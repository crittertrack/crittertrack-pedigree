require('dotenv').config();
const { PublicAnimal } = require('./database/models');
const { connectDB } = require('./database/db_service');

connectDB(process.env.MONGODB_URI).then(async () => {
  const ids = ['CTC6652', 'CTC6645', 'CTC6646'];
  console.log('\n[CHECK] PublicAnimal collection data:\n');
  for (const id of ids) {
    const doc = await PublicAnimal.findOne({ id_public: id }).lean();
    if (doc) {
      console.log(`${id}: showOnPublicProfile=${doc.showOnPublicProfile}, isOwned=${doc.isOwned}, archived=${doc.archived}`);
    } else {
      console.log(`${id}: NOT IN PublicAnimal`);
    }
  }
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
