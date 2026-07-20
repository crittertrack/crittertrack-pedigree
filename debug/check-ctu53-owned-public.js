/**
 * Check how many animals CTU53 has that are both isOwned AND isDisplay (public)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { User, Animal, PublicAnimal } = require('../database/models');

async function checkOwnedAndPublic() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find user CTU53
        const user = await User.findOne({ id_public: 'CTU53' }).lean();
        if (!user) {
            console.log('❌ User CTU53 not found');
            return;
        }

        // Query: isOwned AND isDisplay (showOnPublicProfile)
        const ownedAndPublic = await Animal.find({
            creatorId: user._id,
            isOwned: true,
            showOnPublicProfile: true,
            isStub: { $ne: true },
            archived: { $ne: true }
        })
            .select('id_public name isOwned showOnPublicProfile')
            .lean();

        console.log(`📊 Animals with isOwned=true AND isDisplay=true (public): ${ownedAndPublic.length}\n`);

        if (ownedAndPublic.length > 0) {
            console.log('First 20:');
            ownedAndPublic.slice(0, 20).forEach((a, i) => {
                console.log(`  ${i + 1}. ${a.id_public} (${a.name}): isOwned=${a.isOwned}, isDisplay=${a.showOnPublicProfile}`);
            });
        }

        // Also check: isOwned AND isDisplay AND in PublicAnimal collection
        const inPublicCollection = await PublicAnimal.find({
            _id: { $in: ownedAndPublic.map(a => a._id) }
        })
            .select('id_public')
            .lean();

        console.log(`\n📊 Of those, synced to PublicAnimal collection: ${inPublicCollection.length}/${ownedAndPublic.length}`);

        // Breakdown
        const allOwned = await Animal.find({
            creatorId: user._id,
            isOwned: true,
            isStub: { $ne: true },
            archived: { $ne: true }
        }).countDocuments();

        const allPublic = await Animal.find({
            creatorId: user._id,
            showOnPublicProfile: true,
            isStub: { $ne: true },
            archived: { $ne: true }
        }).countDocuments();

        console.log(`\n📈 Breakdown:`);
        console.log(`  - Total active owned animals: ${allOwned}`);
        console.log(`  - Total animals marked public: ${allPublic}`);
        console.log(`  - Both owned AND public: ${ownedAndPublic.length}`);

        console.log('\n✅ Check complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkOwnedAndPublic();
