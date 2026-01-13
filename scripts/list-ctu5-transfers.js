/**
 * List all transfers for CTU5 (Disney Mousery)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { AnimalTransfer, User } = require('../database/models');

async function listCTU5Transfers() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('ERROR: MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        // Find user CTU5
        const ctu5 = await User.findOne({ id_public: 'CTU5' });
        if (!ctu5) {
            console.log('User CTU5 not found');
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log(`User: ${ctu5.personalName || ctu5.breederName} (CTU5)`);
        console.log(`Backend ID: ${ctu5._id}\n`);

        // Get all transfers
        const allTransfers = await AnimalTransfer.find({})
            .populate('fromUserId', 'id_public personalName breederName')
            .populate('toUserId', 'id_public personalName breederName')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Total transfers in database: ${allTransfers.length}\n`);

        // Filter transfers for CTU5 (receiving)
        const ctu5Receiving = allTransfers.filter(t => 
            t.toUserId && t.toUserId._id.toString() === ctu5._id.toString()
        );

        // Filter transfers from CTU5 (sending)
        const ctu5Sending = allTransfers.filter(t => 
            t.fromUserId && t.fromUserId._id.toString() === ctu5._id.toString()
        );

        console.log(`Transfers TO CTU5 (receiving): ${ctu5Receiving.length}`);
        console.log(`Transfers FROM CTU5 (sending): ${ctu5Sending.length}\n`);

        if (ctu5Receiving.length > 0) {
            console.log('═'.repeat(100));
            console.log('TRANSFERS TO CTU5 (Receiving):');
            console.log('═'.repeat(100));
            ctu5Receiving.forEach(t => {
                const fromUser = t.fromUserId 
                    ? `${t.fromUserId.personalName || t.fromUserId.breederName} (${t.fromUserId.id_public})`
                    : 'Unknown';
                const status = t.status.toUpperCase();
                const type = t.transferType || 'transfer';
                const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Unknown';
                
                console.log(`\nAnimal: ${t.animalId_public} | Status: ${status} | Type: ${type}`);
                console.log(`From: ${fromUser}`);
                console.log(`Date: ${date}`);
                if (t.respondedAt) {
                    console.log(`Responded: ${new Date(t.respondedAt).toLocaleDateString()}`);
                }
            });
            console.log('═'.repeat(100));

            // Breakdown by status
            const statuses = {};
            ctu5Receiving.forEach(t => {
                statuses[t.status] = (statuses[t.status] || 0) + 1;
            });
            console.log('\nBreakdown by status:');
            Object.entries(statuses).forEach(([status, count]) => {
                console.log(`  ${status}: ${count}`);
            });
        }

        if (ctu5Sending.length > 0) {
            console.log('\n\n');
            console.log('═'.repeat(100));
            console.log('TRANSFERS FROM CTU5 (Sending):');
            console.log('═'.repeat(100));
            ctu5Sending.forEach(t => {
                const toUser = t.toUserId 
                    ? `${t.toUserId.personalName || t.toUserId.breederName} (${t.toUserId.id_public})`
                    : 'Unknown';
                const status = t.status.toUpperCase();
                const type = t.transferType || 'transfer';
                const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Unknown';
                
                console.log(`\nAnimal: ${t.animalId_public} | Status: ${status} | Type: ${type}`);
                console.log(`To: ${toUser}`);
                console.log(`Date: ${date}`);
                if (t.respondedAt) {
                    console.log(`Responded: ${new Date(t.respondedAt).toLocaleDateString()}`);
                }
            });
            console.log('═'.repeat(100));

            // Breakdown by status
            const statuses = {};
            ctu5Sending.forEach(t => {
                statuses[t.status] = (statuses[t.status] || 0) + 1;
            });
            console.log('\nBreakdown by status:');
            Object.entries(statuses).forEach(([status, count]) => {
                console.log(`  ${status}: ${count}`);
            });
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

listCTU5Transfers();
