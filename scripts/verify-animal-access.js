/**
 * Verify animals appear correctly in My Animals for CTU5 and view-only for CTU2
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function verifyAnimalAccess() {
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
            console.error('ERROR: Could not find users');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`CTU2: ${ctu2.personalName || ctu2.breederName}`);
        console.log(`CTU5: ${ctu5.personalName || ctu5.breederName}\n`);

        // ============================================================
        // CTU5 "My Animals" Query
        // ============================================================
        console.log('═'.repeat(80));
        console.log('CTU5 - "MY ANIMALS" LIST (isOwned filter = true)');
        console.log('═'.repeat(80));

        const ctu5MyAnimals = await Animal.find({
            ownerId: ctu5._id,
            isOwned: true
        }).sort({ id_public: 1 }).lean();

        console.log(`\nFound: ${ctu5MyAnimals.length} animals\n`);
        
        if (ctu5MyAnimals.length > 0) {
            ctu5MyAnimals.forEach(a => {
                console.log(`  ${a.id_public.padEnd(10)} | ${(a.name || 'Unnamed').padEnd(25)} | isOwned: ${a.isOwned}`);
            });
        }

        // ============================================================
        // CTU2 View-Only Animals Query
        // ============================================================
        console.log('\n\n');
        console.log('═'.repeat(80));
        console.log('CTU2 - VIEW-ONLY ANIMALS (in viewOnlyForUsers but not owned)');
        console.log('═'.repeat(80));

        const ctu2ViewOnly = await Animal.find({
            viewOnlyForUsers: ctu2._id,
            hiddenForUsers: { $ne: ctu2._id }
        }).sort({ id_public: 1 }).lean();

        console.log(`\nFound: ${ctu2ViewOnly.length} view-only animals\n`);
        
        if (ctu2ViewOnly.length > 0) {
            ctu2ViewOnly.forEach(a => {
                const isOwnedByCTU2 = a.ownerId.toString() === ctu2._id.toString();
                const owner = a.ownerId_public || 'Unknown';
                console.log(`  ${a.id_public.padEnd(10)} | ${(a.name || 'Unnamed').padEnd(25)} | Owner: ${owner.padEnd(6)} | ${isOwnedByCTU2 ? '⚠️ OWNED BY CTU2' : '✓ View-only'}`);
            });
        }

        // ============================================================
        // Cross-verification
        // ============================================================
        console.log('\n\n');
        console.log('═'.repeat(80));
        console.log('CROSS-VERIFICATION');
        console.log('═'.repeat(80));

        // Get the list of animal IDs from CTU5's My Animals
        const ctu5AnimalIds = new Set(ctu5MyAnimals.map(a => a.id_public));
        
        // Get the list of animal IDs from CTU2's view-only
        const ctu2ViewOnlyIds = new Set(ctu2ViewOnly.map(a => a.id_public));

        // Check if all CTU5 animals appear in CTU2's view-only
        const missingFromCTU2ViewOnly = ctu5MyAnimals.filter(a => !ctu2ViewOnlyIds.has(a.id_public));
        const extraInCTU2ViewOnly = ctu2ViewOnly.filter(a => !ctu5AnimalIds.has(a.id_public));

        console.log(`\nCTU5 My Animals: ${ctu5MyAnimals.length}`);
        console.log(`CTU2 View-Only: ${ctu2ViewOnly.length}`);
        console.log(`Animals in both: ${ctu5MyAnimals.filter(a => ctu2ViewOnlyIds.has(a.id_public)).length}`);

        if (missingFromCTU2ViewOnly.length > 0) {
            console.log(`\n⚠️  Animals in CTU5's list but NOT in CTU2's view-only: ${missingFromCTU2ViewOnly.length}`);
            missingFromCTU2ViewOnly.forEach(a => {
                console.log(`  ${a.id_public} (${a.name})`);
            });
        } else {
            console.log(`\n✓ All CTU5 animals appear in CTU2's view-only list`);
        }

        if (extraInCTU2ViewOnly.length > 0) {
            console.log(`\n⚠️  Animals in CTU2's view-only but NOT owned by CTU5: ${extraInCTU2ViewOnly.length}`);
            extraInCTU2ViewOnly.forEach(a => {
                console.log(`  ${a.id_public} (${a.name}) - Owner: ${a.ownerId_public}`);
            });
        } else {
            console.log(`✓ All CTU2 view-only animals are owned by CTU5`);
        }

        // ============================================================
        // CTU2's "My Animals" Query (should not include these)
        // ============================================================
        console.log('\n\n');
        console.log('═'.repeat(80));
        console.log('CTU2 - "MY ANIMALS" LIST (to verify transferred animals are excluded)');
        console.log('═'.repeat(80));

        const ctu2MyAnimals = await Animal.find({
            ownerId: ctu2._id,
            isOwned: true
        }).sort({ id_public: 1 }).lean();

        console.log(`\nFound: ${ctu2MyAnimals.length} owned animals\n`);

        // Check if any of CTU5's animals appear in CTU2's My Animals
        const wronglyInCTU2MyAnimals = ctu2MyAnimals.filter(a => ctu5AnimalIds.has(a.id_public));
        
        if (wronglyInCTU2MyAnimals.length > 0) {
            console.log(`⚠️  ERROR: These animals appear in BOTH CTU2's and CTU5's My Animals:`);
            wronglyInCTU2MyAnimals.forEach(a => {
                console.log(`  ${a.id_public} (${a.name})`);
            });
        } else {
            console.log(`✓ None of CTU5's animals appear in CTU2's "My Animals" list`);
        }

        console.log('\n\n═'.repeat(80));
        console.log('SUMMARY');
        console.log('═'.repeat(80));
        console.log(`✓ CTU5 "My Animals": ${ctu5MyAnimals.length} animals`);
        console.log(`✓ CTU2 View-Only: ${ctu2ViewOnly.length} animals`);
        console.log(`✓ Overlap: ${ctu5MyAnimals.filter(a => ctu2ViewOnlyIds.has(a.id_public)).length} animals`);
        console.log(`✓ Setup is ${missingFromCTU2ViewOnly.length === 0 && wronglyInCTU2MyAnimals.length === 0 ? 'CORRECT' : 'INCORRECT'}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

verifyAnimalAccess();
