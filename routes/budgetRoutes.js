const express = require('express');
const router = express.Router();
const { Transaction, AnimalTransfer, Animal, Notification, User, PublicProfile } = require('../database/models');

// Middleware to verify authentication is assumed to be applied at the app level
// req.user.id should contain the authenticated user's MongoDB ObjectId

// GET /api/budget/transactions - Get all transactions for the logged-in user
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const transactions = await Transaction.find({ userId })
            .sort({ date: -1 })
            .lean();
        
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Internal server error while fetching transactions.' });
    }
});

// POST /api/budget/transactions - Create a new transaction
router.post('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[Budget] === NEW TRANSACTION REQUEST ===');
        console.log('[Budget] User ID:', userId);
        console.log('[Budget] Request body:', JSON.stringify(req.body, null, 2));
        
        const { type, animalId, animalName, price, date, buyer, seller, notes, buyerUserId, sellerUserId } = req.body;
        
        console.log('[Budget] Extracted values:', { type, animalId, animalName, buyerUserId, sellerUserId });
        
        // Validation
        if (!type || !['sale', 'purchase'].includes(type)) {
            return res.status(400).json({ message: 'Invalid transaction type. Must be "sale" or "purchase".' });
        }
        
        if (price === undefined || price === null || price === '' || isNaN(price) || parseFloat(price) < 0) {
            return res.status(400).json({ message: 'Invalid price. Must be 0 or greater.' });
        }
        
        if (!date) {
            return res.status(400).json({ message: 'Date is required.' });
        }
        
        const newTransaction = new Transaction({
            userId,
            type,
            animalId: animalId || null,
            animalName: animalName || null,
            price: parseFloat(price),
            date: new Date(date),
            buyer: type === 'sale' ? (buyer || null) : null,
            seller: type === 'purchase' ? (seller || null) : null,
            buyerUserId: buyerUserId || null,
            sellerUserId: sellerUserId || null,
            notes: notes || null
        });
        
        await newTransaction.save();
        console.log('[Budget] Transaction saved with ID:', newTransaction._id);
        
        // Check if this should create a transfer
        let transfer = null;
        
        console.log('[Budget] Checking transfer conditions:', { 
            type, 
            buyerUserId, 
            animalId, 
            userId,
            typeCheck: type === 'sale',
            buyerCheck: !!buyerUserId,
            animalCheck: !!animalId,
            allCheck: type === 'sale' && buyerUserId && animalId
        });
        
        // SALE with existing user (buyer) and existing animal
        if (type === 'sale' && buyerUserId && animalId) {
            console.log('[Budget] ✓ Conditions met for sale transfer, looking for animal...');
            console.log('[Budget] Searching for animal with id_public:', animalId, 'and ownerId:', userId);
            
            // Verify the animal exists and belongs to the seller
            const animal = await Animal.findOne({ id_public: animalId, ownerId: userId });
            
            console.log('[Budget] Animal lookup result:', animal ? {
                found: true,
                id_public: animal.id_public,
                name: animal.name,
                ownerId: animal.ownerId,
                ownerIdMatches: String(animal.ownerId) === String(userId),
                soldStatus: animal.soldStatus
            } : { found: false });
            
            if (!animal) {
                console.log('[Budget] ✗ Animal not found, skipping transfer creation');
            } else if (animal.soldStatus === 'sold') {
                console.log('[Budget] ✗ Animal already sold, cannot sell again');
                return res.status(400).json({ 
                    message: `Cannot sell ${animal.name} - this animal has already been sold. You can only view it.` 
                });
            } else {
                console.log('[Budget] ✓ Creating transfer...');
                // Create pending transfer
                transfer = await AnimalTransfer.create({
                    fromUserId: userId,
                    toUserId: buyerUserId,
                    animalId_public: animalId,
                    transactionId: newTransaction._id,
                    transferType: 'sale',
                    status: 'pending'
                });
                
                console.log('[Budget] ✓ Transfer created with ID:', transfer._id);
                
                // Create notification for buyer
                try {
                    console.log('[Budget] Looking up buyer profile for userId:', buyerUserId);
                    const buyerProfile = await PublicProfile.findOne({ userId_backend: buyerUserId });
                    console.log('[Budget] Buyer profile found:', buyerProfile ? buyerProfile.id_public : 'NOT FOUND');
                    
                    // Get seller (requestedBy) profile and name
                    console.log('[Budget] Looking up seller profile for userId:', userId);
                    const sellerProfile = await PublicProfile.findOne({ userId_backend: userId });
                    const sellerName = sellerProfile?.breederName || sellerProfile?.personalName || '';
                    console.log('[Budget] Seller profile found:', sellerProfile ? sellerProfile.id_public : 'NOT FOUND', 'Name:', sellerName);
                    
                    console.log('[Budget] Creating notification for buyer...');
                    const notificationData = {
                        userId: buyerUserId,
                        userId_public: buyerProfile?.id_public || '',
                        type: 'transfer_request',
                        status: 'pending',
                        requestedBy_id: userId,
                        requestedBy_public: sellerProfile?.id_public || '',
                        requestedBy_name: sellerName,
                        animalId_public: animal.id_public,
                        animalName: animal.name,
                        animalImageUrl: animal.imageUrl || '',
                        transferId: transfer._id,
                        message: `${sellerName} has sent you an animal transfer request for ${animal.name} (${animal.id_public}).`,
                        metadata: {
                            transferId: transfer._id,
                            animalId: animal.id_public,
                            animalName: animal.name,
                            fromUserId: userId
                        }
                    };
                    console.log('[Budget] Notification data:', JSON.stringify(notificationData, null, 2));
                    
                    const notification = await Notification.create(notificationData);
                    console.log('[Budget] ✓ Notification created with ID:', notification._id);
                } catch (notifError) {
                    console.error('[Budget] ✗ Error creating notification:', notifError);
                    console.error('[Budget] Notification error details:', notifError.message);
                }
            }
        } else {
            console.log('[Budget] ✗ Transfer conditions not met');
        }
        
        // PURCHASE with existing user (seller) and existing animal
        if (type === 'purchase' && sellerUserId && animalId) {
            console.log('[Budget] ✓ Conditions met for purchase with view-only offer');
            console.log('[Budget] Searching for animal with id_public:', animalId, 'owned by buyer:', userId);
            
            // Check if the animal exists and is owned by the BUYER (current user)
            const animal = await Animal.findOne({ id_public: animalId, ownerId: userId });
            
            console.log('[Budget] Animal lookup result:', animal ? {
                found: true,
                id_public: animal.id_public,
                name: animal.name,
                ownerId: animal.ownerId,
                ownerIdMatches: String(animal.ownerId) === String(userId),
                soldStatus: animal.soldStatus
            } : { found: false });
            
            if (!animal) {
                console.log('[Budget] ✗ Animal not found or not owned by buyer, skipping view-only offer');
            } else if (animal.soldStatus === 'purchased') {
                console.log('[Budget] ✗ Animal already marked as purchased, cannot create duplicate view-only offer');
                return res.status(400).json({ 
                    message: `${animal.name} is already marked as purchased. Cannot create duplicate purchase record.` 
                });
            } else {
                console.log('[Budget] ✓ Creating transfer with view-only offer...');
                // Create transfer with view-only offer
                transfer = await AnimalTransfer.create({
                    fromUserId: userId, // buyer (current owner)
                    toUserId: sellerUserId, // seller/breeder (will get view-only)
                    animalId_public: animalId,
                    transactionId: newTransaction._id,
                    transferType: 'purchase',
                    status: 'pending',
                    offerViewOnly: true
                });
                
                console.log('[Budget] ✓ Transfer created with ID:', transfer._id);
                
                // Create notification for seller/breeder
                try {
                    console.log('[Budget] Looking up seller/breeder profile for userId:', sellerUserId);
                    const sellerProfile = await PublicProfile.findOne({ userId_backend: sellerUserId });
                    console.log('[Budget] Seller profile found:', sellerProfile ? sellerProfile.id_public : 'NOT FOUND');
                    
                    // Get buyer profile for requestedBy fields
                    console.log('[Budget] Looking up buyer profile for userId:', userId);
                    const buyerProfile = await PublicProfile.findOne({ userId_backend: userId });
                    const buyerName = buyerProfile?.breederName || buyerProfile?.personalName || '';
                    console.log('[Budget] Buyer profile found:', buyerProfile ? buyerProfile.id_public : 'NOT FOUND', 'Name:', buyerName);
                    
                    console.log('[Budget] Creating view-only notification for seller/breeder...');
                    const notificationData = {
                        userId: sellerUserId,
                        userId_public: sellerProfile?.id_public || '',
                        type: 'view_only_offer',
                        status: 'pending',
                        requestedBy_id: userId,
                        requestedBy_public: buyerProfile?.id_public || '',
                        requestedBy_name: buyerName,
                        animalId_public: animal.id_public,
                        animalName: animal.name,
                        animalImageUrl: animal.imageUrl || '',
                        transferId: transfer._id,
                        message: `${buyerName} has logged a purchase of your animal ${animal.name} (${animal.id_public}). Would you like view-only access?`,
                        metadata: {
                            transferId: transfer._id,
                            animalId: animal.id_public,
                            animalName: animal.name,
                            fromUserId: userId
                        }
                    };
                    console.log('[Budget] Notification data:', JSON.stringify(notificationData, null, 2));
                    
                    const notification = await Notification.create(notificationData);
                    console.log('[Budget] ✓ Notification created with ID:', notification._id);
                } catch (notifError) {
                    console.error('[Budget] ✗ Error creating notification:', notifError);
                    console.error('[Budget] Notification error details:', notifError.message);
                }
            }
        }
        
        res.status(201).json({ 
            transaction: newTransaction,
            transfer: transfer || null
        });
    } catch (error) {
        console.error('[Budget] ✗ Error creating transaction:', error);
        console.error('[Budget] Error stack:', error.stack);
        console.error('[Budget] Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });
        res.status(500).json({ 
            message: 'Failed to save transaction.',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// PUT /api/budget/transactions/:id - Update a transaction
router.put('/transactions/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const transactionId = req.params.id;
        const { type, animalId, animalName, price, date, buyer, seller, notes } = req.body;
        
        // Find the transaction and verify ownership
        const transaction = await Transaction.findOne({ _id: transactionId, userId });
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or access denied.' });
        }
        
        // Validation
        if (type && !['sale', 'purchase'].includes(type)) {
            return res.status(400).json({ message: 'Invalid transaction type. Must be "sale" or "purchase".' });
        }
        
        if (price !== undefined && (isNaN(price) || parseFloat(price) < 0)) {
            return res.status(400).json({ message: 'Invalid price. Must be 0 or greater.' });
        }
        
        // Update fields
        if (type) transaction.type = type;
        if (animalId !== undefined) transaction.animalId = animalId || null;
        if (animalName !== undefined) transaction.animalName = animalName || null;
        if (price !== undefined) transaction.price = parseFloat(price);
        if (date) transaction.date = new Date(date);
        if (buyer !== undefined) transaction.buyer = transaction.type === 'sale' ? (buyer || null) : null;
        if (seller !== undefined) transaction.seller = transaction.type === 'purchase' ? (seller || null) : null;
        if (notes !== undefined) transaction.notes = notes || null;
        
        await transaction.save();
        
        res.status(200).json(transaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ message: 'Internal server error while updating transaction.' });
    }
});

// DELETE /api/budget/transactions/:id - Delete a transaction
router.delete('/transactions/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const transactionId = req.params.id;
        
        // Find the transaction first to check for linked transfers
        const transaction = await Transaction.findOne({ _id: transactionId, userId });
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or access denied.' });
        }
        
        // Check if there's an accepted transfer linked to this transaction
        const acceptedTransfer = await AnimalTransfer.findOne({ 
            transactionId: transactionId,
            status: 'accepted'
        });
        
        // Delete the transaction (but keep the ownership changes if transfer was accepted)
        await Transaction.findByIdAndDelete(transactionId);
        
        const message = acceptedTransfer 
            ? 'Transaction deleted. Animal ownership changes remain intact.'
            : 'Transaction deleted successfully.';
        
        res.status(200).json({ message });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ message: 'Internal server error while deleting transaction.' });
    }
});

// GET /api/budget/stats - Get budget statistics
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const transactions = await Transaction.find({ userId }).lean();
        
        const stats = transactions.reduce((acc, transaction) => {
            if (transaction.type === 'sale') {
                acc.totalSales += transaction.price;
                acc.salesCount++;
            } else {
                acc.totalPurchases += transaction.price;
                acc.purchasesCount++;
            }
            return acc;
        }, { totalSales: 0, totalPurchases: 0, salesCount: 0, purchasesCount: 0 });
        
        stats.netProfit = stats.totalSales - stats.totalPurchases;
        stats.averageSale = stats.salesCount > 0 ? stats.totalSales / stats.salesCount : 0;
        stats.averagePurchase = stats.purchasesCount > 0 ? stats.totalPurchases / stats.purchasesCount : 0;
        
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching budget stats:', error);
        res.status(500).json({ message: 'Internal server error while fetching statistics.' });
    }
});

module.exports = router;
