/**
 * Debug script to diagnose why user CTU53 is not seeing animals in their list
 * Usage: node debug/check-user-ctu53.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { User, Animal, PublicAnimal } = require('../database/models');

async function debugUserAnimals() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find user by id_public = CTU53
        const user = await User.findOne({ id_public: 'CTU53' })
            .select('_id id_public personalName breederName email accountStatus createdAt lastActive')
            .lean();

        if (!user) {
            console.log('❌ User CTU53 not found');
            return;
        }

        console.log('📋 User Details:');
        console.log(`  ID (MongoDB): ${user._id}`);
        console.log(`  ID (Public): ${user.id_public}`);
        console.log(`  Name: ${user.personalName || user.breederName || 'N/A'}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Account Status: ${user.accountStatus || 'active'}`);
        console.log(`  Created: ${new Date(user.createdAt).toLocaleDateString()}`);
        console.log(`  Last Active: ${user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}\n`);

        // Check for animals created by this user
        const createdAnimals = await Animal.find({ creatorId: user._id })
            .select('_id id_public name archived isStub isOwned createdAt')
            .lean();

        console.log(`📊 Animals Created by CTU53: ${createdAnimals.length}`);
        if (createdAnimals.length > 0) {
            console.log('  First 10:');
            createdAnimals.slice(0, 10).forEach(a => {
                const status = a.isStub ? '🐚 STUB' : a.archived ? '📦 ARCHIVED' : a.isOwned ? '✅ OWNED' : '👁️ VIEW-ONLY';
                console.log(`    - ${a.id_public} (${a.name}): ${status}`);
            });
            
            // Breakdown by status
            const stubs = createdAnimals.filter(a => a.isStub).length;
            const archived = createdAnimals.filter(a => a.archived && !a.isStub).length;
            const owned = createdAnimals.filter(a => !a.archived && !a.isStub && a.isOwned).length;
            const viewOnly = createdAnimals.filter(a => !a.archived && !a.isStub && !a.isOwned).length;
            
            console.log(`\n  Breakdown:`);
            console.log(`    - Active & Owned: ${owned}`);
            console.log(`    - Active & View-Only: ${viewOnly}`);
            console.log(`    - Archived: ${archived}`);
            console.log(`    - Stubs: ${stubs}`);
        }

        // Check for view-only animals (transferred to user)
        const viewOnlyAnimals = await Animal.find({ 
            viewOnlyForUsers: user._id,
            hiddenForUsers: { $ne: user._id }
        })
            .select('_id id_public name archived creatorId')
            .lean();

        console.log(`\n👁️ View-Only Animals (Transferred to CTU53): ${viewOnlyAnimals.length}`);
        if (viewOnlyAnimals.length > 0) {
            console.log('  First 5:');
            viewOnlyAnimals.slice(0, 5).forEach(a => {
                console.log(`    - ${a.id_public} (${a.name})`);
            });
        }

        // Simulate the query that the API would execute (All Animals filter)
        console.log(`\n🔍 Simulating "All Animals" query:\n`);
        const simulatedQuery = {
            $or: [
                { creatorId: user._id },
                { 
                    viewOnlyForUsers: user._id,
                    hiddenForUsers: { $ne: user._id }
                },
                {
                    originalCreatorId: user._id,
                    creatorId: { $ne: user._id }
                }
            ],
            isStub: { $ne: true },
            archived: { $ne: true }
        };

        const filteredAnimals = await Animal.find(simulatedQuery)
            .select('id_public name creatorId originalCreatorId viewOnlyForUsers')
            .lean();

        console.log(`  Results: ${filteredAnimals.length} animals`);
        if (filteredAnimals.length > 0) {
            console.log('  First 10:');
            filteredAnimals.slice(0, 10).forEach(a => {
                const isOwned = a.creatorId.toString() === user._id.toString();
                const isViewOnly = !isOwned && a.viewOnlyForUsers?.includes(user._id);
                const type = isOwned ? 'OWNED' : isViewOnly ? 'VIEW-ONLY' : 'TRANSFERRED OUT';
                console.log(`    - ${a.id_public} (${a.name}): ${type}`);
            });
        } else {
            console.log('  ⚠️ NO ANIMALS FOUND with "All Animals" filter');
            console.log('\n  Checking why...');

            // Check if ALL created animals are stubs or archived
            const allCreated = await Animal.find({ creatorId: user._id })
                .select('id_public isStub archived')
                .lean();
            
            const allStubs = allCreated.every(a => a.isStub);
            const allArchived = allCreated.every(a => a.archived);
            
            if (allStubs) console.log('    ⚠️ ALL created animals are STUBS');
            if (allArchived) console.log('    ⚠️ ALL created animals are ARCHIVED');
            if (!allStubs && !allArchived && allCreated.length > 0) {
                console.log('    ⚠️ Query construction might be wrong. Sample animals:');
                allCreated.slice(0, 3).forEach(a => {
                    console.log(`      - ${a.id_public}: isStub=${a.isStub}, archived=${a.archived}`);
                });
            }
        }

        // Check if user is banned/suspended
        const userFull = await User.findOne({ id_public: 'CTU53' });
        if (userFull.accountStatus === 'suspended' || userFull.accountStatus === 'banned') {
            console.log(`\n🚫 USER ACCOUNT STATUS: ${userFull.accountStatus.toUpperCase()}`);
        }

        console.log('\n✅ Diagnostics complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

debugUserAnimals();
