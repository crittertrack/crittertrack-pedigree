require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const animals = await Animal.find({ name: { $in: ['Biscuit','Maple','Toast','Clover'] }, ownerId_public: 'CTU1' })
        .select('name isQuarantine medicalConditions medications weight growthRecords healthStatus vaccinations').lean();
    for (const a of animals) {
        console.log(`${a.name} | quarantine:${a.isQuarantine} | weight:${a.weight} | growthRecords:${a.growthRecords && a.growthRecords.length} | health:${a.healthStatus} | medConds:${(a.medicalConditions||'').slice(0,60)} | meds:${(a.medications||'').slice(0,60)}`);
    }
    await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
