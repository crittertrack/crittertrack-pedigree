const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { AnimalTransfer, Animal, Notification, User, PublicProfile } = require('../database/models'); // PublicAnimal removed as accept-view-only route is removed

// GET /api/transfers - Get all transfers for the logged-in user (sent and received)
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const transfers = await AnimalTransfer.find({
            $or: [{ fromUserId: userId }, { toUserId: userId }]
        })
        .sort({ createdAt: -1 })
        .populate('fromUserId', 'id_public personalName breederName')
        .populate('toUserId', 'id_public personalName breederName')
        .lean();
        
        res.status(200).json(transfers);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ message: 'Internal server error while fetching transfers.' });
    }
});

// POST /api/transfers - Initiate a new transfer request
router.post('/', async (req, res) => {
    const session = await mongoose.startSession(); // Start a session
    session.startTransaction(); // Start a transaction
    try {
        const { animalId_public, toUserId, price, notes } = req.body;
        const fromUserId = req.user.id; // Assuming req.user.id is reliably populated by authentication middleware

        // 1. Verify animal exists and belongs to the sender
        const animal = await Animal.findOne({ id_public: animalId_public, creatorId: fromUserId });
        if (!animal) {
            await session.abortTransaction(); // Abort transaction on error
            return res.status(404).json({ message: 'Animal not found or you are not the owner.' });
        }

        // --- NEW: Prevent duplicate pending transfers for this animal ---
        // Assuming Animal model has a 'pendingTransferId' field (ObjectId)
        if (animal.pendingTransferId) {
            await session.abortTransaction(); // Abort transaction on error
            return res.status(409).json({ message: 'This animal already has a pending transfer request.' });
        }
        // --- END NEW ---

        // 2. Create the Transfer Record
        const transferType = req.body.transferType || 'gift'; // Ensure transferType is set

        const transfer = await AnimalTransfer.create([{
            fromUserId,
            toUserId,
            animalId_public,
            price: price || 0,
            notes: notes || '',
            status: 'pending',
            transferType: transferType,
            type: 'ownership', // Explicitly set type for new ownership transfers
        }], { session });
        const createdTransfer = transfer[0]; // Get the created document

        // --- NEW: Update animal with pendingTransferId ---
        animal.pendingTransferId = createdTransfer._id; // Set pendingTransferId
        await animal.save({ session }); // Save animal within the session
        // --- END NEW ---

        // 3. Create Notification for the Recipient
        const sender = await User.findById(fromUserId).select('personalName breederName').session(session); // Pass session
        const senderName = sender?.breederName || sender?.personalName || 'A CritterTrack User';
        
        // Get recipient's public ID
        const recipient = await User.findById(toUserId).select('id_public').session(session);
        const recipientPublicId = recipient?.id_public || '';

        try {
            await Notification.create([{ // Create with array for session
                userId: toUserId,
                userId_public: recipientPublicId,
                type: 'transfer_request',
                status: 'pending',
                animalId_public,
                animalName: animal.name,
                animalImageUrl: animal.imageUrl || '',
                transferId: createdTransfer._id,
                message: `${senderName} wants to transfer ${animal.name} (${animalId_public}) to you.`,
                metadata: {
                    transferId: createdTransfer._id,
                    animalId: animalId_public,
                    price: price || 0
                }
            }], { session });
            console.log('[Transfer Create] Notification created for recipient:', recipientPublicId);
        } catch (notifError) {
            console.error('[Transfer Create] Failed to create notification:', notifError.message);
            // Don't abort - notification is secondary to transfer
        }

        await session.commitTransaction(); // Commit the transaction
        res.status(201).json({ message: 'Transfer request sent successfully.', transfer: createdTransfer });
    } catch (error) {
        await session.abortTransaction(); // Abort transaction on error
        console.error('Error creating transfer:', error);
        res.status(500).json({ message: 'Internal server error while creating transfer.' });
    } finally {
        session.endSession(); // End the session
    }
});

// POST /api/transfers/:id/accept - Accept a transfer
router.post('/:id/accept', async (req, res) => {
    const session = await mongoose.startSession(); // Start a session
    session.startTransaction(); // Start a transaction
    try {
        const userId = req.user.id;
        const transferId = req.params.id;
        
        console.log('[Transfer Accept] UserId:', userId, 'TransferId:', transferId);
        
        const transfer = await AnimalTransfer.findById(transferId).session(session);
        
        if (!transfer) {
            console.log('[Transfer Accept] Transfer not found with ID:', transferId);
            await session.abortTransaction(); // Abort transaction on error
            return res.status(404).json({ message: 'Transfer not found.' });
        }
        
        console.log('[Transfer Accept] Transfer found:', {
            fromUserId: transfer.fromUserId.toString(),
            toUserId: transfer.toUserId.toString(),
            status: transfer.status
        });
        
        // Verify the user is the recipient - convert both to strings for comparison
        if (transfer.toUserId.toString() !== userId.toString()) {
            console.log('[Transfer Accept] Authorization failed - user is not recipient');
            console.log('[Transfer Accept] transfer.toUserId:', transfer.toUserId.toString(), 'userId:', userId.toString());
            return res.status(403).json({ message: 'You are not authorized to accept this transfer.' });
        }
        
        if (transfer.status !== 'pending') {
            console.log('[Transfer Accept] Transfer already responded:', transfer.status);
            return res.status(400).json({ message: 'Transfer has already been responded to.' });
        }
        
        // Find the animal
        const animal = await Animal.findOne({ id_public: transfer.animalId_public }).session(session); // Pass session
        
        if (!animal) {
            console.log('[Transfer Accept] Animal not found:', transfer.animalId_public);
            return res.status(404).json({ message: 'Animal not found.' });
        }
        
        console.log('[Transfer Accept] Animal found:', animal.id_public, 'Current owner:', animal.creatorId.toString());
        
        // Update transfer status
        transfer.status = 'accepted';
        transfer.respondedAt = new Date();
        transfer.completedAt = new Date();
        await transfer.save({ session }); // Pass session
        
        console.log('[Transfer Accept] Transfer status updated to accepted');
        
        // Transfer ownership logic
        const previousOwner = animal.creatorId;
        const previousOwnerPublic = animal.creatorId_public;
        
        // Set original owner if not already set
        if (!animal.originalCreatorId) {
            animal.originalCreatorId = previousOwner;
        }
        
        // Get the new owner's public ID
        let newOwner = await User.findById(userId).select('id_public').session(session); // Pass session
        if (!newOwner) {
            console.error('[Transfer Accept] Could not find new owner user document');
            // Create a fallback - this shouldn't happen but let's be safe
            newOwner = { id_public: 'UNKNOWN' };
        }
        console.log('[Transfer Accept] New owner found:', newOwner?.id_public);
        
        // Update animal ownership
        animal.creatorId = userId;
        animal.creatorId_public = newOwner.id_public;
        animal.soldStatus = 'sold';
        animal.isOwned = true; // Mark animal as owned by new owner (not view-only)
        animal.isForSale = false; // Clear for-sale flag on transfer
        animal.availableForBreeding = false; // Clear stud flag on transfer
        
        // Add the previous owner to viewOnlyForUsers so they can see the live animal record
        // in their "Sold Animals" archive, reflecting all changes.
        if (previousOwner) {
            if (!Array.isArray(animal.viewOnlyForUsers)) {
                animal.viewOnlyForUsers = [];
            }
            animal.viewOnlyForUsers.push(previousOwner);
        }
        
        animal.pendingTransferId = undefined; // --- NEW: Clear pendingTransferId on animal ---
        await animal.save({ session }); // Pass session
        console.log('[Transfer Accept] Animal ownership transferred, viewOnly access added');
        
        // Update PublicAnimal if this animal is public
        if (animal.showOnPublicProfile) {
            // PublicAnimal model was removed, so this block is no longer relevant.
            // If PublicAnimal functionality is still desired, it needs to be re-implemented
            // and the model re-imported.
            console.warn('[Transfer Accept] PublicAnimal update skipped as model is not imported.');
        }
        
        // Update user ownedAnimals arrays
        await User.findByIdAndUpdate(previousOwner, {
            $pull: { ownedAnimals: animal._id }
        }, { session }); // Pass session
        console.log('[Transfer Accept] Removed animal from previous owner ownedAnimals');
        
        await User.findByIdAndUpdate(userId, {
            $addToSet: { ownedAnimals: animal._id }
        }, { session }); // Pass session
        console.log('[Transfer Accept] Added animal to new owner ownedAnimals');
        
        // Update the original notification to approved status
        const notificationUpdate = await Notification.updateOne(
            { transferId: transfer._id, type: 'transfer_request' },
            { $set: { status: 'accepted' } },
            { session } // Pass session
        );
        console.log('[Transfer Accept] Notification update result:', notificationUpdate);
        if (notificationUpdate.matchedCount === 0) {
            console.warn('[Transfer Accept] WARNING: No notification found for this transfer');
        }
        
        // Create notification for the sender (informational only, no action needed)
        try {
            console.log('[Transfer Accept] Creating sender notification for userId:', transfer.fromUserId);
            const senderProfile = await PublicProfile.findOne({ userId_backend: transfer.fromUserId }).session(session); // Pass session
            console.log('[Transfer Accept] Sender profile found:', senderProfile ? senderProfile.id_public : 'NOT FOUND');
            
            const notificationData = {
                userId: transfer.fromUserId,
                userId_public: senderProfile?.id_public || '',
                type: 'transfer_accepted',
                status: 'accepted', // --- NEW: Consistent status naming 'accepted' ---
                animalId_public: animal.id_public,
                animalName: animal.name,
                animalImageUrl: animal.imageUrl || '',
                transferId: transfer._id,
                message: `Your animal transfer for ${animal.name} (${animal.id_public}) has been accepted.`,
                metadata: {
                    transferId: transfer._id,
                    animalId: animal.id_public,
                    animalName: animal.name
                }
            };
            console.log('[Transfer Accept] Creating notification with data:', JSON.stringify(notificationData, null, 2));
            
            const createdNotification = await Notification.create([notificationData], { session }); // Create with array and session
            console.log('[Transfer Accept] Notification created successfully with ID:', createdNotification[0]._id);
        } catch (notifError) {
            console.error('[Transfer Accept] Failed to create sender notification:', notifError);
            console.error('[Transfer Accept] Error stack:', notifError.stack);
            // Don't fail the whole transfer if notification creation fails
        }

        await session.commitTransaction();
console.log('[Transfer Accept] ✓ Transaction committed');
        
        console.log('[Transfer Accept] ✓ Transfer accepted successfully');
        res.status(200).json({ 
            message: 'Transfer accepted successfully.', 
            transfer,
            animal: {
                id_public: animal.id_public,
                name: animal.name,
                creatorId_public: animal.creatorId_public
            }
        });
    } catch (error) {
    console.error('[Transfer Accept] Error:', error);
    console.error('[Transfer Accept] Error stack:', error.stack);

    if (session.inTransaction()) {
        await session.abortTransaction();
        console.log('[Transfer Accept] Transaction aborted');
    }

    res.status(500).json({
        message: 'Internal server error while accepting transfer.',
        error: error.message
    });
} finally {
    await session.endSession();
}
});

// POST /api/transfers/:id/decline - Decline a transfer
router.post('/:id/decline', async (req, res) => {
    const session = await mongoose.startSession(); // Start a session
    session.startTransaction(); // Start a transaction
    try {
        const userId = req.user.id;
        const transferId = req.params.id;
        
        const transfer = await AnimalTransfer.findById(transferId).session(session); // Pass session
        
        if (!transfer) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Transfer not found.' });
        }
        
        // Verify the user is the recipient
        if (transfer.toUserId.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({ message: 'You are not authorized to decline this transfer.' });
        }
        
        if (transfer.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Transfer has already been responded to.' });
        }
        
        // Update transfer status
        transfer.status = 'declined';
        transfer.respondedAt = new Date();
        transfer.completedAt = new Date();
        await transfer.save({ session }); // Pass session
        
        // --- NEW: Clear pendingTransferId on animal ---
        const animal = await Animal.findOne({ id_public: transfer.animalId_public }).session(session); // Pass session
        if (animal) {
            animal.pendingTransferId = undefined;
            await animal.save({ session }); // Pass session
        }
        // --- END NEW ---

        // Update the original notification to declined status
        await Notification.updateOne(
            { transferId: transfer._id, userId: userId, type: 'transfer_request' },
            { $set: { status: 'declined' } },
            { session } // Pass session
        );
        
        // Create notification for the sender (informational only, no action needed)
        // The animal was already fetched above, no need to fetch again.
        try {
            const senderProfile = await PublicProfile.findOne({ userId_backend: transfer.fromUserId }).session(session); // Pass session
            await Notification.create([{ // Create with array for session
            userId: transfer.fromUserId,
            userId_public: senderProfile?.id_public || '',
            type: 'transfer_declined',
            status: 'declined', // Not pending - this is informational only
            animalId_public: transfer.animalId_public,
            animalName: animal?.name || '',
            animalImageUrl: animal?.imageUrl || '',
            transferId: transfer._id,
            message: `Your animal transfer for ${animal?.name || transfer.animalId_public} has been declined.`,
            metadata: {
                transferId: transfer._id,
                animalId: transfer.animalId_public
            }
            }], { session }); // Pass session
        } catch (notifError) {
            console.error('[Decline Transfer] Failed to create sender notification:', notifError);
        }
        await session.commitTransaction(); // Commit the transaction
        res.status(200).json({ 
            message: 'Transfer declined. The transaction remains in your budget as a local entry.', 
            transfer
        });
    } catch (error) {
        console.error('Error declining transfer:', error);
        res.status(500).json({ message: 'Internal server error while declining transfer.' });
        await session.abortTransaction(); // Abort transaction on error
    } finally {
        session.endSession(); // End the session
    }
});

// POST /api/transfers/return - Return an animal to its original breeder/creator
router.post('/return', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user.id;
        const { animalId_public } = req.body;

        if (!animalId_public) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'animalId_public is required.' });
        }

        // Find the animal - current owner must be the one returning it
        const animal = await Animal.findOne({ id_public: animalId_public, creatorId: userId }).session(session);

        if (!animal) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Animal not found or you are not the current owner.' });
        }

        // Must have an originalCreatorId to return to
        if (!animal.originalCreatorId) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'This animal has no original breeder/owner to return to.' });
        }

        // Prevent duplicate pending returns
        if (animal.pendingTransferId) {
            await session.abortTransaction();
            return res.status(409).json({ message: 'This animal already has a pending transfer request.' });
        }

        const originalOwnerId = animal.originalCreatorId;

        // Create the return transfer record
        const transfer = await AnimalTransfer.create([{
            fromUserId: userId,
            toUserId: originalOwnerId,
            animalId_public,
            price: 0,
            notes: 'Animal returned to original breeder',
            status: 'pending',
            transferType: 'return',
            type: 'ownership',
        }], { session });

        const createdTransfer = transfer[0];

        // Set pendingTransferId on animal
        animal.pendingTransferId = createdTransfer._id;
        await animal.save({ session });

        // Notify the original owner
        try {
            const returnerProfile = await PublicProfile.findOne({ userId_backend: userId }).session(session);
            const returnerName = returnerProfile?.breederName || returnerProfile?.personalName || 'A CritterTrack User';

            const originalOwner = await User.findById(originalOwnerId).select('id_public').session(session);

            await Notification.create([{
                userId: originalOwnerId,
                userId_public: originalOwner?.id_public || '',
                type: 'transfer_request',
                status: 'pending',
                animalId_public,
                animalName: animal.name,
                animalImageUrl: animal.imageUrl || '',
                transferId: createdTransfer._id,
                message: `${returnerName} wants to return ${animal.name} (${animalId_public}) to you.`,
                metadata: {
                    transferId: createdTransfer._id,
                    animalId: animalId_public,
                    isReturn: true
                }
            }], { session });
        } catch (notifError) {
            console.error('[Return Transfer] Notification error:', notifError.message);
        }

        await session.commitTransaction();
        res.status(201).json({ message: 'Return request sent successfully.', transfer: createdTransfer });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error returning animal:', error);
        res.status(500).json({ message: 'Internal server error while returning animal.' });
    } finally {
        session.endSession();
    }
});

router.post('/:id/withdraw', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user.id;
        const transferId = req.params.id;

        const transfer = await AnimalTransfer.findById(transferId).session(session);

        if (!transfer) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Transfer not found.' });
        }

        // Only sender can withdraw
        if (transfer.fromUserId.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                message: 'You are not authorized to withdraw this transfer.'
            });
        }

        // Only pending transfers can be withdrawn
        if (transfer.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({
                message: 'Only pending transfers can be withdrawn.'
            });
        }

        // Update transfer
        transfer.status = 'cancelled';
        transfer.respondedAt = new Date();
        transfer.completedAt = new Date();

        await transfer.save({ session });

        // --- NEW: Clear pendingTransferId on animal ---
        const animal = await Animal.findOne({
            id_public: transfer.animalId_public
        }).session(session);
        if (animal) {
            animal.pendingTransferId = undefined;
            await animal.save({ session });
        }
        // --- END NEW ---

        // Update original notification (if it exists)
        await Notification.updateOne(
            {
                transferId: transfer._id,
                type: 'transfer_request'
            },
            {
                $set: {
                    status: 'cancelled'
                }
            },
            { session } // Pass session
        );

        // Notify recipient (optional but recommended)
        try {
            const senderProfile = await PublicProfile.findOne({
                userId_backend: transfer.fromUserId
            }).session(session);
            
            // Get recipient's profile for the notification
            const recipientProfile = await PublicProfile.findOne({
                userId_backend: transfer.toUserId
            }).session(session);

            await Notification.create([{ // Create with array for session
                userId: transfer.toUserId, // Recipient of the cancellation notification
                userId_public: recipientProfile?.id_public || '', // Use recipient's ID, not sender's
                type: 'transfer_cancelled',
                status: 'cancelled',
                animalId_public: transfer.animalId_public,
                animalName: animal?.name || '',
                animalImageUrl: animal?.imageUrl || '',
                transferId: transfer._id,
                message: `Transfer for ${animal?.name || transfer.animalId_public} was withdrawn by the sender.`,
                metadata: {
                    transferId: transfer._id,
                    animalId: transfer.animalId_public
                }
            }], { session });
        } catch (notifError) {
            console.error('[Withdraw Transfer] Notification error:', notifError.message);
        }

        await session.commitTransaction();
        res.status(200).json({
            message: 'Transfer withdrawn successfully.',
            transfer
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession(); // Ensure session is ended on error
        console.error('Error withdrawing transfer:', error);
        res.status(500).json({
            message: 'Internal server error while withdrawing transfer.'
        });
    } finally {
        session.endSession();
    }
});

module.exports = router;