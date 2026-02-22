const express = require('express');
const router = express.Router();
const { SupplyItem } = require('../database/models');

// GET /api/supplies — list all items owned by the current user
router.get('/', async (req, res) => {
    try {
        const items = await SupplyItem.find({ userId: req.user.id }).sort({ category: 1, name: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch supplies', error: err.message });
    }
});

// POST /api/supplies — create a new supply item
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

// PATCH /api/supplies/:id — update a supply item
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

// DELETE /api/supplies/:id — delete a supply item
router.delete('/:id', async (req, res) => {
    try {
        const result = await SupplyItem.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!result) return res.status(404).json({ message: 'Supply item not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete supply item', error: err.message });
    }
});

module.exports = router;
