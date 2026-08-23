require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, AnimalTransfer, Notification } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const animal = await Animal.findOne({ id_public: 'CTC5500' }).select('id_public name creatorId_public pendingTransferId');
    console.log('Animal CTC5500:', animal ? {
        id_public: animal.id_public,
        name: animal.name,
        creatorId_public: animal.creatorId_public,
        pendingTransferId: animal.pendingTransferId
    } : 'NOT FOUND');

    const transfers = await AnimalTransfer.find({ animalId_public: 'CTC5500' }).sort({ createdAt: -1 }).lean();
    console.log(`AnimalTransfer records for CTC5500: ${transfers.length}`);
    transfers.forEach(t => console.log({
        _id: t._id, status: t.status, transferType: t.transferType,
        fromUserId: t.fromUserId, toUserId: t.toUserId, createdAt: t.createdAt
    }));

    const notifs = await Notification.find({ animalId_public: 'CTC5500', type: 'transfer_request' }).sort({ createdAt: -1 }).lean();
    console.log(`Notification (transfer_request) records for CTC5500: ${notifs.length}`);
    notifs.forEach(n => console.log({
        _id: n._id, userId_public: n.userId_public, status: n.status, transferId: n.transferId, createdAt: n.createdAt
    }));

    await mongoose.disconnect();
})();
