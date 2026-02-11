const express = require('express');
const router = express.Router();
const { Message, MessageReport, User, PublicProfile } = require('../database/models');
const { assertCleanText, ProfanityError } = require('../utils/profanityFilter');

// Helper function to generate conversation ID (consistent ordering)
const getConversationId = (userId1, userId2) => {
    const ids = [userId1.toString(), userId2.toString()].sort();
    return `${ids[0]}_${ids[1]}`;
};

// POST /api/messages/send - Send a message
router.post('/send', async (req, res) => {
    try {
        const { receiverId, message, adminOverride = false, isModeratorMessage = false } = req.body;
        const senderId = req.user.id;

        if (!receiverId || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'receiverId and message are required' });
        }

        const normalizedMessage = message.trim();
        assertCleanText(normalizedMessage, 'message');

        if (senderId === receiverId) {
            return res.status(400).json({ error: 'Cannot send message to yourself' });
        }

        // Check if sender or receiver exists
        const [sender, receiver] = await Promise.all([
            User.findById(senderId),
            User.findById(receiverId)
        ]);

        if (!sender || !receiver) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Admin override: if sender is admin/moderator and adminOverride is true, bypass privacy settings
        const isAdminOrMod = sender.role === 'admin' || sender.role === 'moderator';
        const bypassPrivacy = adminOverride && isAdminOrMod;

        // Check if user is replying to an existing moderator conversation
        const conversationId = getConversationId(senderId, receiverId);
        const existingModMessages = await Message.findOne({
            conversationId,
            isModeratorMessage: true
        });
        const isReplyToModConversation = existingModMessages !== null;

        if (!bypassPrivacy && !isReplyToModConversation) {
            // Standard privacy checks (skip if replying to mod conversation)
            // Check if sender allows messages (prevent sending if disabled)
            if (!sender.allowMessages) {
                return res.status(403).json({ error: 'You have disabled messages. Enable messages to send them.' });
            }

            // Check if receiver allows messages
            if (!receiver.allowMessages) {
                return res.status(403).json({ error: 'This user has disabled messages' });
            }

            // Check if either user has blocked the other
            if (sender.blockedUsers.includes(receiverId) || receiver.blockedUsers.includes(senderId)) {
                return res.status(403).json({ error: 'Cannot send message to this user' });
            }
        }

        const conversationId = getConversationId(senderId, receiverId);

        // Prepare message data
        const messageData = {
            conversationId,
            senderId,
            receiverId,
            message: normalizedMessage,
            read: false
        };

        // If this is a moderator message, add tracking fields
        if (isModeratorMessage && isAdminOrMod) {
            messageData.isModeratorMessage = true;
            messageData.senderRole = sender.role;
            messageData.sentBy = sender.id_public; // Store sender's CTU for internal logging
            messageData.displayName = sender.role === 'admin' ? 'Admin' : 'Moderator'; // What users see
        }

        const newMessage = new Message(messageData);

        await newMessage.save();

        res.status(201).json({ 
            message: 'Message sent successfully',
            messageId: newMessage._id 
        });
    } catch (error) {
        console.error('Error sending message:', error);
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// GET /api/messages/resolve/:id_public - Resolve public ID to backend user ID
router.get('/resolve/:id_public', async (req, res) => {
    try {
        const { id_public } = req.params;
        if (!id_public) {
            return res.status(400).json({ error: 'id_public is required' });
        }
        const profile = await PublicProfile.findOne({ id_public }).select('userId_backend id_public').lean();
        if (!profile) {
            return res.status(404).json({ error: 'Public profile not found' });
        }
        return res.json({ userId: profile.userId_backend });
    } catch (error) {
        console.error('Error resolving public ID:', error);
        return res.status(500).json({ error: 'Failed to resolve public ID' });
    }
});

// GET /api/messages/conversations - Get list of conversations
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all messages where user is sender or receiver (excluding deleted)
        const messages = await Message.find({
            $or: [{ senderId: userId }, { receiverId: userId }],
            deletedBy: { $ne: userId }
        }).sort({ createdAt: -1 }).lean();

        if (!messages.length) {
            return res.json([]);
        }

        // Group by conversation and get latest message per conversation
        const conversationsMap = new Map();
        
        for (const msg of messages) {
            const otherUserId = msg.senderId.toString() === userId ? msg.receiverId.toString() : msg.senderId.toString();
            
            if (!conversationsMap.has(msg.conversationId)) {
                conversationsMap.set(msg.conversationId, {
                    conversationId: msg.conversationId,
                    otherUserId,
                    lastMessage: msg.message,
                    lastMessageDate: msg.createdAt,
                    unreadCount: 0
                });
            }

            // Count unread messages where current user is receiver
            if (msg.receiverId.toString() === userId && !msg.read) {
                conversationsMap.get(msg.conversationId).unreadCount++;
            }
        }

        const conversations = Array.from(conversationsMap.values());

        // Fetch user info for all conversation partners
        const otherUserIds = conversations.map(c => c.otherUserId);
        const users = await User.find({ _id: { $in: otherUserIds } }).select('id_public personalName breederName profileImage showPersonalName showBreederName allowMessages role').lean();
        
        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Attach user info to each conversation
        const conversationsWithUserInfo = conversations.map(conv => {
            const otherUser = userMap.get(conv.otherUserId);
            
            // Check if this conversation has moderator messages
            const hasModMessages = messages.some(m => 
                m.conversationId === conv.conversationId && m.isModeratorMessage
            );
            
            // If other user is staff and this has mod messages, display as "Admin" or "Moderator"
            if (otherUser && hasModMessages && (otherUser.role === 'admin' || otherUser.role === 'moderator')) {
                return {
                    ...conv,
                    otherUser: {
                        ...otherUser,
                        displayName: otherUser.role === 'admin' ? 'Admin' : 'Moderator',
                        isStaff: true
                    }
                };
            }
            
            return {
                ...conv,
                otherUser: otherUser || null
            };
        });

        res.json(conversationsWithUserInfo);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// GET /api/messages/conversation/:otherUserId - Get messages in a conversation
router.get('/conversation/:otherUserId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;

        if (userId === otherUserId) {
            return res.status(400).json({ error: 'Invalid conversation' });
        }

        const conversationId = getConversationId(userId, otherUserId);

        // Fetch messages
        const messages = await Message.find({
            conversationId,
            deletedBy: { $ne: userId }
        }).sort({ createdAt: 1 }).lean();

        // Mark received messages as read
        await Message.updateMany({
            conversationId,
            receiverId: userId,
            read: false
        }, { read: true });

        // Get other user info
        const otherUser = await User.findById(otherUserId).select('id_public personalName breederName profileImage showPersonalName showBreederName allowMessages role').lean();

        // Check if this conversation has moderator messages
        const hasModMessages = messages.some(m => m.isModeratorMessage);
        
        // If conversation has mod messages and other user is staff, show display name
        let otherUserDisplay = otherUser;
        if (otherUser && hasModMessages && (otherUser.role === 'admin' || otherUser.role === 'moderator')) {
            otherUserDisplay = {
                ...otherUser,
                displayName: otherUser.role === 'admin' ? 'Admin' : 'Moderator',
                isStaff: true
            };
        }

        res.json({
            messages,
            otherUser: otherUserDisplay
        });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

// DELETE /api/messages/:messageId - Delete a message (hide from user's view)
router.delete('/:messageId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only sender or receiver can delete
        if (message.senderId.toString() !== userId && message.receiverId.toString() !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Add user to deletedBy array (soft delete)
        await Message.findByIdAndUpdate(messageId, {
            $addToSet: { deletedBy: userId }
        });

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// DELETE /api/messages/conversation/:otherUserId - Delete entire conversation
router.delete('/conversation/:otherUserId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;

        const conversationId = getConversationId(userId, otherUserId);

        // Add user to deletedBy for all messages in conversation
        await Message.updateMany({
            conversationId
        }, {
            $addToSet: { deletedBy: userId }
        });

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// POST /api/messages/block/:userId - Block a user
router.post('/block/:userId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { userId } = req.params;

        if (currentUserId === userId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        await User.findByIdAndUpdate(currentUserId, {
            $addToSet: { blockedUsers: userId }
        });

        res.json({ message: 'User blocked successfully' });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
});

// POST /api/messages/unblock/:userId - Unblock a user
router.post('/unblock/:userId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { userId } = req.params;

        await User.findByIdAndUpdate(currentUserId, {
            $pull: { blockedUsers: userId }
        });

        res.json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
});

// GET /api/messages/blocked - Get list of blocked users
router.get('/blocked', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId).select('blockedUsers').lean();
        const blockedUserIds = user.blockedUsers || [];

        if (!blockedUserIds.length) {
            return res.json([]);
        }

        const blockedUsers = await User.find({ _id: { $in: blockedUserIds } })
            .select('id_public personalName breederName profileImage showPersonalName showBreederName')
            .lean();

        res.json(blockedUsers);
    } catch (error) {
        console.error('Error fetching blocked users:', error);
        res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
});

// This endpoint is being moved to /api/reports/message
// The logic will be handled in reportRoutes.js to centralize all reporting functionality.
// POST /api/messages/report - Report a message
// router.post('/report', async (req, res) => {
//     try {
//         const reporterId = req.user.id;
//         const { messageId, reportedUserId, reason } = req.body;

//         if (!messageId || !reportedUserId || !reason) {
//             return res.status(400).json({ error: 'messageId, reportedUserId, and reason are required' });
//         }

//         const message = await Message.findById(messageId);
//         if (!message) {
//             return res.status(404).json({ error: 'Message not found' });
//         }

//         // Verify reporter is part of the conversation
//         if (message.senderId.toString() !== reporterId && message.receiverId.toString() !== reporterId) {
//             return res.status(403).json({ error: 'Not authorized' });
//         }

//         const report = new MessageReport({
//             reporterId,
//             reportedUserId,
//             messageId,
//             reason: reason.trim()
//         });

//         await report.save();

//         res.status(201).json({ message: 'Report submitted successfully' });
//     } catch (error) {
//         console.error('Error reporting message:', error);
//         res.status(500).json({ error: 'Failed to submit report' });
//     }
// });

// GET /api/messages/unread-count - Get count of unread messages
router.get('/unread-count', async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await Message.countDocuments({
            receiverId: userId,
            read: false,
            deletedBy: { $ne: userId }
        });

        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

module.exports = router;
