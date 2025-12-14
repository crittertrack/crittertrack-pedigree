const express = require('express');
const router = express.Router();
const { AnimalTransfer, Animal, Transaction, Notification, User, PublicProfile } = require('../database/models');

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

// POST /api/transfers/:id/accept - Accept a transfer
router.post('/:id/accept', async (req, res) => {
    try {
        const userId = req.user.id;
        const transferId = req.params.id;
        
        console.log('[Transfer Accept] UserId:', userId, 'TransferId:', transferId);
        
        const transfer = await AnimalTransfer.findById(transferId);
        
        if (!transfer) {
            console.log('[Transfer Accept] Transfer not found with ID:', transferId);
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
        const animal = await Animal.findOne({ id_public: transfer.animalId_public });
        
        if (!animal) {
            console.log('[Transfer Accept] Animal not found:', transfer.animalId_public);
            return res.status(404).json({ message: 'Animal not found.' });
        }
        
        console.log('[Transfer Accept] Animal found:', animal.id_public, 'Current owner:', animal.ownerId.toString());
        
        // Update transfer status
        transfer.status = 'accepted';
        transfer.respondedAt = new Date();
        await transfer.save();
        
        console.log('[Transfer Accept] Transfer status updated to accepted');
        
        // Transfer ownership
        const previousOwner = animal.ownerId;
        const previousOwnerPublic = animal.ownerId_public;
        
        // Set original owner if not already set
        if (!animal.originalOwnerId) {
            animal.originalOwnerId = previousOwner;
        }
        
        // Get the new owner's public ID
        let newOwner = await User.findById(userId).select('id_public');
        if (!newOwner) {
            console.error('[Transfer Accept] Could not find new owner user document');
            // Create a fallback - this shouldn't happen but let's be safe
            newOwner = { id_public: 'UNKNOWN' };
        }
        console.log('[Transfer Accept] New owner found:', newOwner?.id_public);
        
        // Update animal ownership
        animal.ownerId = userId;
        animal.ownerId_public = newOwner.id_public;
        animal.soldStatus = transfer.transferType === 'sale' ? 'sold' : 'purchased';
        
        // Add previous owner to viewOnlyForUsers if not already there
        if (!animal.viewOnlyForUsers.includes(previousOwner)) {
            animal.viewOnlyForUsers.push(previousOwner);
        }
        
        await animal.save();
        console.log('[Transfer Accept] Animal ownership transferred, viewOnly access added');
        
        // Update PublicAnimal if this animal is public
        if (animal.showOnPublicProfile) {
            const PublicAnimal = require('../database/models').PublicAnimal;
            await PublicAnimal.updateOne(
                { id_public: animal.id_public },
                { 
                    $set: { 
                        ownerId_public: animal.ownerId_public,
                        status: animal.status
                    } 
                }
            );
            console.log('[Transfer Accept] PublicAnimal updated');
        }
        
        // Update user ownedAnimals arrays
        await User.findByIdAndUpdate(previousOwner, {
            $pull: { ownedAnimals: animal._id }
        });
        console.log('[Transfer Accept] Removed animal from previous owner ownedAnimals');
        
        await User.findByIdAndUpdate(userId, {
            $addToSet: { ownedAnimals: animal._id }
        });
        console.log('[Transfer Accept] Added animal to new owner ownedAnimals');
        
        // Update the original notification to accepted status
        const notificationUpdate = await Notification.updateOne(
            { transferId: transfer._id, type: 'transfer_request' },
            { $set: { status: 'accepted' } }
        );
        console.log('[Transfer Accept] Notification update result:', notificationUpdate);
        if (notificationUpdate.matchedCount === 0) {
            console.warn('[Transfer Accept] WARNING: No notification found for this transfer');
        }
        
        // Create notification for the sender (informational only, no action needed)
        try {
            console.log('[Transfer Accept] Creating sender notification for userId:', transfer.fromUserId);
            const senderProfile = await PublicProfile.findOne({ userId_backend: transfer.fromUserId });
            console.log('[Transfer Accept] Sender profile found:', senderProfile ? senderProfile.id_public : 'NOT FOUND');
            
            const notificationData = {
                userId: transfer.fromUserId,
                userId_public: senderProfile?.id_public || '',
                type: 'transfer_accepted',
                status: 'accepted', // Not pending - this is informational only
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
            
            const createdNotification = await Notification.create(notificationData);
            console.log('[Transfer Accept] Notification created successfully with ID:', createdNotification._id);
        } catch (notifError) {
            console.error('[Transfer Accept] Failed to create sender notification:', notifError);
            console.error('[Transfer Accept] Error stack:', notifError.stack);
            // Don't fail the whole transfer if notification creation fails
        }
        
        console.log('[Transfer Accept] ✓ Transfer accepted successfully');
        res.status(200).json({ 
            message: 'Transfer accepted successfully.', 
            transfer,
            animal: {
                id_public: animal.id_public,
                name: animal.name,
                ownerId_public: animal.ownerId_public
            }
        });
    } catch (error) {
        console.error('[Transfer Accept] Error:', error);
        console.error('[Transfer Accept] Error stack:', error.stack);
        res.status(500).json({ message: 'Internal server error while accepting transfer.', error: error.message });
    }
});

// POST /api/transfers/:id/decline - Decline a transfer
router.post('/:id/decline', async (req, res) => {
    try {
        const userId = req.user.id;
        const transferId = req.params.id;
        
        const transfer = await AnimalTransfer.findById(transferId);
        
        if (!transfer) {
            return res.status(404).json({ message: 'Transfer not found.' });
        }
        
        // Verify the user is the recipient
        if (transfer.toUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to decline this transfer.' });
        }
        
        if (transfer.status !== 'pending') {
            return res.status(400).json({ message: 'Transfer has already been responded to.' });
        }
        
        // Update transfer status
        transfer.status = 'declined';
        transfer.respondedAt = new Date();
        await transfer.save();
        
        // Update the original notification to declined status
        await Notification.updateOne(
            { transferId: transfer._id, userId: userId, type: 'transfer_request' },
            { $set: { status: 'declined' } }
        );
        
        // Create notification for the sender (informational only, no action needed)
        const animal = await Animal.findOne({ id_public: transfer.animalId_public });
        const senderProfile = await PublicProfile.findOne({ userId_backend: transfer.fromUserId });
        
        await Notification.create({
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
        });
        
        res.status(200).json({ 
            message: 'Transfer declined. The transaction remains in your budget as a local entry.', 
            transfer
        });
    } catch (error) {
        console.error('Error declining transfer:', error);
        res.status(500).json({ message: 'Internal server error while declining transfer.' });
    }
});

// POST /api/transfers/:id/accept-view-only - Accept view-only offer (for purchase transfers)
router.post('/:id/accept-view-only', async (req, res) => {
    try {
        const userId = req.user.id;
        const transferId = req.params.id;
        
        const transfer = await AnimalTransfer.findById(transferId);
        
        if (!transfer) {
            return res.status(404).json({ message: 'Transfer not found.' });
        }
        
        // For purchase transfers, the fromUserId is the buyer, toUserId is the seller
        // The seller (toUserId) can accept view-only access
        if (transfer.toUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to respond to this offer.' });
        }
        
        if (!transfer.offerViewOnly) {
            return res.status(400).json({ message: 'This transfer does not have a view-only offer.' });
        }
        
        // Find the animal
        const animal = await Animal.findOne({ id_public: transfer.animalId_public });
        
        if (!animal) {
            return res.status(404).json({ message: 'Animal not found.' });
        }
        
        // Add user to viewOnlyForUsers if not already there
        if (!animal.viewOnlyForUsers.includes(userId)) {
            animal.viewOnlyForUsers.push(userId);
            await animal.save();
        }
        
        // Update transfer
        transfer.status = 'accepted';
        transfer.respondedAt = new Date();
        await transfer.save();
        
        // Create notification for the buyer
        await Notification.create({
            userId: transfer.fromUserId,
            type: 'view_only_accepted',
            message: `Seller has accepted view-only access to ${animal.name} (${animal.id_public}).`,
            metadata: {
                transferId: transfer._id,
                animalId: animal.id_public,
                animalName: animal.name
            }
        });
        
        res.status(200).json({ 
            message: 'View-only access granted.', 
            transfer,
            animal: {
                id_public: animal.id_public,
                name: animal.name
            }
        });
    } catch (error) {
        console.error('Error accepting view-only:', error);
        res.status(500).json({ message: 'Internal server error while accepting view-only access.' });
    }
});

module.exports = router;
