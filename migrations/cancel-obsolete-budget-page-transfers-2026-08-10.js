// The budget-page-initiated transfer system (routes/budgetRoutes.js: logging a 'sale'/'purchase'
// transaction with a linked buyerUserId/sellerUserId+animalId) is obsolete — the frontend no longer
// sends those fields (confirmed: no `buyerUserId` reference anywhere in crittertrack-frontend/src).
// It left behind AnimalTransfer records stuck at status='pending' forever, since they were never
// wired into animal.pendingTransferId the way the current ownership-transfer system is, and the
// current frontend has no path left to accept/decline them. This closes them out and resolves any
// linked Notification so they stop showing as live "Pending Requests".
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, AnimalTransfer, Notification } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const pendingTransfers = await AnimalTransfer.find({
        status: 'pending',
        transferType: { $in: ['sale', 'purchase'] },
    });
    console.log(`Found ${pendingTransfers.length} pending 'sale'/'purchase' transfer(s) to check.\n`);

    let cancelledCount = 0;
    for (const t of pendingTransfers) {
        const animal = await Animal.findOne({ id_public: t.animalId_public }).select('id_public pendingTransferId').lean();
        const isLiveOwnershipTransfer = animal && animal.pendingTransferId && animal.pendingTransferId.toString() === t._id.toString();

        if (isLiveOwnershipTransfer) {
            console.log(`- SKIP transfer ${t._id} (${t.transferType}) for ${t.animalId_public}: still referenced by animal.pendingTransferId, this is a live transfer.`);
            continue;
        }

        console.log(`- Cancelling transfer ${t._id} (${t.transferType}) for ${t.animalId_public} (from old budget-page system).`);
        t.status = 'cancelled';
        t.notes = `${t.notes || ''} [Auto-cancelled 2026-08-10: obsolete budget-page transfer system]`.trim();
        await t.save();

        const notifResult = await Notification.updateMany(
            { transferId: t._id, status: 'pending' },
            { $set: { status: 'cancelled' } }
        );
        console.log(`  -> linked notifications updated: ${notifResult.modifiedCount}`);
        cancelledCount++;
    }

    console.log(`\nDone. Cancelled ${cancelledCount} obsolete transfer(s).`);
    await mongoose.disconnect();
})();
