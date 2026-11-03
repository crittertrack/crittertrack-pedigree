const express = require('express');
const router = express.Router();
const { SupplyItem, SupplyUsage, Animal, Litter } = require('../database/models');
const { applySupplyUsage, summarizeUsage } = require('../utils/supplyUsage');

// GET /api/supplies list all items owned by the current user
router.get('/', async (req, res) => {
    try {
        const items = await SupplyItem.find({ userId: req.user.id }).sort({ category: 1, name: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch supplies', error: err.message });
    }
});

// POST /api/supplies create a new supply item
router.post('/', async (req, res) => {
    try {
        const { name, category, currentStock, unit, reorderThreshold, notes, isFeederAnimal, feederType, feederSize, costPerUnit, nextOrderDate, orderFrequency, orderFrequencyUnit } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
        const item = new SupplyItem({
            userId: req.user.id,
            name: name.trim(),
            category: category || 'Other',
            currentStock: currentStock !== '' && currentStock != null ? Number(currentStock) : 0,
            unit: unit || '',
            reorderThreshold: reorderThreshold !== '' && reorderThreshold != null ? Number(reorderThreshold) : null,
            notes: notes || '',
            isFeederAnimal: !!isFeederAnimal,
            feederType: isFeederAnimal ? (feederType || '') : '',
            feederSize: isFeederAnimal ? (feederSize || '') : '',
            costPerUnit: costPerUnit !== '' && costPerUnit != null ? Number(costPerUnit) : null,
            nextOrderDate: nextOrderDate || null,
            orderFrequency: orderFrequency !== '' && orderFrequency != null ? Number(orderFrequency) : null,
            orderFrequencyUnit: orderFrequencyUnit || 'months',
        });
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create supply item', error: err.message });
    }
});

// PATCH /api/supplies/:id update a supply item
router.patch('/:id', async (req, res) => {
    try {
        const item = await SupplyItem.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) return res.status(404).json({ message: 'Supply item not found' });
        const { name, category, currentStock, unit, reorderThreshold, notes, isFeederAnimal, feederType, feederSize, costPerUnit, nextOrderDate, orderFrequency, orderFrequencyUnit } = req.body;
        if (name !== undefined) item.name = name.trim();
        if (category !== undefined) item.category = category;
        if (currentStock !== undefined) item.currentStock = Number(currentStock);
        if (unit !== undefined) item.unit = unit;
        if (reorderThreshold !== undefined) item.reorderThreshold = reorderThreshold !== '' && reorderThreshold != null ? Number(reorderThreshold) : null;
        if (notes !== undefined) item.notes = notes;
        if (isFeederAnimal !== undefined) item.isFeederAnimal = !!isFeederAnimal;
        if (feederType !== undefined) item.feederType = feederType || '';
        if (feederSize !== undefined) item.feederSize = feederSize || '';
        if (costPerUnit !== undefined) item.costPerUnit = costPerUnit !== '' && costPerUnit != null ? Number(costPerUnit) : null;
        if (nextOrderDate !== undefined) item.nextOrderDate = nextOrderDate || null;
        if (orderFrequency !== undefined) item.orderFrequency = orderFrequency !== '' && orderFrequency != null ? Number(orderFrequency) : null;
        if (orderFrequencyUnit !== undefined) item.orderFrequencyUnit = orderFrequencyUnit || 'months';
        await item.save();
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update supply item', error: err.message });
    }
});

// DELETE /api/supplies/:id delete a supply item
router.delete('/:id', async (req, res) => {
    try {
        const result = await SupplyItem.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!result) return res.status(404).json({ message: 'Supply item not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete supply item', error: err.message });
    }
});

// POST /api/supplies/use - Use a supply for a litter or an animal ("from supplies" cost).
// Body: { supplyId, quantity, unit?, litterId?, animalId?, date?, note? }
// Deducts stock (with unit conversion) and records a Usage entry valued at the supply's cost per unit.
router.post('/use', async (req, res) => {
    try {
        const userId = req.user.id;
        const { supplyId, quantity, unit, litterId, animalId, date, note } = req.body;

        if (!litterId && !animalId) {
            return res.status(400).json({ message: 'Choose a litter or an animal to use this supply for.' });
        }
        if (litterId) {
            const litter = await Litter.findOne({
                litter_id_public: litterId,
                $or: [{ creatorId: userId }, { linkedOwners: userId }],
            }).select('_id').lean();
            if (!litter) return res.status(400).json({ message: 'Litter not found or access denied.' });
        }
        if (animalId) {
            const animal = await Animal.findOne({ id_public: animalId, creatorId: userId }).select('_id').lean();
            if (!animal) return res.status(400).json({ message: 'Animal not found or access denied.' });
        }

        const parsedDate = date ? new Date(date) : new Date();
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date.' });
        }

        const { supply, usage } = await applySupplyUsage({
            SupplyItem, SupplyUsage, userId, supplyId, quantity, unit,
            source: litterId ? 'litter' : 'animal',
            animalId: animalId || null,
            litterId: litterId || null,
            note: note || '',
            date: parsedDate,
        });

        res.status(201).json({ supply, usage });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        res.status(500).json({ message: 'Failed to record supply use', error: err.message });
    }
});

// GET /api/supplies/usage - Usage entries + totals. Filters: year, litterId, animalId, supplyId.
router.get('/usage', async (req, res) => {
    try {
        const query = { userId: req.user.id };
        const { year, litterId, animalId, supplyId } = req.query;
        if (litterId) query.litterId = String(litterId);
        if (animalId) query.animalId = String(animalId);
        if (supplyId) query.supplyId = supplyId;
        if (year) {
            const y = parseInt(year, 10);
            if (!Number.isInteger(y) || y < 1970 || y > 2200) {
                return res.status(400).json({ message: 'Invalid year.' });
            }
            query.date = { $gte: new Date(Date.UTC(y, 0, 1)), $lt: new Date(Date.UTC(y + 1, 0, 1)) };
        }

        const entries = await SupplyUsage.find(query).sort({ date: -1 }).limit(2000).lean();
        res.json({ entries, summary: summarizeUsage(entries) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch supply usage', error: err.message });
    }
});

// DELETE /api/supplies/usage/:id - Undo a usage entry and put the quantity back in stock.
router.delete('/usage/:id', async (req, res) => {
    try {
        const entry = await SupplyUsage.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Usage entry not found' });

        let restored = false;
        if (entry.supplyId) {
            const supply = await SupplyItem.findOne({ _id: entry.supplyId, userId: req.user.id });
            // Only restore when the supply still uses the unit the entry was recorded in.
            if (supply && (supply.unit || '') === (entry.unit || '')) {
                supply.currentStock = (supply.currentStock || 0) + entry.quantity;
                await supply.save();
                restored = true;
            }
        }
        await entry.deleteOne();
        res.json({ message: 'Deleted', restored });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete usage entry', error: err.message });
    }
});

module.exports = router;
