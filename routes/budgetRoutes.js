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
        const { type, animalId, animalName, price, date, buyer, seller, notes, buyerUserId, sellerUserId } = req.body;
        
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
        
        // Check if this should create a transfer
        let transfer = null;
        
        // SALE with existing user (buyer) and existing animal
        if (type === 'sale' && buyerUserId && animalId) {
            // Verify the animal exists and belongs to the seller
            const animal = await Animal.findOne({ id_public: animalId, ownerId: userId });
            
            if (animal) {
                // Create pending transfer
                transfer = await AnimalTransfer.create({
                    fromUserId: userId,
                    toUserId: buyerUserId,
                    animalId_public: animalId,
                    transactionId: newTransaction._id,
                    transferType: 'sale',
                    status: 'pending'
                });
                
                // Create notification for buyer
                const buyerProfile = await PublicProfile.findOne({ userId_backend: buyerUserId });
                await Notification.create({
                    userId: buyerUserId,
                    userId_public: buyerProfile?.id_public || '',
                    type: 'transfer_request',
                    status: 'pending',
                    animalId_public: animal.id_public,
                    animalName: animal.name,
                    animalImageUrl: animal.imageUrl || '',
                    transferId: transfer._id,
                    message: `You have received an animal transfer request for ${animal.name} (${animal.id_public}).`,
                    metadata: {
                        transferId: transfer._id,
                        animalId: animal.id_public,
                        animalName: animal.name,
                        fromUserId: userId
                    }
                });
            }
        }
        
        // PURCHASE with existing user (seller) and existing animal
        if (type === 'purchase' && sellerUserId && animalId) {
            // Check if the animal exists (might belong to seller or be in their view-only list)
            const animal = await Animal.findOne({ id_public: animalId });
            
            if (animal && animal.ownerId.toString() === sellerUserId.toString()) {
                // Create transfer with view-only offer
                transfer = await AnimalTransfer.create({
                    fromUserId: userId, // buyer
                    toUserId: sellerUserId, // seller
                    animalId_public: animalId,
                    transactionId: newTransaction._id,
                    transferType: 'purchase',
                    status: 'pending',
                    offerViewOnly: true
                });
                
                // Create notification for seller
                const sellerProfile = await PublicProfile.findOne({ userId_backend: sellerUserId });
                await Notification.create({
                    userId: sellerUserId,
                    userId_public: sellerProfile?.id_public || '',
                    type: 'view_only_offer',
                    status: 'pending',
                    animalId_public: animal.id_public,
                    animalName: animal.name,
                    animalImageUrl: animal.imageUrl || '',
                    transferId: transfer._id,
                    message: `A buyer has logged a purchase of your animal ${animal.name} (${animal.id_public}). Would you like view-only access?`,
                    metadata: {
                        transferId: transfer._id,
                        animalId: animal.id_public,
                        animalName: animal.name,
                        fromUserId: userId
                    }
                });
            }
        }
        
        res.status(201).json({ 
            transaction: newTransaction,
            transfer: transfer || null
        });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ message: 'Internal server error while creating transaction.' });
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
