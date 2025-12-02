const express = require('express');
const router = express.Router();
const { Notification, User, Animal } = require('../database/models');

// Get all notifications for the current user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        
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
        const count = await Notification.countDocuments({ userId, read: false, status: 'pending' });
        
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
        
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { read: true } },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        return res.status(200).json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({ message: 'Failed to update notification' });
    }
});

// Approve a notification (breeder or parent request)
router.post('/:notificationId/approve', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        const notification = await Notification.findOne({ _id: notificationId, userId });
        
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        
        if (notification.status !== 'pending') {
            return res.status(400).json({ message: 'Notification already processed' });
        }
        
        // Update notification status
        notification.status = 'approved';
        notification.read = true;
        await notification.save();
        
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
        
        if (animal) {
            // Remove the link based on notification type
            if (notification.type === 'breeder_request') {
                animal.breederId_public = null;
            } else if (notification.type === 'parent_request') {
                if (notification.parentType === 'sire') {
                    animal.sireId_public = null;
                    animal.fatherId_public = null;
                } else if (notification.parentType === 'dam') {
                    animal.damId_public = null;
                    animal.motherId_public = null;
                }
            }
            await animal.save();
            
            // Also update PublicAnimal if it exists
            const { PublicAnimal } = require('../database/models');
            const publicAnimal = await PublicAnimal.findOne({ id_public: notification.animalId_public });
            if (publicAnimal) {
                if (notification.type === 'breeder_request') {
                    publicAnimal.breederId_public = null;
                } else if (notification.type === 'parent_request') {
                    if (notification.parentType === 'sire') {
                        publicAnimal.sireId_public = null;
                    } else if (notification.parentType === 'dam') {
                        publicAnimal.damId_public = null;
                    }
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
                message: `Your ${notification.type === 'breeder_request' ? 'breeder' : 'parent'} request for ${notification.animalName} was not approved.`,
                read: false
            });
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
