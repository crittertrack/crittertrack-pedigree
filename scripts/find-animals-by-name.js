require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const searches = [
        { term: 'Sundae' },
        { term: 'Mirabel' },
    ];
    for (const s of searches) {
        const results = await Animal.find(
            { name: { $regex: s.term, $options: 'i' } },
            { id_public: 1, name: 1, prefix: 1, ownerId_public: 1 }
        ).lean();
        console.log(`\nSearch "${s.term}": ${results.length} results`);
        results.forEach(a => console.log(`  ${a.id_public}  prefix="${a.prefix}"  name="${a.name}"  owner=${a.ownerId_public}`));
    }

    await mongoose.disconnect();
})();
