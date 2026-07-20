/**
 * Check CTU53's 97 public owned animals - verify they're in PublicAnimal by id_public
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { Animal, PublicAnimal, User } = require('../database/models');

async function checkCTU53PublicAnimals() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const user = await User.findOne({ id_public: 'CTU53' }).lean();
        if (!user) {
            console.log('❌ User CTU53 not found');
            return;
        }

        // Get CTU53's 97 public owned animals
        const ownedPublic = await Animal.find({
            creatorId: user._id,
            isOwned: true,
            showOnPublicProfile: true,
            isStub: { $ne: true },
            archived: { $ne: true }
        })
            .select('id_public name')
            .lean();

        console.log(`📊 CTU53's public owned animals: ${ownedPublic.length}\n`);

        // Get their id_publics
        const idPublics = ownedPublic.map(a => a.id_public);

        // Check if they exist in PublicAnimal by id_public
        const inPublic = await PublicAnimal.find({ id_public: { $in: idPublics } })
            .select('id_public name')
            .lean();

        console.log(`🔗 Found in PublicAnimal collection by id_public: ${inPublic.length}/${ownedPublic.length}\n`);

        if (inPublic.length === ownedPublic.length) {
            console.log('✅ All 97 animals are properly synced to PublicAnimal!\n');
        } else {
            console.log(`⚠️  Missing: ${ownedPublic.length - inPublic.length} animals\n`);
            
            const publicSet = new Set(inPublic.map(p => p.id_public));
            const missing = ownedPublic.filter(a => !publicSet.has(a.id_public));
            
            console.log('Missing animals:');
            missing.slice(0, 10).forEach((a, i) => {
                console.log(`  ${i + 1}. ${a.id_public} (${a.name})`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkCTU53PublicAnimals();
