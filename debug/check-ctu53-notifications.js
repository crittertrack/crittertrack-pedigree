const mongoose = require('mongoose');
require('dotenv').config();

const { Notification, User } = require('../database/models');

async function checkNotifications() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI or MONGO_URI not found in environment variables');
            process.exit(1);
        }
        
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Get CTU53's user ID
        const user = await User.findOne({ id_public: 'CTU53' });
        if (!user) {
            console.log('CTU53 not found');
            return;
        }
        console.log('CTU53 UserId:', user._id);

        // Check all transfer-related notifications for CTU53
        const allTransferNotifs = await Notification.find({
            userId: user._id,
            type: { $in: ['transfer_request', 'transfer_accepted', 'transfer_declined', 'transfer_cancelled'] }
        }).sort({ createdAt: -1 });

        console.log(`\nTotal transfer notifications for CTU53: ${allTransferNotifs.length}`);
        console.log('\nNotifications breakdown:');
        const byType = {};
        allTransferNotifs.forEach(notif => {
            byType[notif.type] = (byType[notif.type] || 0) + 1;
        });
        Object.entries(byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        console.log('\nRecent notifications:');
        allTransferNotifs.slice(0, 5).forEach(notif => {
            console.log(`  - ${notif.type}: ${notif.animalName} (${notif.animalId_public}) - ${notif.createdAt}`);
        });

        // Also check transfers where CTU53 is the recipient
        const transfers = await mongoose.connection.collection('animaltransfers').find({
            toUserId: user._id
        }).toArray();
        console.log(`\nTotal transfers TO CTU53: ${transfers.length}`);
        console.log('Transfers breakdown:');
        transfers.forEach(t => {
            console.log(`  - ${t.animalId_public}: status=${t.status}, createdAt=${t.createdAt}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkNotifications();
