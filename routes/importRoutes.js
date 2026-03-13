const express = require('express');
const router = express.Router();
const multer = require('multer');
const JSZip = require('jszip');
const { Animal, Litter, Enclosure, SupplyItem, Transaction } = require('../database/models');
const { getNextSequence } = require('../database/db_service');

// Memory-only multer for import (we need the buffer, not a file on disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['application/json', 'application/zip',
            'application/x-zip-compressed', 'application/octet-stream'];
        const ext = (file.originalname || '').split('.').pop().toLowerCase();
        if (allowed.includes(file.mimetype) || ext === 'json' || ext === 'zip') {
            return cb(null, true);
        }
        cb(new Error('Only .json or .zip files are accepted'));
    },
});

// ─── CSV parser (RFC 4180) ──────────────────────────────────────────────────

function parseCSV(text) {
    // Normalise line endings
    const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; } // escaped quote
                else inQuotes = false;
            } else {
                field += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ',') {
                row.push(field); field = '';
            } else if (c === '\n') {
                row.push(field); field = '';
                rows.push(row); row = [];
            } else {
                field += c;
            }
        }
    }
    // flush last field/row
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);

    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => {
            const val = r[i] !== undefined ? r[i] : '';
            // Auto-parse embedded JSON arrays/objects
            if ((val.startsWith('[') || val.startsWith('{')) && val.endsWith(']') || val.endsWith('}')) {
                try { obj[h] = JSON.parse(val); return; } catch { /* keep raw */ }
            }
            obj[h] = val;
        });
        return obj;
    });
}

// ─── Parse uploaded file into section data ──────────────────────────────────

async function parseUpload(buffer, originalname) {
    const ext = (originalname || '').split('.').pop().toLowerCase();

    if (ext === 'json') {
        const text = buffer.toString('utf8');
        const parsed = JSON.parse(text);
        // Support both { animals: [...], ... } and a bare array (single section)
        if (Array.isArray(parsed)) {
            throw new Error('Top-level JSON must be an object with section keys (animals, litters, etc.)');
        }
        return parsed;
    }

    if (ext === 'zip') {
        const zip = await JSZip.loadAsync(buffer);
        const result = {};
        const sectionMap = {
            'animals': 'animals',
            'litters': 'litters',
            'enclosures': 'enclosures',
            'supplies': 'supplies',
            'budget': 'budget',
        };
        for (const [filename, fileObj] of Object.entries(zip.files)) {
            if (fileObj.dir) continue;
            const base = filename.split('/').pop().toLowerCase();
            for (const [key, section] of Object.entries(sectionMap)) {
                if (base.includes(key) && base.endsWith('.csv')) {
                    const text = await fileObj.async('text');
                    result[section] = parseCSV(text);
                    break;
                }
            }
        }
        return result;
    }

    throw new Error('Unsupported file type. Upload a .json or .zip file.');
}

// ─── Field sanitisers: keep only schema-safe fields, strip ObjectId refs ─────

const ANIMAL_SAFE = new Set([
    'id_public','species','prefix','suffix','name','gender','birthDate','deceasedDate',
    'breederId_public','manualBreederName','status','color','coat','earset',
    'isOwned','archived','soldStatus','isPregnant','isNursing','isInMating','isQuarantine',
    'lastFedDate','feedingFrequencyDays','lastMaintenanceDate','maintenanceFrequencyDays',
    'careTasks','tags','imageUrl','photoUrl','extraImages',
    'sireId_public','damId_public',
    'remarks','geneticCode','keeperName','groupRole','keeperHistory',
    'coatPattern','lifeStage','carrierTraits','phenotype','morph','markings',
    'eyeColor','nailColor','size','weight','length','heightAtWithers','bodyLength',
    'chestGirth','adultWeight','bodyConditionScore',
    'microchipNumber','pedigreeRegistrationId','colonyId','breed','strain',
    'licenseNumber','licenseJurisdiction','rabiesTagNumber','tattooId',
    'akcRegistrationNumber','fciRegistrationNumber','cfaRegistrationNumber','workingRegistryIds',
    'origin','isNeutered','heatStatus','lastHeatDate','ovulationDate','matingDates',
    'expectedDueDate','litterCount','litterSizeBorn','litterSizeWeaned','stillbornCount',
    'nursingStartDate','weaningDate','breedingRole','lastMatingDate','successfulMatings',
    'lastPregnancyDate','offspringCount','isStudAnimal','availableForBreeding',
    'studFeeCurrency','studFeeAmount','fertilityStatus','fertilityNotes',
    'isDamAnimal','damFertilityStatus','damFertilityNotes','estrusCycleLength',
    'gestationLength','artificialInseminationUsed','whelpingDate','queeningDate',
    'deliveryMethod','reproductiveComplications','reproductiveClearances','breedingRecords',
    'isForSale','salePriceCurrency','salePriceAmount','isInfertile',
    'vaccinations','dewormingRecords','parasiteControl','medicalConditions','allergies',
    'medications','medicalProcedures','labResults','vetVisits','primaryVet',
    'spayNeuterDate','parasitePreventionSchedule','heartwormStatus','hipElbowScores',
    'geneticTestResults','eyeClearance','cardiacClearance','dentalRecords','chronicConditions',
    'dietType','feedingSchedule','supplements','housingType','enclosureId',
    'bedding','temperatureRange','humidity','lighting','noise','enrichment',
    'exerciseRequirements','dailyExerciseMinutes','groomingNeeds','sheddingLevel',
    'crateTrained','litterTrained','leashTrained','freeFlightTrained',
    'temperament','handlingTolerance','socialStructure','activityCycle',
    'trainingLevel','trainingDisciplines','certifications','workingRole',
    'behavioralIssues','biteHistory','reactivityNotes',
    'showTitles','showRatings','judgeComments','workingTitles','performanceScores',
    'causeOfDeath','necropsyResults','insurance','legalStatus','endOfLifeCareNotes',
    'coOwnership','transferHistory','breedingRestrictions','exportRestrictions',
    'growthRecords','measurementUnits','inbreedingCoefficient',
    'showOnPublicProfile','isDisplay','includeRemarks','includeGeneticCode',
]);

const LITTER_SAFE = new Set([
    'litter_id_public','breedingPairCodeName',
    'sireId_public','sirePrefixName','damId_public','damPrefixName',
    'breedingMethod','breedingConditionAtTime','matingDate','expectedDueDate','outcome',
    'birthDate','birthMethod','litterSizeBorn','litterSizeWeaned','stillbornCount',
    'weaningDate','maleCount','femaleCount','unknownCount',
    'offspringIds_public','inbreedingCoefficient','notes','isPlanned',
]);

const ENCLOSURE_SAFE = new Set([
    'name','enclosureType','size','notes','cleaningTasks',
]);

const SUPPLY_SAFE = new Set([
    'name','category','currentStock','unit','reorderThreshold','notes',
    'isFeederAnimal','feederType','feederSize','costPerUnit',
    'nextOrderDate','orderFrequency','orderFrequencyUnit',
]);

const BUDGET_SAFE = new Set([
    'type','animalId','animalName','price','date',
    'buyer','seller','category','description','notes',
]);

function sanitise(record, allowedFields) {
    const out = {};
    for (const key of allowedFields) {
        if (record[key] !== undefined && record[key] !== '') {
            out[key] = record[key];
        }
    }
    return out;
}

// ─── POST /api/import ─────────────────────────────────────────────────────────
//
// First call (dry-run):
//   multipart body: { file }
//   Returns: { preview: { animals: {total,new,conflicts}, ... } }
//
// Second call (confirm):
//   multipart body: { file, confirm: 'true', conflictResolutions: JSON string }
//   conflictResolutions: { animals: { 'CTC1001': 'skip'|'overwrite'|'createNew' }, litters: {...}, enclosures: {...}, supplies: {...} }
//   Returns: { written: {...}, skipped: {...}, errors: [...] }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Attach a .json or .zip file as multipart field "file".' });
    }

    let importData;
    try {
        importData = await parseUpload(req.file.buffer, req.file.originalname);
    } catch (err) {
        return res.status(400).json({ message: `Could not parse file: ${err.message}` });
    }

    const userId = req.user.id;
    const confirm = req.body.confirm === 'true';
    let conflictResolutions = {};
    if (req.body.conflictResolutions) {
        try {
            conflictResolutions = JSON.parse(req.body.conflictResolutions);
        } catch {
            return res.status(400).json({ message: 'conflictResolutions is not valid JSON.' });
        }
    }

    // ── Fetch existing IDs for conflict detection ────────────────────────────
    const [existingAnimals, existingLitters, existingEnclosures, existingSupplies] = await Promise.all([
        importData.animals ? Animal.find({ ownerId: userId }).select('id_public name').lean() : Promise.resolve([]),
        importData.litters ? Litter.find({ ownerId: userId }).select('litter_id_public breedingPairCodeName').lean() : Promise.resolve([]),
        importData.enclosures ? Enclosure.find({ ownerId: userId }).select('name').lean() : Promise.resolve([]),
        importData.supplies ? SupplyItem.find({ userId: userId }).select('name').lean() : Promise.resolve([]),
    ]);

    const existingAnimalIds = new Map(existingAnimals.map(a => [a.id_public, a]));
    const existingLitterIds = new Map(existingLitters.map(l => [l.litter_id_public, l]));
    const existingEnclosureNames = new Map(existingEnclosures.map(e => [e.name?.toLowerCase(), e]));
    const existingSupplyNames = new Map(existingSupplies.map(s => [s.name?.toLowerCase(), s]));

    // ── DRY RUN ──────────────────────────────────────────────────────────────
    if (!confirm) {
        const preview = {};

        if (importData.animals) {
            const records = Array.isArray(importData.animals) ? importData.animals : [];
            const conflicts = records
                .filter(a => a.id_public && existingAnimalIds.has(a.id_public))
                .map(a => ({ id_public: a.id_public, name: a.name || '(unnamed)' }));
            preview.animals = { total: records.length, new: records.length - conflicts.length, conflicts };
        }

        if (importData.litters) {
            const records = Array.isArray(importData.litters) ? importData.litters : [];
            const conflicts = records
                .filter(l => l.litter_id_public && existingLitterIds.has(l.litter_id_public))
                .map(l => ({ litter_id_public: l.litter_id_public, name: l.breedingPairCodeName || '(unnamed)' }));
            preview.litters = { total: records.length, new: records.length - conflicts.length, conflicts };
        }

        if (importData.enclosures) {
            const records = Array.isArray(importData.enclosures) ? importData.enclosures : [];
            const conflicts = records
                .filter(e => e.name && existingEnclosureNames.has(e.name.toLowerCase()))
                .map(e => ({ name: e.name }));
            preview.enclosures = { total: records.length, new: records.length - conflicts.length, conflicts };
        }

        if (importData.supplies) {
            const records = Array.isArray(importData.supplies) ? importData.supplies : [];
            const conflicts = records
                .filter(s => s.name && existingSupplyNames.has(s.name.toLowerCase()))
                .map(s => ({ name: s.name }));
            preview.supplies = { total: records.length, new: records.length - conflicts.length, conflicts };
        }

        if (importData.budget) {
            const records = Array.isArray(importData.budget) ? importData.budget : [];
            preview.budget = { total: records.length, new: records.length, conflicts: [] };
        }

        return res.json({ preview });
    }

    // ── CONFIRM WRITE ────────────────────────────────────────────────────────
    const written = {};
    const skipped = {};
    const errors = [];

    // Helper: resolve action for a record
    const resolveAction = (section, key) => {
        return (conflictResolutions[section] && conflictResolutions[section][key]) || 'skip';
    };

    // ── Animals ──────────────────────────────────────────────────────────────
    if (importData.animals) {
        const records = Array.isArray(importData.animals) ? importData.animals : [];
        written.animals = 0;
        skipped.animals = 0;

        for (const raw of records) {
            const rec = sanitise(raw, ANIMAL_SAFE);
            if (!rec.name || !rec.species) {
                errors.push({ section: 'animals', id: raw.id_public || '?', error: 'Missing required fields: name, species' });
                continue;
            }

            try {
                const isConflict = raw.id_public && existingAnimalIds.has(raw.id_public);

                if (!isConflict) {
                    // New animal — assign fresh id_public if not provided or already exists
                    if (!raw.id_public) rec.id_public = await getNextSequence('animalId');
                    else rec.id_public = raw.id_public;
                    rec.ownerId = userId;
                    rec.ownerId_public = req.user.id_public || '';
                    await Animal.create(rec);
                    written.animals++;
                } else {
                    const action = resolveAction('animals', raw.id_public);
                    if (action === 'skip') {
                        skipped.animals++;
                    } else if (action === 'overwrite') {
                        await Animal.updateOne({ id_public: raw.id_public, ownerId: userId }, { $set: rec });
                        written.animals++;
                    } else if (action === 'createNew') {
                        const newId = await getNextSequence('animalId');
                        rec.id_public = newId;
                        rec.ownerId = userId;
                        rec.ownerId_public = req.user.id_public || '';
                        delete rec.sireId_public; // lineage refs may be stale
                        delete rec.damId_public;
                        await Animal.create(rec);
                        written.animals++;
                    }
                }
            } catch (err) {
                errors.push({ section: 'animals', id: raw.id_public || raw.name || '?', error: err.message });
            }
        }
    }

    // ── Litters ──────────────────────────────────────────────────────────────
    if (importData.litters) {
        const records = Array.isArray(importData.litters) ? importData.litters : [];
        written.litters = 0;
        skipped.litters = 0;

        for (const raw of records) {
            const rec = sanitise(raw, LITTER_SAFE);
            try {
                const isConflict = raw.litter_id_public && existingLitterIds.has(raw.litter_id_public);

                if (!isConflict) {
                    if (!raw.litter_id_public) rec.litter_id_public = await getNextSequence('litterId');
                    else rec.litter_id_public = raw.litter_id_public;
                    rec.ownerId = userId;
                    await Litter.create(rec);
                    written.litters++;
                } else {
                    const action = resolveAction('litters', raw.litter_id_public);
                    if (action === 'skip') {
                        skipped.litters++;
                    } else if (action === 'overwrite') {
                        await Litter.updateOne({ litter_id_public: raw.litter_id_public, ownerId: userId }, { $set: rec });
                        written.litters++;
                    } else if (action === 'createNew') {
                        rec.litter_id_public = await getNextSequence('litterId');
                        rec.ownerId = userId;
                        await Litter.create(rec);
                        written.litters++;
                    }
                }
            } catch (err) {
                errors.push({ section: 'litters', id: raw.litter_id_public || '?', error: err.message });
            }
        }
    }

    // ── Enclosures ───────────────────────────────────────────────────────────
    if (importData.enclosures) {
        const records = Array.isArray(importData.enclosures) ? importData.enclosures : [];
        written.enclosures = 0;
        skipped.enclosures = 0;

        for (const raw of records) {
            const rec = sanitise(raw, ENCLOSURE_SAFE);
            if (!rec.name?.trim()) {
                errors.push({ section: 'enclosures', id: raw.name || '?', error: 'Missing required field: name' });
                continue;
            }
            try {
                const isConflict = existingEnclosureNames.has(rec.name.toLowerCase());
                if (!isConflict) {
                    rec.ownerId = userId;
                    await Enclosure.create(rec);
                    written.enclosures++;
                } else {
                    const action = resolveAction('enclosures', rec.name);
                    if (action === 'skip') {
                        skipped.enclosures++;
                    } else if (action === 'overwrite') {
                        await Enclosure.updateOne({ ownerId: userId, name: rec.name }, { $set: rec });
                        written.enclosures++;
                    } else if (action === 'createNew') {
                        rec.name = `${rec.name} (imported)`;
                        rec.ownerId = userId;
                        await Enclosure.create(rec);
                        written.enclosures++;
                    }
                }
            } catch (err) {
                errors.push({ section: 'enclosures', id: raw.name || '?', error: err.message });
            }
        }
    }

    // ── Supplies ─────────────────────────────────────────────────────────────
    if (importData.supplies) {
        const records = Array.isArray(importData.supplies) ? importData.supplies : [];
        written.supplies = 0;
        skipped.supplies = 0;

        for (const raw of records) {
            const rec = sanitise(raw, SUPPLY_SAFE);
            if (!rec.name?.trim()) {
                errors.push({ section: 'supplies', id: raw.name || '?', error: 'Missing required field: name' });
                continue;
            }
            try {
                const isConflict = existingSupplyNames.has(rec.name.toLowerCase());
                if (!isConflict) {
                    rec.userId = userId;
                    await SupplyItem.create(rec);
                    written.supplies++;
                } else {
                    const action = resolveAction('supplies', rec.name);
                    if (action === 'skip') {
                        skipped.supplies++;
                    } else if (action === 'overwrite') {
                        await SupplyItem.updateOne({ userId, name: rec.name }, { $set: rec });
                        written.supplies++;
                    } else if (action === 'createNew') {
                        rec.name = `${rec.name} (imported)`;
                        rec.userId = userId;
                        await SupplyItem.create(rec);
                        written.supplies++;
                    }
                }
            } catch (err) {
                errors.push({ section: 'supplies', id: raw.name || '?', error: err.message });
            }
        }
    }

    // ── Budget ───────────────────────────────────────────────────────────────
    // Transactions are always appended; no conflict detection.
    if (importData.budget) {
        const records = Array.isArray(importData.budget) ? importData.budget : [];
        written.budget = 0;

        for (const raw of records) {
            const rec = sanitise(raw, BUDGET_SAFE);
            if (!rec.type || !rec.date) {
                errors.push({ section: 'budget', id: '?', error: 'Missing required fields: type, date' });
                continue;
            }
            try {
                rec.userId = userId;
                await Transaction.create(rec);
                written.budget++;
            } catch (err) {
                errors.push({ section: 'budget', id: `${raw.type}/${raw.date}`, error: err.message });
            }
        }
    }

    return res.json({ success: true, written, skipped, errors });
});

module.exports = router;
