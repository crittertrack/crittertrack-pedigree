const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Transaction, AnimalTransfer, Animal, Litter, SupplyUsage, Counter } = require('../database/models');
const { privateStorage } = require('../utils/privateStorage');
const {
    MAX_ATTACHMENT_BYTES, formatReceiptNumber, checkAttachmentFile, contentMatchesType, buildAttachmentKey, buildAttachment,
} = require('../utils/receipts');
const { buildLitterOverview } = require('../utils/financeOverview');
const { summarizeUsage } = require('../utils/supplyUsage');

// Resolve a litter by its public id (CTL...) for a user who created or adopted it.
async function findUserLitter(litterId, userId) {
    if (!litterId || typeof litterId !== 'string') return null;
    return Litter.findOne({ litter_id_public: litterId, $or: [{ creatorId: userId }, { linkedOwners: userId }] }).lean();
}

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
        const { type, animalId, animalName, litterId, price, date, buyer, seller, notes, category, description } = req.body;

        // Validation
        if (!type || !['sale', 'purchase', 'expense', 'income'].includes(type)) {
            return res.status(400).json({ message: 'Invalid transaction type. Must be "sale", "purchase", "expense", or "income".' });
        }

        if (litterId) {
            const litter = await findUserLitter(litterId, userId);
            if (!litter) {
                return res.status(400).json({ message: 'Litter not found or access denied.' });
            }
        }

        const effectivePrice = (price === undefined || price === null || price === '') ? 0 : price;
        if (isNaN(effectivePrice) || parseFloat(effectivePrice) < 0) {
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
            litterId: litterId || null,
            price: parseFloat(effectivePrice),
            date: new Date(date),
            buyer: type === 'sale' ? (buyer || null) : null,
            seller: type === 'purchase' ? (seller || null) : null,
            category: (type === 'expense' || type === 'income') ? (category || null) : null,
            description: (type === 'expense' || type === 'income') ? (description || null) : null,
            notes: notes || null
        });
        
        await newTransaction.save();
        console.log('[Budget] Transaction saved with ID:', newTransaction._id);
        
        res.status(201).json({ 
            transaction: newTransaction,
            transfer: null
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
        const { type, animalId, animalName, litterId, price, date, buyer, seller, notes, category, description } = req.body;
        
        // Find the transaction and verify ownership
        const transaction = await Transaction.findOne({ _id: transactionId, userId });
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or access denied.' });
        }
        
        // Validation
        if (type && !['sale', 'purchase', 'expense', 'income'].includes(type)) {
            return res.status(400).json({ message: 'Invalid transaction type. Must be "sale", "purchase", "expense", or "income".' });
        }
        
        if (price !== undefined && (isNaN(price) || parseFloat(price) < 0)) {
            return res.status(400).json({ message: 'Invalid price. Must be 0 or greater.' });
        }
        
        // Update fields
        if (type) transaction.type = type;
        if (animalId !== undefined) transaction.animalId = animalId || null;
        if (animalName !== undefined) transaction.animalName = animalName || null;
        if (litterId !== undefined) {
            if (litterId) {
                const litter = await findUserLitter(litterId, userId);
                if (!litter) {
                    return res.status(400).json({ message: 'Litter not found or access denied.' });
                }
            }
            transaction.litterId = litterId || null;
        }
        if (price !== undefined) transaction.price = parseFloat(price);
        if (date) transaction.date = new Date(date);
        if (buyer !== undefined) transaction.buyer = transaction.type === 'sale' ? (buyer || null) : null;
        if (seller !== undefined) transaction.seller = transaction.type === 'purchase' ? (seller || null) : null;
        if (category !== undefined) transaction.category = (transaction.type === 'expense' || transaction.type === 'income') ? (category || null) : null;
        if (description !== undefined) transaction.description = (transaction.type === 'expense' || transaction.type === 'income') ? (description || null) : null;
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

        // Remove its stored receipts/attachments too, so no financial files are left behind.
        await Promise.all((transaction.attachments || []).map(a => privateStorage.remove(a.key)));
        
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

// --- Receipts & attachments -------------------------------------------------------------------

const attachmentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES },
});

// Runs multer and turns its errors (e.g. file too large) into a clean 400 instead of a 500.
const receiveAttachment = (req, res, next) => {
    attachmentUpload.single('file')(req, res, (err) => {
        if (!err) return next();
        const tooBig = err.code === 'LIMIT_FILE_SIZE';
        return res.status(400).json({ message: tooBig ? 'Files must be 5 MB or smaller.' : 'Could not read the uploaded file.' });
    });
};

// POST /api/budget/transactions/:id/attachments - attach a photo/PDF (multipart: file, kind?)
router.post('/transactions/:id/attachments', receiveAttachment, async (req, res) => {
    try {
        const userId = req.user.id;
        const transaction = await Transaction.findOne({ _id: req.params.id, userId });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or access denied.' });
        }

        const problem = checkAttachmentFile(req.file, (transaction.attachments || []).length);
        if (problem) return res.status(400).json({ message: problem });

        // The browser-reported type can be faked, so check the file's real contents too.
        if (!contentMatchesType(req.file.buffer, req.file.mimetype)) {
            return res.status(400).json({ message: 'That file does not look like a valid image or PDF.' });
        }

        // Financial documents go to PRIVATE storage and are never given a public link.
        if (!privateStorage.isConfigured()) {
            return res.status(503).json({ message: 'Private file storage is not set up yet, so files cannot be attached.' });
        }
        const key = buildAttachmentKey(userId, req.file.mimetype);
        try {
            await privateStorage.put(key, req.file.buffer, req.file.mimetype);
        } catch (uploadErr) {
            console.error('[Budget] Attachment upload failed:', uploadErr.message);
            return res.status(502).json({ message: 'Could not store the file. Please try again.' });
        }

        transaction.attachments.push(buildAttachment({ key, file: req.file, kind: req.body.kind }));
        await transaction.save();
        res.status(201).json(transaction);
    } catch (error) {
        console.error('[Budget] Error attaching file:', error);
        res.status(500).json({ message: 'Failed to attach file.' });
    }
});

// DELETE /api/budget/transactions/:id/attachments/:attachmentId - remove an attachment
router.delete('/transactions/:id/attachments/:attachmentId', async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or access denied.' });
        }
        const attachment = transaction.attachments.id(req.params.attachmentId);
        if (!attachment) {
            return res.status(404).json({ message: 'Attachment not found.' });
        }
        const key = attachment.key;
        attachment.deleteOne();
        await transaction.save();
        // Delete the stored file too (private storage supports this). Best-effort.
        await privateStorage.remove(key);
        res.status(200).json(transaction);
    } catch (error) {
        console.error('[Budget] Error removing attachment:', error);
        res.status(500).json({ message: 'Failed to remove attachment.' });
    }
});

// GET /api/budget/transactions/:id/attachments/:attachmentId/file - download an attachment.
// Requires sign-in and ownership of the transaction. Never cached and never shareable by link.
router.get('/transactions/:id/attachments/:attachmentId/file', async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id }).lean();
        const attachment = transaction && (transaction.attachments || []).find(a => String(a._id) === req.params.attachmentId);
        if (!attachment) {
            return res.status(404).json({ message: 'Attachment not found.' });
        }
        if (!attachment.key) {
            // Saved before private storage existed: it only has an old public link.
            return res.status(410).json({ message: 'This older attachment is not stored privately. Please re-attach it.' });
        }

        const file = await privateStorage.get(attachment.key);
        if (!file) {
            return res.status(404).json({ message: 'The stored file could not be found.' });
        }

        const safeName = encodeURIComponent(attachment.filename || 'attachment');
        res.setHeader('Content-Type', attachment.mimeType || file.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeName}`);
        res.setHeader('Content-Length', file.buffer.length);
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // The app sets Cross-Origin-Resource-Policy: cross-origin for images; financial files must not be embeddable elsewhere.
        res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
        res.status(200).send(file.buffer);
    } catch (error) {
        console.error('[Budget] Error downloading attachment:', error);
        res.status(500).json({ message: 'Failed to download attachment.' });
    }
});

// POST /api/budget/transactions/:id/receipt-number - issue (once) this transaction's receipt number.
// Calling it again returns the same number, so a receipt can be regenerated without a new number.
router.post('/transactions/:id/receipt-number', async (req, res) => {
    try {
        const userId = req.user.id;
        const transaction = await Transaction.findOne({ _id: req.params.id, userId });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or access denied.' });
        }
        if (transaction.receiptNumber) {
            return res.status(200).json(transaction);
        }

        const counter = await Counter.findByIdAndUpdate(
            { _id: `receipt_${userId}` },
            { $inc: { seq: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const receiptNumber = formatReceiptNumber(counter.seq);

        // Only set it if nobody else issued one in the meantime.
        await Transaction.updateOne(
            { _id: transaction._id, userId, receiptNumber: null },
            { $set: { receiptNumber, receiptIssuedAt: new Date() } }
        );
        const updated = await Transaction.findOne({ _id: transaction._id, userId });
        res.status(200).json(updated);
    } catch (error) {
        console.error('[Budget] Error issuing receipt number:', error);
        res.status(500).json({ message: 'Failed to issue receipt number.' });
    }

// POST /api/budget/transactions/:id/payments - record an editable payment against a transaction
router.post('/transactions/:id/payments', async (req, res) => {
    try {
        const userId = req.user.id;
        const txn = await Transaction.findOne({ _id: req.params.id, userId });
        if (!txn) return res.status(404).json({ message: 'Transaction not found.' });
        const { amount, date, method, note } = req.body || {};
        const amt = Number(amount);
        if (!isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Amount must be a positive number.' });
        txn.payments = txn.payments || [];
        txn.payments.push({ amount: amt, date: date ? new Date(date) : new Date(), method: method || null, note: note || null });
        await txn.save();
        res.status(200).json(txn);
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// DELETE /api/budget/transactions/:id/payments/:index - remove an editable payment
router.delete('/transactions/:id/payments/:index', async (req, res) => {
    try {
        const userId = req.user.id;
        const txn = await Transaction.findOne({ _id: req.params.id, userId });
        if (!txn) return res.status(404).json({ message: 'Transaction not found.' });
        const idx = Number(req.params.index);
        if (!Array.isArray(txn.payments) || idx < 0 || idx >= txn.payments.length) return res.status(400).json({ message: 'Invalid payment index.' });
        txn.payments.splice(idx, 1);
        await txn.save();
        res.status(200).json(txn);
    } catch (error) {
        console.error('Error removing payment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /api/budget/transactions/:id/invoice - payment status summary
router.get('/transactions/:id/invoice', async (req, res) => {
    try {
        const userId = req.user.id;
        const txn = await Transaction.findOne({ _id: req.params.id, userId }).lean();
        if (!txn) return res.status(404).json({ message: 'Transaction not found.' });
        const { invoiceSummary } = require('../utils/paymentStatus');
        res.status(200).json(invoiceSummary(txn, txn.payments || []));
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

});

// GET /api/budget/report/year/:year - year-end financial report
router.get('/report/year/:year', async (req, res) => {
    try {
        const userId = req.user.id;
        const year = Number(req.params.year);
        const txns = await Transaction.find({ userId }).lean();
        const { summarizeYear, availableYears } = require('../utils/yearEndReport');
        if (isNaN(year)) {
            return res.status(200).json({ years: availableYears(txns) });
        }
        res.status(200).json(summarizeYear(txns, year));
    } catch (error) {
        console.error('Error fetching year report:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /api/budget/overview/litter/:litterId - Money summary for one litter (by litter_id_public)
// Costs = transactions tagged to the litter + transactions on its individual offspring.
// Parent (sire/dam) transactions are NOT included.
router.get('/overview/litter/:litterId', async (req, res) => {
    try {
        const userId = req.user.id;
        const litter = await findUserLitter(req.params.litterId, userId);
        if (!litter) {
            return res.status(404).json({ message: 'Litter not found or access denied.' });
        }

        const offspringIds = Array.isArray(litter.offspringIds_public) ? litter.offspringIds_public : [];
        const offspring = offspringIds.length
            ? await Animal.find({ id_public: { $in: offspringIds }, creatorId: userId })
                .select('id_public prefix name suffix status soldStatus saleDate salePrice deceasedDate isForSale salePriceAmount reservedBuyerName reservedWaitlistEntryId reservedPrice reservedDeposit reservedDepositStatus reservedPaymentStatus')
                .lean()
            : [];

        const owned = offspring.map(a => a.id_public);
        const transactions = await Transaction.find({
            userId,
            $or: [
                { litterId: litter.litter_id_public },
                ...(owned.length ? [{ animalId: { $in: owned } }] : []),
            ],
        }).sort({ date: -1 }).lean();

        // Supplies used on the litter itself or on its individual offspring (e.g. their feedings).
        const usageEntries = await SupplyUsage.find({
            userId,
            $or: [
                { litterId: litter.litter_id_public },
                ...(owned.length ? [{ animalId: { $in: owned } }] : []),
            ],
        }).lean();

        res.status(200).json({
            ...buildLitterOverview({ litter, offspring, transactions }),
            // entries = the individual rows, so the Care & supplies table can remove one.
            usage: {
                ...summarizeUsage(usageEntries),
                entries: usageEntries
                    .map(e => ({
                        _id: e._id, supplyName: e.supplyName || 'Unknown supply', quantity: e.quantity,
                        unit: e.unit || '', cost: e.cost, priced: !!e.priced, date: e.date,
                    }))
                    .sort((a, b) => new Date(b.date) - new Date(a.date)),
            },
            transactions,
        });
    } catch (error) {
        console.error('Error fetching litter finance overview:', error);
        res.status(500).json({ message: 'Internal server error while fetching litter finances.' });
    }
});

// POST /api/budget/litters/:litterId/manual-expense - add a manual cost to a litter (vet, bedding...).
// Saved as a normal 'expense' transaction tagged to the litter, so it counts in Spent and in Budget.
router.post('/litters/:litterId/manual-expense', async (req, res) => {
    try {
        const userId = req.user.id;
        const litter = await findUserLitter(req.params.litterId, userId);
        if (!litter) {
            return res.status(404).json({ message: 'Litter not found or access denied.' });
        }

        const { name, amount, category, note, date } = req.body || {};
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0.' });
        }
        const when = date ? new Date(date) : new Date();
        if (Number.isNaN(when.getTime())) {
            return res.status(400).json({ message: 'Invalid date.' });
        }

        const txn = await Transaction.create({
            userId,
            type: 'expense',
            litterId: litter.litter_id_public,
            price: amt,
            date: when,
            category: typeof category === 'string' && category ? category : null,
            description: typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : null,
            notes: typeof note === 'string' && note.trim() ? note.trim() : null,
        });
        res.status(201).json(txn);
    } catch (error) {
        console.error('Error recording manual litter expense:', error);
        res.status(500).json({ message: 'Internal server error while saving the expense.' });
    }
});

module.exports = router;
