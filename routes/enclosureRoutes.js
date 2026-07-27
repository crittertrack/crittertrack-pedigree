const express = require('express');
const router = express.Router();
const { Enclosure, Animal, SupplyItem, EnclosureLog, UserActivityLog, Location } = require('../database/models');
const { logUserActivity } = require('../utils/userActivityLogger');

// ── Helper: Compute field diffs between old and new enclosure data ──────────
const FIELD_LABELS = {
    name: 'Name',
    enclosureType: 'Enclosure Type',
    purpose: 'Purpose',
    purposeDescription: 'Purpose Description',
    location: 'Location',
    buildingId: 'Building',
    roomId: 'Room',
    capacity: 'Capacity',
    tempMin: 'Min Temperature',
    tempMax: 'Max Temperature',
    temperatureUnit: 'Temperature Unit',
    humidityMin: 'Min Humidity',
    humidityMax: 'Max Humidity',
    lightsOnTime: 'Lights On Time',
    lightsOffTime: 'Lights Off Time',
    lightTimeFormat: 'Time Format',
    notes: 'Description',
    tags: 'Tags',
    speciesLabels: 'Suitable Species',
    imageUrl: 'Image',
    bedding: 'Bedding/Substrate',
    lightingType: 'Lighting Type',
    enrichment: 'Enrichment',
};

const DIFF_FIELDS = Object.keys(FIELD_LABELS);

function isEmpty(val) {
    return val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
}

async function computeFieldDiffs(oldData, newData) {
    const changes = [];

    // Resolve buildingId and roomId ObjectIDs to human-readable names
    const resolved = { buildingId: {}, roomId: {} };
    const oldBuildingId = oldData.buildingId;
    const newBuildingId = newData.buildingId;
    const oldRoomId = oldData.roomId;
    const newRoomId = newData.roomId;

    // Batch-fetch all referenced locations in one query
    const allLocationIds = [oldBuildingId, newBuildingId, oldRoomId, newRoomId].filter(Boolean);
    const locations = allLocationIds.length > 0
        ? await Location.find({ _id: { $in: allLocationIds } }).select('name').lean()
        : [];
    const locationMap = {};
    for (const loc of locations) {
        locationMap[loc._id.toString()] = loc.name;
    }

    function resolveId(id) {
        if (!id) return null;
        return locationMap[id.toString()] || id.toString();
    }

    for (const field of DIFF_FIELDS) {
        let oldVal = oldData[field];
        let newVal = newData[field];
        // Treat empty/null/undefined as equivalent to avoid phantom "empty → empty" changes
        if (isEmpty(oldVal) && isEmpty(newVal)) continue;
        // Resolve building/room IDs to names for display
        if (field === 'buildingId') {
            oldVal = resolveId(oldVal);
            newVal = resolveId(newVal);
        }
        if (field === 'roomId') {
            oldVal = resolveId(oldVal);
            newVal = resolveId(newVal);
        }
        // Normalize for comparison — arrays to JSON, objects to JSON
        const a = JSON.stringify(oldVal);
        const b = JSON.stringify(newVal);
        if (a !== b) {
            changes.push({
                field,
                label: FIELD_LABELS[field],
                oldValue: oldVal,
                newValue: newVal,
            });
        }
    }

    // Also check nested fields: dimensions
    if (JSON.stringify(oldData.dimensions) !== JSON.stringify(newData.dimensions)) {
        const oldDims = oldData.dimensions || {};
        const newDims = newData.dimensions || {};
        changes.push({
            field: 'dimensions',
            label: 'Dimensions',
            oldValue: oldDims.length ? `${oldDims.length}x${oldDims.width}x${oldDims.height} ${oldDims.unit || 'in'}` : null,
            newValue: newDims.length ? `${newDims.length}x${newDims.width}x${newDims.height} ${newDims.unit || 'in'}` : null,
        });
    }

    // Check cleaningTasks changes
    const oldTaskNames = (oldData.cleaningTasks || []).map(t => t.taskName).sort().join(',');
    const newTaskNames = (newData.cleaningTasks || []).map(t => t.taskName).sort().join(',');
    if (oldTaskNames !== newTaskNames) {
        changes.push({
            field: 'cleaningTasks',
            label: 'Cleaning Tasks',
            oldValue: oldData.cleaningTasks || [],
            newValue: newData.cleaningTasks || [],
        });
    }

    return changes;
}

// ── Helper: Log to all systems ──────────────────────────────────────────────
async function logEnclosureActivity({
    userId,
    id_public,
    enclosure,
    action,
    targetType = 'enclosure',
    details = {},
    previousValue = null,
    newValue = null,
    changes = null,
    ipAddress = null,
    userAgent = null,
}) {
    const userName = details.userName || 'System';

    // 1. Log to UserActivityLog (global activity feed)
    await logUserActivity({
        userId,
        id_public,
        action,
        targetType,
        targetId: enclosure._id,
        targetId_public: enclosure.name,
        details: { enclosureName: enclosure.name, ...details },
        previousValue,
        newValue,
        ipAddress,
        userAgent,
        success: true,
    }).catch(err => console.error('[enclosureRoutes] Failed to log user activity:', err.message));

    // 2. Log to EnclosureLog (enclosure-specific changelog collection)
    await EnclosureLog.create({
        enclosureId: enclosure._id,
        enclosureName: enclosure.name,
        userId,
        userName,
        action,
        details: changes ? { changes, ...details } : details,
    }).catch(err => console.error('[enclosureRoutes] Failed to create EnclosureLog:', err.message));

    // 3. Log to enclosure.history (embedded array on the enclosure document)
    await Enclosure.updateOne(
        { _id: enclosure._id },
        {
            $push: {
                history: {
                    timestamp: new Date(),
                    userId,
                    userName,
                    action,
                    details: changes ? { changes, ...details } : details,
                }
            }
        }
    ).catch(err => console.error('[enclosureRoutes] Failed to push history:', err.message));
}

// ── Helpers for cleaning-task diffing ──────────────────────────────────────
function compareTaskLists(oldTasks = [], newTasks = []) {
    const changes = [];
    const oldMap = new Map(oldTasks.map(t => [t.taskName, t]));
    const newMap = new Map(newTasks.map(t => [t.taskName, t]));

    // Added tasks
    for (const t of newTasks) {
        if (!oldMap.has(t.taskName)) {
            changes.push({ action: 'task_added', taskName: t.taskName, task: t });
        }
    }
    // Removed tasks
    for (const t of oldTasks) {
        if (!newMap.has(t.taskName)) {
            changes.push({ action: 'task_removed', taskName: t.taskName, task: t });
        }
    }
    return changes;
}

// =============================================================================
// ROUTES
// =============================================================================

// GET all enclosures for the authenticated user
router.get('/', async (req, res) => {
    try {
        const enclosures = await Enclosure.find({ creatorId: req.user.id }).sort({ name: 1 }).lean();
        res.json(enclosures);
    } catch (err) {
        console.error('[GET /api/enclosures]', err);
        res.status(500).json({ message: 'Failed to fetch enclosures' });
    }
});

// GET /:id — Get single enclosure
router.get('/:id', async (req, res) => {
    try {
        const enc = await Enclosure.findOne({ _id: req.params.id, creatorId: req.user.id }).lean();
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });
        res.json(enc);
    } catch (err) {
        console.error('[GET /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to fetch enclosure' });
    }
});

// GET /:id/activity — Get aggregated activity for this enclosure
router.get('/:id/activity', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (parsedPage - 1) * parsedLimit;

        const enc = await Enclosure.findOne({ _id: req.params.id, creatorId: req.user.id }).select('name').lean();
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });

        // Get from EnclosureLog collection
        const [logs, total] = await Promise.all([
            EnclosureLog.find({ enclosureId: req.params.id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            EnclosureLog.countDocuments({ enclosureId: req.params.id }),
        ]);

// Also get from UserActivityLog (enclosure-specific actions only)
        const enclosureActions = [
            'enclosure_create', 'enclosure_update', 'enclosure_delete',
            'enclosure_assign', 'enclosure_unassign', 'enclosure_task_done',
        ];
        const [activityLogs, activityTotal] = await Promise.all([
            UserActivityLog.find({
                userId: req.user.id,
                action: { $in: enclosureActions },
                'details.enclosureName': enc.name,
            })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            UserActivityLog.countDocuments({
                userId: req.user.id,
                action: { $in: enclosureActions },
                'details.enclosureName': enc.name,
            }),
        ]);

        res.json({
            logs,
            activityLogs,
            total: total + activityTotal,
            page: parsedPage,
            limit: parsedLimit,
        });
    } catch (err) {
        console.error('[GET /api/enclosures/:id/activity]', err);
        res.status(500).json({ message: 'Failed to fetch enclosure activity' });
    }
});

// POST create enclosure
router.post('/', async (req, res) => {
    try {
        const {
            name, enclosureType, purpose, location, dimensions, capacity,
            tempMin, tempMax, temperatureUnit, humidityMin, humidityMax,
            lightsOnTime, lightsOffTime, lightTimeFormat, notes,
            cleaningTasks, tags, speciesLabels, imageUrl,
            buildingId, roomId,
            bedding, lightingType, enrichment
        } = req.body;

        if (!name?.trim()) return res.status(400).json({ message: 'Enclosure name is required' });

        const enc = new Enclosure({
            creatorId: req.user.id,
            name: name.trim(),
            enclosureType: enclosureType?.trim() || '',
            purpose: purpose || 'general',
            location: location?.trim() || '',
            dimensions: dimensions || { length: null, width: null, height: null, unit: 'in' },
            capacity: capacity ? Number(capacity) : null,
            tempMin: tempMin ? Number(tempMin) : null,
            tempMax: tempMax ? Number(tempMax) : null,
            temperatureUnit: temperatureUnit || 'C',
            humidityMin: humidityMin ? Number(humidityMin) : null,
            humidityMax: humidityMax ? Number(humidityMax) : null,
            lightsOnTime: lightsOnTime || null,
            lightsOffTime: lightsOffTime || null,
            lightTimeFormat: lightTimeFormat || '24h',
            notes: notes?.trim() || '',
            cleaningTasks: Array.isArray(cleaningTasks) ? cleaningTasks : [],
            tags: Array.isArray(tags) ? tags : [],
            speciesLabels: Array.isArray(speciesLabels) ? speciesLabels : [],
            imageUrl: imageUrl || null,
            buildingId: buildingId || null,
            roomId: roomId || null,
            bedding: bedding || null,
            lightingType: lightingType || null,
            enrichment: enrichment || null,
        });

        await enc.save();

        // Log creation to UserActivityLog
        await logEnclosureActivity({
            userId: req.user.id,
            id_public: req.user.id_public,
            enclosure: enc,
            action: 'enclosure_create',
            details: { userName: req.user.personalName || req.user.email || 'User' },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        res.status(201).json(enc);
    } catch (err) {
        console.error('[POST /api/enclosures]', err);
        res.status(500).json({ message: 'Failed to create enclosure' });
    }
});

// PUT update enclosure — with field-level diff tracking
router.put('/:id', async (req, res) => {
    try {
        const {
            name, enclosureType, purpose, location, dimensions, capacity,
            tempMin, tempMax, temperatureUnit, humidityMin, humidityMax,
            lightsOnTime, lightsOffTime, lightTimeFormat, notes,
            cleaningTasks, tags, speciesLabels, imageUrl,
            buildingId, roomId,
            bedding, lightingType, enrichment
        } = req.body;

        if (!name?.trim()) return res.status(400).json({ message: 'Enclosure name is required' });

        // Fetch old enclosure to compute diffs
        const oldEnclosure = await Enclosure.findOne({ _id: req.params.id, creatorId: req.user.id }).lean();
        if (!oldEnclosure) return res.status(404).json({ message: 'Enclosure not found' });

        const setData = {
            name: name.trim(),
            enclosureType: enclosureType?.trim() || '',
            purpose: purpose || 'general',
            location: location?.trim() || '',
            dimensions: dimensions || { length: null, width: null, height: null, unit: 'in' },
            capacity: capacity ? Number(capacity) : null,
            tempMin: tempMin ? Number(tempMin) : null,
            tempMax: tempMax ? Number(tempMax) : null,
            temperatureUnit: temperatureUnit || 'C',
            humidityMin: humidityMin ? Number(humidityMin) : null,
            humidityMax: humidityMax ? Number(humidityMax) : null,
            lightsOnTime: lightsOnTime || null,
            lightsOffTime: lightsOffTime || null,
            lightTimeFormat: lightTimeFormat || '24h',
            notes: notes?.trim() || '',
            cleaningTasks: Array.isArray(cleaningTasks) ? cleaningTasks : [],
            tags: Array.isArray(tags) ? tags : [],
            speciesLabels: Array.isArray(speciesLabels) ? speciesLabels : [],
            imageUrl: imageUrl || null,
            buildingId: buildingId || null,
            roomId: roomId || null,
            bedding: bedding || null,
            lightingType: lightingType || null,
            enrichment: enrichment || null,
        };

        const enc = await Enclosure.findOneAndUpdate(
            { _id: req.params.id, creatorId: req.user.id },
            { $set: setData },
            { new: true }
        );
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });

// Compute field diffs (now async — resolves building/room IDs to names)
        const changes = await computeFieldDiffs(oldEnclosure, setData);

        // Also detect task additions/removals
        const taskChanges = compareTaskLists(oldEnclosure.cleaningTasks, setData.cleaningTasks);
        if (taskChanges.length > 0) {
            changes.push({
                field: 'cleaningTasks',
                label: 'Cleaning Tasks',
                oldValue: oldEnclosure.cleaningTasks?.length || 0,
                newValue: setData.cleaningTasks.length,
                _taskChanges: taskChanges,
            });
        }

        // Log update activity
        await logEnclosureActivity({
            userId: req.user.id,
            id_public: req.user.id_public,
            enclosure: enc,
            action: 'enclosure_update',
            details: {
                userName: req.user.personalName || req.user.email || 'User',
                changes,
                changeCount: changes.length,
            },
            previousValue: oldEnclosure,
            newValue: setData,
            changes,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        res.json(enc);
    } catch (err) {
        console.error('[PUT /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to update enclosure' });
    }
});

// PATCH assign (or unassign) a single animal to an enclosure
// ⚠️ MUST be defined BEFORE /:id routes so Express doesn't match "assign-animal" as :id
router.patch('/assign-animal', async (req, res) => {
    try {
        const { animalId_public, enclosureId } = req.body;
        if (!animalId_public) return res.status(400).json({ message: 'animalId_public is required' });

        // Fetch the animal to get its name
        const animal = await Animal.findOne({ id_public: animalId_public, creatorId: req.user.id }).select('_id name prefix suffix status').lean();
        if (!animal) return res.status(404).json({ message: 'Animal not found' });

        if (animal.status === 'Deceased' || animal.status === 'Rehomed') {
            return res.status(400).json({ message: `Cannot assign ${animal.status.toLowerCase()} animals to an enclosure` });
        }

        // If assigning, verify the enclosure belongs to this user
        let enc = null;
        if (enclosureId) {
            enc = await Enclosure.findOne({ _id: enclosureId, creatorId: req.user.id }).select('_id name').lean();
            if (!enc) return res.status(404).json({ message: 'Enclosure not found' });
        }

        const animalName = [animal.prefix, animal.name, animal.suffix].filter(Boolean).join(' ');

        // --- Two-way route logging: Handle un-assignment from the old enclosure if moving ---
        if (animal.enclosureId && enclosureId && animal.enclosureId.toString() !== enclosureId) {
            const oldEnc = await Enclosure.findById(animal.enclosureId);
            if (oldEnc) {
                await logEnclosureActivity({
                    userId: req.user.id,
                    id_public: req.user.id_public,
                    enclosure: oldEnc,
                    action: 'enclosure_unassign',
                    details: {
                        userName: req.user.personalName || req.user.email || 'User',
                        animalName,
                        animalId: animalId_public,
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                });
            }
        }

        const result = await Animal.findOneAndUpdate(
            { _id: animal._id },
            { $set: { enclosureId: enclosureId || null } },
            { new: true }
        );
        if (!result) return res.status(404).json({ message: 'Animal not found' });

        // --- Two-way route logging ---
        // 1. Log assignment to the new enclosure
        if (enclosureId && enc) {
            await logEnclosureActivity({
                userId: req.user.id,
                id_public: req.user.id_public,
                enclosure: enc,
                action: 'enclosure_assign',
                details: {
                    userName: req.user.personalName || req.user.email || 'User',
                    animalName,
                    animalId: animalId_public,
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            });
        } else if (!enclosureId && animal.enclosureId) {
            // 2. Log unassignment if moving to no enclosure (this case is now also covered above, but this is a safeguard)
            const oldEnc = await Enclosure.findById(animal.enclosureId);
            if (oldEnc) {
                await logEnclosureActivity({
                    userId: req.user.id,
                    id_public: req.user.id_public,
                    enclosure: oldEnc,
                    action: 'enclosure_unassign',
                    details: {
                        userName: req.user.personalName || req.user.email || 'User',
                        animalName,
                        animalId: animalId_public,
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                });
            }
        }

        res.json({ ok: true, enclosureId: result.enclosureId });
    } catch (err) {
        console.error('[PATCH /api/enclosures/assign-animal]', err);
        res.status(500).json({ message: 'Failed to assign animal to enclosure' });
    }
});

// PATCH /:id — Partial update (used by frontend for notes, history entries, task updates)
router.patch('/:id', async (req, res) => {
    try {
        const enc = await Enclosure.findOne({ _id: req.params.id, creatorId: req.user.id });
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });

        const { $push, $set, $addToSet, $pull, cleaningTasks } = req.body;

        const operations = {};
        if ($push) operations.$push = $push;
        if ($set) operations.$set = $set;
        if ($addToSet) operations.$addToSet = $addToSet;
        if ($pull) operations.$pull = $pull;
        if (cleaningTasks) operations.$set = { ...operations.$set, cleaningTasks };

        if (Object.keys(operations).length === 0) {
            return res.status(400).json({ message: 'No valid update operations provided' });
        }

        // Detect the operation type for logging
        if ($push?.history) {
            // Frontend sent a history entry (e.g., task_complete)
            const historyEntry = $push.history;
            await logEnclosureActivity({
                userId: req.user.id,
                id_public: req.user.id_public,
                enclosure: enc,
                action: historyEntry.action || 'update',
                details: {
                    userName: historyEntry.userName || req.user.personalName || req.user.email || 'User',
                    ...historyEntry.details,
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            });
        } else if ($push?.notesHistory) {
            await logEnclosureActivity({
                userId: req.user.id,
                id_public: req.user.id_public,
                enclosure: enc,
                action: 'note',
                details: {
                    userName: req.user.personalName || req.user.email || 'You',
                    text: $push.notesHistory.text,
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            });
        } else if (cleaningTasks) {
            // Tasks updated — detect additions/removals
            const taskChanges = compareTaskLists(enc.cleaningTasks, cleaningTasks);
            for (const tc of taskChanges) {
                await logEnclosureActivity({
                    userId: req.user.id,
                    id_public: req.user.id_public,
                    enclosure: enc,
                    action: tc.action, // 'task_added' or 'task_removed'
                    details: {
                        userName: req.user.personalName || req.user.email || 'User',
                        taskName: tc.taskName,
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                });
            }
        }

        const updated = await Enclosure.findOneAndUpdate(
            { _id: req.params.id, creatorId: req.user.id },
            operations,
            { new: true }
        );

        res.json(updated);
    } catch (err) {
        console.error('[PATCH /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to update enclosure' });
    }
});

// POST /api/enclosures/:enclosureId/tasks/:taskId/complete - Mark a task as done
router.post('/:enclosureId/tasks/:taskId/complete', async (req, res) => {
    try {
        const { enclosureId, taskId } = req.params;
        const { supplyUsage } = req.body;

        const enclosure = await Enclosure.findOne({ _id: enclosureId, creatorId: req.user.id });
        if (!enclosure) {
            return res.status(404).json({ message: 'Enclosure not found' });
        }

        const task = enclosure.cleaningTasks.id(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found in this enclosure' });
        }

        task.lastDoneDate = new Date();

        if (Array.isArray(supplyUsage) && supplyUsage.length > 0) {
            for (const item of supplyUsage) {
                if (item.supplyId && item.quantityUsed > 0) {
                    await SupplyItem.updateOne(
                        { _id: item.supplyId, userId: req.user.id },
                        { $inc: { currentStock: -item.quantityUsed } }
                    );
                }
            }
        }

        await enclosure.save();

        // Log to all systems
        await logEnclosureActivity({
            userId: req.user.id,
            id_public: req.user.id_public,
            enclosure,
            action: 'enclosure_task_done',
            details: {
                userName: req.user.personalName || req.user.email || 'User',
                taskName: task.taskName,
                taskType: task.type || 'Other',
                supplyUsage: supplyUsage || [],
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        res.json(enclosure);
    } catch (err) {
        console.error('[POST /api/enclosures/.../complete]', err);
        res.status(500).json({ message: 'Failed to mark task as complete' });
    }
});

// DELETE enclosure — also clears enclosureId from all assigned animals
router.delete('/:id', async (req, res) => {
    try {
        const enc = await Enclosure.findOneAndDelete({ _id: req.params.id, creatorId: req.user.id });
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });

        // Log deletion
        await logEnclosureActivity({
            userId: req.user.id,
            id_public: req.user.id_public,
            enclosure: enc,
            action: 'enclosure_delete',
            details: {
                userName: req.user.personalName || req.user.email || 'User',
                enclosureName: enc.name,
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        // Unassign all animals from this enclosure
        await Animal.updateMany(
            { creatorId: req.user.id, enclosureId: req.params.id },
            { $set: { enclosureId: null } }
        );

        res.json({ message: 'Enclosure deleted' });
    } catch (err) {
        console.error('[DELETE /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to delete enclosure' });
    }
});

module.exports = router;
