/**
 * Transfer specific animals from CTU2 to CTU5
 * CTU2 will retain view-only access
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User, PublicAnimal } = require('../database/models');

const ANIMALS_TO_TRANSFER = [
    'CTC520', 'CTC521', 'CTC559', 'CTC561', 'CTC560',
    'CTC565', 'CTC564', 'CTC525', 'CTC522', 'CTC562', 'CTC563'
];

async function transferAnimals() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('ERROR: MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        // Get users
        const ctu2 = await User.findOne({ id_public: 'CTU2' });
        const ctu5 = await User.findOne({ id_public: 'CTU5' });

        if (!ctu2 || !ctu5) {
            console.error('ERROR: Could not find CTU2 or CTU5');
            console.log('CTU2:', ctu2 ? 'Found' : 'Not Found');
            console.log('CTU5:', ctu5 ? 'Found' : 'Not Found');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`CTU2 (Previous Owner): ${ctu2.personalName || ctu2.breederName} - ${ctu2._id}`);
        console.log(`CTU5 (New Owner): ${ctu5.personalName || ctu5.breederName} - ${ctu5._id}\n`);

        let transferred = 0;
        let skipped = 0;
        let notFound = 0;

        for (const animalId of ANIMALS_TO_TRANSFER) {
            const animal = await Animal.findOne({ id_public: animalId });

            if (!animal) {
                console.log(`❌ ${animalId}: NOT FOUND`);
                notFound++;
                continue;
            }

            // Check if already owned by CTU5
            if (animal.ownerId.toString() === ctu5._id.toString()) {
                console.log(`⏭️  ${animalId} (${animal.name}): Already owned by CTU5, skipping`);
                skipped++;
                continue;
            }

            // Check current owner
            if (animal.ownerId.toString() !== ctu2._id.toString()) {
                console.log(`⚠️  ${animalId} (${animal.name}): Owned by ${animal.ownerId_public}, not CTU2. Skipping.`);
                skipped++;
                continue;
            }

            // Transfer the animal
            const previousOwnerId = animal.ownerId;
            const previousOwnerPublic = animal.ownerId_public;

            animal.ownerId = ctu5._id;
            animal.ownerId_public = ctu5.id_public;
            animal.isOwned = true;

            // Add CTU2 to viewOnlyForUsers if not already there
            if (!animal.viewOnlyForUsers) {
                animal.viewOnlyForUsers = [];
            }
            if (!animal.viewOnlyForUsers.includes(ctu2._id)) {
                animal.viewOnlyForUsers.push(ctu2._id);
            }

            // Remove from hiddenForUsers if it was hidden
            if (animal.hiddenForUsers && animal.hiddenForUsers.includes(ctu2._id)) {
                animal.hiddenForUsers = animal.hiddenForUsers.filter(
                    id => id.toString() !== ctu2._id.toString()
                );
            }

            await animal.save();

            // Update PublicAnimal if this animal is public
            if (animal.showOnPublicProfile) {
                await PublicAnimal.updateOne(
                    { id_public: animal.id_public },
                    {
                        $set: {
                            ownerId_public: animal.ownerId_public,
                            status: animal.status
                        }
                    }
                );
            }

            // Update user ownedAnimals arrays
            await User.findByIdAndUpdate(previousOwnerId, {
                $pull: { ownedAnimals: animal._id }
            });

            await User.findByIdAndUpdate(ctu5._id, {
                $addToSet: { ownedAnimals: animal._id }
            });

            console.log(`✓ ${animalId} (${animal.name}): Transferred from ${previousOwnerPublic} to CTU5`);
            transferred++;
        }

        console.log(`\n=== Summary ===`);
        console.log(`Transferred: ${transferred}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Not Found: ${notFound}`);

        // Verify CTU5 now owns these animals
        console.log(`\n=== Verification ===`);
        const ctu5Animals = await Animal.find({
            id_public: { $in: ANIMALS_TO_TRANSFER },
            ownerId: ctu5._id
        }).lean();

        console.log(`CTU5 now owns ${ctu5Animals.length} of the ${ANIMALS_TO_TRANSFER.length} animals:`);
        ctu5Animals.forEach(a => {
            const hasViewOnlyForCTU2 = a.viewOnlyForUsers && a.viewOnlyForUsers.some(
                id => id.toString() === ctu2._id.toString()
            );
            console.log(`  ${a.id_public} (${a.name}): isOwned=${a.isOwned}, CTU2 view-only=${hasViewOnlyForCTU2}`);
        });

        // Check for duplicates
        console.log(`\n=== Checking for duplicates ===`);
        const allAnimals = await Animal.find({ id_public: { $in: ANIMALS_TO_TRANSFER } }).lean();
        const idCounts = {};
        allAnimals.forEach(a => {
            idCounts[a.id_public] = (idCounts[a.id_public] || 0) + 1;
        });

        const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log('⚠️  Found duplicates:');
            duplicates.forEach(([id, count]) => {
                console.log(`  ${id}: ${count} copies`);
            });
        } else {
            console.log('✓ No duplicates found');
        }

        await mongoose.disconnect();
        console.log('\n✓ Complete');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

transferAnimals();
