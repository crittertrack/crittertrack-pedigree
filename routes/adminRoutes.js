const express = require('express');
const router = express.Router();
const { User, PublicProfile, Message } = require('../database/models');

// Admin endpoint to migrate public profiles
// GET /api/admin/migrate-public-profiles
router.get('/migrate-public-profiles', async (req, res) => {
    try {
        // Get all public profiles
        const publicProfiles = await PublicProfile.find({});
        console.log(`Found ${publicProfiles.length} public profiles to migrate`);

        let updated = 0;
        let failed = 0;
        const results = [];

        for (const profile of publicProfiles) {
            try {
                // Get corresponding user
                const user = await User.findById(profile.userId_backend);
                
                if (!user) {
                    results.push({ id_public: profile.id_public, status: 'failed', reason: 'User not found' });
                    failed++;
                    continue;
                }

                // Update the public profile with missing fields
                await PublicProfile.updateOne(
                    { _id: profile._id },
                    {
                        personalName: user.personalName,
                        showBreederName: user.showBreederName || false,
                        breederName: user.breederName || null
                    }
                );

                results.push({ 
                    id_public: profile.id_public, 
                    status: 'success',
                    personalName: user.personalName,
                    breederName: user.breederName,
                    showBreederName: user.showBreederName
                });
                updated++;
            } catch (error) {
                results.push({ id_public: profile.id_public, status: 'failed', reason: error.message });
                failed++;
            }
        }

        res.status(200).json({
            message: 'Migration complete',
            total: publicProfiles.length,
            updated,
            failed,
            results
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ message: 'Migration failed', error: error.message });
    }
});

// GET /api/admin/moderator-conversations - Get all conversations initiated by moderators
router.get('/moderator-conversations', async (req, res) => {
    try {
        // Find all moderator messages
        const modMessages = await Message.find({
            isModeratorMessage: true
        }).sort({ createdAt: -1 }).lean();

        if (!modMessages.length) {
            return res.json({ conversations: [] });
        }

        // Group by conversation
        const conversationsMap = new Map();
        
        for (const msg of modMessages) {
            if (!conversationsMap.has(msg.conversationId)) {
                // Get the other user ID (the one who isn't staff)
                const modUser = await User.findById(msg.senderId).select('role id_public').lean();
                const isStaff = modUser && (modUser.role === 'admin' || modUser.role === 'moderator');
                const otherUserId = isStaff ? msg.receiverId : msg.senderId;
                
                conversationsMap.set(msg.conversationId, {
                    _id: msg.conversationId,
                    conversationId: msg.conversationId,
                    otherUserId: otherUserId.toString(),
                    lastMessage: msg.message,
                    lastMessageAt: msg.createdAt,
                    messageCount: 0,
                    initiatedBy: null // Will be set from first message
                });
            }
            
            conversationsMap.get(msg.conversationId).messageCount++;
            
            // Set initiatedBy from the first mod message in the conversation
            if (msg.sentBy && !conversationsMap.get(msg.conversationId).initiatedBy) {
                conversationsMap.get(msg.conversationId).initiatedBy = msg.sentBy;
            }
        }

        const conversations = Array.from(conversationsMap.values());

        // Fetch user info for all conversation partners
        const otherUserIds = conversations.map(c => c.otherUserId);
        const users = await User.find({ _id: { $in: otherUserIds } })
            .select('id_public personalName breederName showPersonalName showBreederName')
            .lean();
        
        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Attach user info to each conversation
        const conversationsWithUserInfo = conversations.map(conv => ({
            ...conv,
            otherUser: userMap.get(conv.otherUserId) || null
        }));

        res.json({ conversations: conversationsWithUserInfo });
    } catch (error) {
        console.error('Error fetching moderator conversations:', error);
        res.status(500).json({ error: 'Failed to fetch moderator conversations' });
    }
});

// DELETE /api/admin/close-conversation/:userId - Close (delete) a conversation
router.delete('/close-conversation/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.user.id;

        // Get the conversation ID
        const conversationId = [adminId, userId].sort().join('_');

        // Delete all messages in this conversation
        const result = await Message.deleteMany({ conversationId });

        res.json({ 
            message: 'Conversation closed successfully',
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Error closing conversation:', error);
        res.status(500).json({ error: 'Failed to close conversation' });
    }
});

module.exports = router;
