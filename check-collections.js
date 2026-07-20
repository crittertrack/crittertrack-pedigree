require('dotenv').config();
const { Animal, PublicAnimal } = require('./database/models');
const { connectDB } = require('./database/db_service');

connectDB(process.env.MONGODB_URI).then(async () => {
  const ids = ['CTC6652', 'CTC6645', 'CTC6646'];
  
  console.log('\n[CHECK] Animals in collections:\n');
  for (const id of ids) {
    const inAnimal = await Animal.findOne({ id_public: id });
    const inPublic = await PublicAnimal.findOne({ id_public: id });
    console.log(`${id}: Animal=${inAnimal ? 'YES' : 'NO'}, PublicAnimal=${inPublic ? 'YES' : 'NO'}`);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
