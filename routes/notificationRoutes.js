const express = require('express');
const router = express.Router();
const { Notification, User, Animal, Litter, PublicAnimal } = require('../database/models');
const { syncParentReproStatus } = require('../utils/reproStatusSync');

// Get all notifications for the current user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        
        const sendAtFilter = {
            $or: [
                { isPending: { $ne: true } },
                { sendAt: { $lte: now } },
            ]
        };

        // Broadcasts/announcements are always fetched without a count limit so they
        // never get pushed off the list by high volumes of regular notifications.
        const broadcasts = await Notification.find({
            userId,
            type: { $in: ['broadcast', 'announcement'] },
            ...sendAtFilter,
        }).sort({ createdAt: -1 }).lean();

        // All other notification types — capped at 50 most recent
        const others = await Notification.find({
            userId,
            type: { $nin: ['broadcast', 'announcement'] },
            ...sendAtFilter,
        }).sort({ createdAt: -1 }).limit(50).lean();

        // Merge and re-sort by newest first
        const notifications = [...broadcasts, ...others].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return res.status(200).json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// Get unread notification count
router.get('/unread-count', async (req, res) => {
    try {
        const userId = req.user.id;
        // Exclude broadcast/announcement types from the count - they show separately
        const count = await Notification.countDocuments({ 
            userId, 
            read: false, 
            status: 'pending',
            type: { $nin: ['broadcast', 'announcement', 'moderator_message'] }
        });
        
        return res.status(200).json({ count });
    } catch (error) {
        console.error('Error counting unread notifications:', error);
        return res.status(500).json({ message: 'Failed to count notifications' });
    }
});

// Mark notification as read
router.patch('/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        console.log('[Mark as Read] NotificationId:', notificationId, 'UserId:', userId);
        
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { read: true } },
            { new: true }
        );
        
        console.log('[Mark as Read] Found notification:', notification ? 'YES' : 'NO');
        
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        return res.status(200).json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({ message: 'Failed to update notification' });
    }
});

// Approve a notification (breeder or parent request) — the link was already applied
// optimistically when the request was created, so approving just confirms it and lets
// the requester know.
router.post('/:notificationId/approve', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        const userPublicId = req.user.id_public;

        const notification = await Notification.findOne({ _id: notificationId, userId });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.status !== 'pending') {
            return res.status(400).json({ message: 'Notification already processed' });
        }

        notification.status = 'approved';
        notification.read = true;
        await notification.save();

        if (notification.type === 'breeder_request' || notification.type === 'owner_request' || notification.type === 'parent_request') {
            await Notification.create({
                userId: notification.requestedBy_id,
                userId_public: notification.requestedBy_public,
                type: notification.type,
                status: 'approved',
                requestedBy_id: userId,
                requestedBy_public: userPublicId,
                animalId_public: notification.animalId_public,
                animalName: notification.animalName,
                parentType: notification.parentType,
                targetAnimalId_public: notification.targetAnimalId_public,
                // Wording matters here: the link was already applied when the request was sent,
                // not just now — "approved" would wrongly imply it only just took effect.
                message: `Your ${notification.type === 'breeder_request' ? 'breeder' : notification.type === 'owner_request' ? 'owner' : notification.parentType} request for ${notification.animalName} was acknowledged.`,
                read: false
            });
        }

        return res.status(200).json({ message: 'Request approved', notification });
    } catch (error) {
        console.error('Error approving notification:', error);
        return res.status(500).json({ message: 'Failed to approve notification' });
    }
});

// Reject a notification (remove breeder/parent link and notify requester)
router.post('/:notificationId/reject', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        const userPublicId = req.user.id_public;
        
        const notification = await Notification.findOne({ _id: notificationId, userId });
        
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        if (notification.status !== 'pending') {
            return res.status(400).json({ message: 'Notification already processed' });
        }
        
        // Find the animal that made the request and remove the linkage
        // NOTE: The linkage was saved immediately when the user created/updated their animal.
        // We only remove it here when the breeder/parent owner explicitly rejects the request.
        const animal = await Animal.findOne({ id_public: notification.animalId_public });
        
        if (animal && (notification.type === 'breeder_request' || notification.type === 'owner_request' || notification.type === 'parent_request')) {
            // Remove the link based on notification type
            if (notification.type === 'breeder_request') {
                animal.breederId_public = null;
            } else if (notification.type === 'owner_request') {
                animal.ownerId_public = null;
            } else if (notification.type === 'parent_request') {
                if (notification.parentType === 'sire') {
                    animal.sireId_public = null;
                } else if (notification.parentType === 'dam') {
                    animal.damId_public = null;
                }
                // Clearing a parent link invalidates any auto-matched litter link and the
                // cached inbreeding coefficient, mirroring the cleanup updateAnimal() performs
                // when parents change through the normal edit form (see db_service.js).
                if (animal.litterId) animal.litterId = null;
                animal.inbreedingCoefficient = null;
            }
            await animal.save();
            
            // Also update PublicAnimal if it exists
            const { PublicAnimal } = require('../database/models');
            const publicAnimal = await PublicAnimal.findOne({ id_public: notification.animalId_public });
            if (publicAnimal) {
                if (notification.type === 'breeder_request') {
                    publicAnimal.breederId_public = null;
                } else if (notification.type === 'owner_request') {
                    publicAnimal.ownerId_public = null;
                } else if (notification.type === 'parent_request') {
                    if (notification.parentType === 'sire') {
                        publicAnimal.sireId_public = null;
                    } else if (notification.parentType === 'dam') {
                        publicAnimal.damId_public = null;
                    }
                    publicAnimal.inbreedingCoefficient = null;
                }
                await publicAnimal.save();
            }
            
            // Create a notification for the requester
            await Notification.create({
                userId: notification.requestedBy_id,
                userId_public: notification.requestedBy_public,
                type: notification.type,
                status: 'rejected',
                requestedBy_id: userId,
                requestedBy_public: userPublicId,
                animalId_public: notification.animalId_public,
                animalName: notification.animalName,
                parentType: notification.parentType,
                targetAnimalId_public: notification.targetAnimalId_public,
                message: `Your ${notification.type === 'breeder_request' ? 'breeder' : notification.type === 'owner_request' ? 'owner' : notification.parentType} request for ${notification.animalName} was rejected and the link was removed.`,
                read: false
            });
        } else if (notification.type === 'litter_assignment') {
            // Owner is rejecting having their animal used as a sire/dam in someone else's litter —
            // clear the assignment on the Litter itself (the animal record has no link to clear).
            const litterId_public = notification.metadata?.litterId_public;
            const role = notification.parentType;

            if (litterId_public && role) {
                const litter = await Litter.findOne({ litter_id_public: litterId_public });
                if (litter) {
                    if (role === 'sire' && litter.sireId_public === notification.animalId_public) {
                        litter.sireId_public = null;
                        litter.sirePrefixName = null;
                    } else if (role === 'dam' && litter.damId_public === notification.animalId_public) {
                        litter.damId_public = null;
                        litter.damPrefixName = null;
                    }
                    litter.inbreedingCoefficient = null;
                    await litter.save();

                    // Offspring already registered under this litter may have independently copied
                    // this animal onto their own sireId_public/damId_public (that's a separate field
                    // from the Litter's, populated when each offspring is created) — clear those too so
                    // the animal actually disappears from those offspring's Pedigree tabs, not just the
                    // Litter record.
                    const offspringIds = litter.offspringIds_public || [];
                    if (offspringIds.length) {
                        const query = role === 'sire'
                            ? { id_public: { $in: offspringIds }, sireId_public: notification.animalId_public }
                            : { id_public: { $in: offspringIds }, damId_public: notification.animalId_public };
                        const animalUnset = role === 'sire'
                            ? { sireId_public: null, inbreedingCoefficient: null }
                            : { damId_public: null, inbreedingCoefficient: null };
                        const publicUnset = role === 'sire'
                            ? { sireId_public: null, inbreedingCoefficient: null }
                            : { damId_public: null, inbreedingCoefficient: null };
                        await Animal.updateMany(query, { $set: animalUnset });
                        await PublicAnimal.updateMany(query, { $set: publicUnset });

                        // Auto-resolve any still-pending parent_request notifications for those same
                        // offspring links so they don't linger as stale duplicates of what we just did.
                        await Notification.updateMany(
                            {
                                userId,
                                type: 'parent_request',
                                status: 'pending',
                                animalId_public: { $in: offspringIds },
                                targetAnimalId_public: notification.animalId_public,
                                parentType: role,
                            },
                            { $set: { status: 'rejected', read: true } }
                        );
                    }
                }

                try {
                    await syncParentReproStatus(userId, [notification.animalId_public]);
                } catch (syncErr) {
                    console.error('Warning: failed to sync reproductive status after litter unassignment:', syncErr);
                }

                if (notification.requestedBy_id) {
                    await Notification.create({
                        userId: notification.requestedBy_id,
                        userId_public: notification.requestedBy_public,
                        type: 'litter_assignment',
                        status: 'rejected',
                        animalId_public: notification.animalId_public,
                        animalName: notification.animalName,
                        parentType: role,
                        message: `${notification.animalName} (${notification.animalId_public}) was removed as the ${role} of litter ${litterId_public} by its owner.`,
                        metadata: { litterId_public, role },
                        read: false
                    });
                }
            }
        }
        
        // Update original notification
        notification.status = 'rejected';
        notification.read = true;
        await notification.save();
        
        return res.status(200).json({ message: 'Request rejected and link removed', notification });
    } catch (error) {
        console.error('Error rejecting notification:', error);
        return res.status(500).json({ message: 'Failed to reject notification' });
    }
});

// Delete a notification
router.delete('/:notificationId', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        const result = await Notification.deleteOne({ _id: notificationId, userId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        return res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({ message: 'Failed to delete notification' });
    }
});

module.exports = router;
