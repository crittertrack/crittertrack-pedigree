const express = require('express');
const router = express.Router();
const { User, PublicProfile, Message } = require('../database/models');

// Admin endpoint to migrate public profiles
// OPTIMIZED: Batch loads users instead of 1 query per profile (1000→1 query)
// GET /api/admin/migrate-public-profiles
router.get('/migrate-public-profiles', async (req, res) => {
    try {
        // Get all public profiles
        const publicProfiles = await PublicProfile.find({});
        console.log(`Found ${publicProfiles.length} public profiles to migrate`);

        // BATCH LOAD: Get all users in one query
        const userIds = publicProfiles.map(p => p.userId_backend).filter(Boolean);
        const users = await User.find({ _id: { $in: userIds } })
            .select('_id personalName showBreederName breederName')
            .lean();

        // Index users by _id for O(1) lookup
        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        let updated = 0;
        let failed = 0;
        const results = [];

        // Process all profiles with preloaded user data
        for (const profile of publicProfiles) {
            try {
                const user = userMap.get(profile.userId_backend.toString());
                
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
// OPTIMIZED: Batch loads all users once instead of per message (200→10 queries for 100 msgs)
router.get('/moderator-conversations', async (req, res) => {
    try {
        // First, find all conversations that contain moderator messages
        const modMessages = await Message.find({
            isModeratorMessage: true
        }).distinct('conversationId');

        if (!modMessages.length) {
            return res.json({ conversations: [] });
        }

        // Now get ALL messages from those conversations to include user replies
        const allMessages = await Message.find({
            conversationId: { $in: modMessages }
        }).sort({ createdAt: -1 }).lean();

        // BATCH LOAD: Collect all unique user IDs and fetch them all at once
        const allUserIds = new Set();
        for (const msg of allMessages) {
            if (msg.senderId) allUserIds.add(msg.senderId.toString());
            if (msg.receiverId) allUserIds.add(msg.receiverId.toString());
        }

        const users = await User.find({ _id: { $in: Array.from(allUserIds) } })
            .select('_id role id_public personalName breederName showPersonalName showBreederName')
            .lean();

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Group by conversation using preloaded user data
        const conversationsMap = new Map();
        
        for (const msg of allMessages) {
            if (!conversationsMap.has(msg.conversationId)) {
                // Use preloaded user data instead of querying database
                const senderUser = userMap.get(msg.senderId?.toString());
                const receiverUser = userMap.get(msg.receiverId?.toString());
                
                // Determine which user is the regular user (not staff)
                let otherUserId;
                if (senderUser && (senderUser.role === 'admin' || senderUser.role === 'moderator')) {
                    otherUserId = msg.receiverId;
                } else if (receiverUser && (receiverUser.role === 'admin' || receiverUser.role === 'moderator')) {
                    otherUserId = msg.senderId;
                } else {
                    // Fallback: use sender if we can't determine staff role
                    otherUserId = msg.senderId;
                }
                
                conversationsMap.set(msg.conversationId, {
                    _id: msg.conversationId,
                    conversationId: msg.conversationId,
                    otherUserId: otherUserId.toString(),
                    lastMessage: msg.message,
                    lastMessageAt: msg.createdAt,
                    messageCount: 0,
                    unreadByUser: 0,      // mod-sent messages not yet read by user
                    lastSenderIsUser: false, // whether the latest message was from the user
                    initiatedBy: null // Will be set from first message
                });
            }
            
            const conversation = conversationsMap.get(msg.conversationId);
            conversation.messageCount++;

            // Count mod-sent messages the user hasn't read yet
            if (msg.isModeratorMessage && !msg.read) {
                conversation.unreadByUser++;
            }
            
            // Update to the most recent message (allMessages is sorted by createdAt desc)
            if (!conversation.lastMessageUpdated) {
                conversation.lastMessage = msg.message;
                conversation.lastMessageAt = msg.createdAt;
                conversation.lastMessageUpdated = true;
                // Not a moderator message = sent by the regular user
                conversation.lastSenderIsUser = !msg.isModeratorMessage;
            }
            
            // Set initiatedBy from moderator messages
            if (msg.isModeratorMessage && msg.sentBy && !conversation.initiatedBy) {
                conversation.initiatedBy = msg.sentBy;
            }
        }

        const conversations = Array.from(conversationsMap.values());

        // Use preloaded user data for final info
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
