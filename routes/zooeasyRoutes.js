const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Animal, Litter } = require('../database/models');
const { getNextSequence } = require('../database/db_service');

// ─── Multer: accept up to 2 CSV files in memory ───────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        const ext = (file.originalname || '').split('.').pop().toLowerCase();
        if (ext === 'csv') return cb(null, true);
        cb(new Error('Only .csv files are accepted'));
    },
});

// ─── ZooEasy CSV parser ──────────────────────────────────────────────────────
// ZooEasy exports use semicolons as delimiters and wrap every value in triple
// double-quotes ("""value"""), which is standard RFC 4180 quoting where the
// inner "" becomes a literal " — leaving the parsed value as "value".
// After parsing we strip those surrounding quotes.

function parseZooEasyCSV(buffer) {
    // Strip UTF-8 BOM if present
    let text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
                else inQuotes = false;
            } else {
                field += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ';') {
                row.push(field); field = '';
            } else if (c === '\n') {
                row.push(field); field = '';
                rows.push(row); row = [];
            } else {
                field += c;
            }
        }
    }
    // Flush last field/row
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);

    if (rows.length < 2) return [];

    // Strip surrounding quotes left by triple-quote encoding, then trim
    const clean = (val) => {
        let v = (val || '').trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        return v.trim();
    };

    const headers = rows[0].map(clean);

    return rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = clean(r[i] !== undefined ? r[i] : '');
        });
        return obj;
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse a date string. Animals use YYYY-MM-DD, breedingpairs use DD-MM-YYYY.
function parseDate(str, format) {
    if (!str || str === '0000-00-00' || str === '0' || str.trim() === '') return null;
    let iso;
    if (format === 'DD-MM-YYYY') {
        const [d, m, y] = str.split('-');
        if (!d || !m || !y || y === '0000') return null;
        iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
        iso = str;
    }
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
}

// Parse "M.F" or "M.F.U" litter count notation
function parseLitterCounts(str) {
    if (!str || str.trim() === '' || str.trim() === '0') {
        return { maleCount: null, femaleCount: null, unknownCount: null, litterSizeBorn: null };
    }
    const parts = str.trim().split('.');
    const m = parseInt(parts[0]) || 0;
    const f = parts.length > 1 ? (parseInt(parts[1]) || 0) : 0;
    const u = parts.length > 2 ? (parseInt(parts[2]) || 0) : 0;
    const total = m + f + u;
    return {
        maleCount: m > 0 ? m : null,
        femaleCount: f > 0 ? f : null,
        unknownCount: u > 0 ? u : null,
        litterSizeBorn: total > 0 ? total : null,
    };
}

// Assemble genetic code from individual Kleur locus columns if 'Genetic Code .' is empty
function assembleGeneticCode(row) {
    const direct = row['Genetic Code .'];
    if (direct && direct.trim()) return direct.trim();

    const locusCols = [
        'Kleur A-dilute', 'Kleur B-dilute', 'Kleur C-dilute', 'Kleur D-dilute',
        'Kleur E-dilute', 'Kleur P-dilute', 'Kleur Pied', 'Kleur Splashed',
        'Kleur Variegated/Banded', 'Kleur Roan/Merle',
    ];
    const parts = locusCols.map(col => row[col]).filter(v => v && v.trim());
    return parts.length ? parts.join(' ') : null;
}

// ─── Row transformers ─────────────────────────────────────────────────────────

// Returns a CT-ready object plus private _zooEasy* keys for the resolution phase
function transformAnimalRow(row, species) {
    // Name: space-join RegistrationNumber + Name + GivenName, skipping blanks
    const nameParts = [row['RegistrationNumber'], row['Name'], row['GivenName']]
        .map(v => (v || '').trim())
        .filter(Boolean);
    const name = nameParts.join(' ') || '(unnamed)';

    // Gender: 0 = Male, 1 = Female
    const gender = row['Gender'] === '0' ? 'Male' : row['Gender'] === '1' ? 'Female' : 'Unknown';

    const birthDate = parseDate(row['Born'], 'YYYY-MM-DD');
    const deceasedDate = parseDate(row['Deceased'], 'YYYY-MM-DD');

    // Remarks: owner info + existing remarks + non-public remarks
    const remarksParts = [];
    const ownerStr = [row['OwnerName'], row['OwnerBusinessName']]
        .map(v => (v || '').trim()).filter(Boolean).join(' / ');
    if (ownerStr) remarksParts.push(`Owner: ${ownerStr}`);
    if (row['Remarks'] && row['Remarks'].trim()) remarksParts.push(row['Remarks'].trim());
    if (row['NonPublicRemarks'] && row['NonPublicRemarks'].trim()) remarksParts.push(row['NonPublicRemarks'].trim());

    const manualBreederParts = [row['BreederName'], row['BreederBusinessName']]
        .map(v => (v || '').trim()).filter(Boolean);

    const inbreedingRaw = parseFloat(row['InbreedingCoefficient']);
    const geneticCode = assembleGeneticCode(row);

    return {
        // Private: used only for duplicate detection and sire/dam resolution, not saved to DB
        _zooEasyRegNum: (row['RegistrationNumber'] || '').trim(),
        _fatherRegNum: (row['FatherRegistrationNumber'] || '').trim(),
        _motherRegNum: (row['MotherRegistrationNumber'] || '').trim(),

        // CritterTrack fields
        // Store ZooEasy RegistrationNumber in breederAssignedId so future imports
        // (from ZooEasy or any other platform) can detect this animal as a duplicate.
        breederAssignedId: (row['RegistrationNumber'] || '').trim() || null,
        name,
        prefix: row['TitleInFrontOfName'] ? row['TitleInFrontOfName'].trim() : null,
        suffix: row['TitleBehindName'] ? row['TitleBehindName'].trim() : null,
        gender,
        species,
        color: row['Color'] ? row['Color'].trim() : null,
        coat: row['Breed'] ? row['Breed'].trim() : null,
        birthDate,
        deceasedDate: deceasedDate || null,
        status: deceasedDate ? 'Deceased' : 'Pet',
        manualBreederName: manualBreederParts.join(' / ') || null,
        inbreedingCoefficient: isNaN(inbreedingRaw) ? null : inbreedingRaw,
        geneticCode: geneticCode || null,
        remarks: remarksParts.join('\n'),
        isOwned: true,
    };
}

function transformLitterRow(row) {
    const matingDate = parseDate(row['PairingDate'], 'DD-MM-YYYY');
    const birthDate = parseDate(row['LitterDate'], 'DD-MM-YYYY');
    const counts = parseLitterCounts(row['Nestinformatie Aantal jongen']);
    const inbreedingRaw = parseFloat(row['RelationshipPercentage']);

    return {
        // Private: used only for sire/dam resolution
        _maleRegNum: (row['MaleRegistrationNumber'] || '').trim(),
        _femaleRegNum: (row['FemaleRegistrationNumber'] || '').trim(),

        // CritterTrack Litter fields
        matingDate: matingDate || null,
        birthDate: birthDate || null,
        isPlanned: !birthDate,
        outcome: birthDate ? 'Successful' : 'Unknown',
        breedingPairCodeName: row['Nestinformatie Nestletter'] ? row['Nestinformatie Nestletter'].trim() : null,
        maleCount: counts.maleCount,
        femaleCount: counts.femaleCount,
        unknownCount: counts.unknownCount,
        litterSizeBorn: counts.litterSizeBorn,
        inbreedingCoefficient: isNaN(inbreedingRaw) ? null : inbreedingRaw,
        notes: row['Remarks'] ? row['Remarks'].trim() : '',
    };
}

// ─── Duplicate detection helpers ─────────────────────────────────────────────

// Primary match: breederAssignedId === ZooEasy RegistrationNumber (any owner).
// Secondary match: same name + same birthDate (±0 days) across all animals,
// catches animals manually entered in CT before this import.
// Returns the matching CT animal doc or null.
async function findGlobalDuplicate(zeRegNum, name, birthDate) {
    // Primary: exact breederAssignedId match anywhere in the DB
    if (zeRegNum) {
        const byId = await Animal.findOne({ breederAssignedId: zeRegNum })
            .select('id_public name ownerId_public breederAssignedId birthDate')
            .lean();
        if (byId) return { match: byId, matchType: 'id' };
    }
    // Secondary: name + birthDate match (only when birthDate is known)
    if (name && birthDate) {
        const start = new Date(birthDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(birthDate);
        end.setHours(23, 59, 59, 999);
        const byName = await Animal.findOne({ name, birthDate: { $gte: start, $lte: end } })
            .select('id_public name ownerId_public breederAssignedId birthDate')
            .lean();
        if (byName) return { match: byName, matchType: 'name+birthDate' };
    }
    return null;
}

// ─── POST /api/import/zooeasy ─────────────────────────────────────────────────
//
// Multipart form fields:
//   animals            - ZooEasy animals CSV file (optional)
//   breedingpairs      - ZooEasy breedingpairs CSV file (optional)
//   species            - Species name string (required if animals file is present)
//   confirm            - 'true' to write to DB; omit for a dry-run preview
//   conflictResolutions - JSON string: { "ZE_RegNum": "skip"|"import_anyway" }
//
// Dry-run returns:
//   { preview: { animals: { total, new, conflicts: [{ zeRegNum, name, matchType,
//     existingId, existingOwner }] }, litters: { total } }, speciesUsed }
//
// Confirm returns:
//   { written: { animals, litters }, skipped: { animals }, errors: [...] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.fields([
    { name: 'animals', maxCount: 1 },
    { name: 'breedingpairs', maxCount: 1 },
]), async (req, res) => {
    const files = req.files || {};
    if (!files.animals && !files.breedingpairs) {
        return res.status(400).json({ message: 'No files uploaded. Attach animals and/or breedingpairs CSV files.' });
    }

    const userId = req.user.id;
    const confirm = req.body.confirm === 'true';
    const species = (req.body.species || '').trim();

    if (files.animals && !species) {
        return res.status(400).json({ message: 'species is required when importing animals.' });
    }

    let conflictResolutions = {};
    if (req.body.conflictResolutions) {
        try {
            conflictResolutions = JSON.parse(req.body.conflictResolutions);
        } catch {
            return res.status(400).json({ message: 'conflictResolutions is not valid JSON.' });
        }
    }

    // Parse both uploaded files
    let animalRows = [];
    let litterRows = [];
    try {
        if (files.animals) animalRows = parseZooEasyCSV(files.animals[0].buffer);
        if (files.breedingpairs) litterRows = parseZooEasyCSV(files.breedingpairs[0].buffer);
    } catch (err) {
        return res.status(400).json({ message: `Failed to parse CSV: ${err.message}` });
    }

    const transformedAnimals = animalRows.map(row => transformAnimalRow(row, species));
    const transformedLitters = litterRows.map(row => transformLitterRow(row));

    // ── DRY RUN ───────────────────────────────────────────────────────────────
    if (!confirm) {
        const preview = {};

        if (transformedAnimals.length) {
            // Run global duplicate detection for every animal in the import
            const conflicts = [];
            for (const a of transformedAnimals) {
                const hit = await findGlobalDuplicate(a._zooEasyRegNum, a.name, a.birthDate);
                if (hit) {
                    conflicts.push({
                        zeRegNum: a._zooEasyRegNum,
                        name: a.name,
                        matchType: hit.matchType,         // 'id' or 'name+birthDate'
                        existingId: hit.match.id_public,  // CT id of the matching animal
                        existingOwner: hit.match.ownerId_public, // who owns it in CT
                        isOwnedByImporter: String(hit.match.ownerId_public) === String(req.user.id_public),
                    });
                }
            }
            const conflictRegNums = new Set(conflicts.map(c => c.zeRegNum));
            preview.animals = {
                total: transformedAnimals.length,
                new: transformedAnimals.length - conflicts.length,
                conflicts,
                items: transformedAnimals.map(a => ({
                    zeRegNum: a._zooEasyRegNum,
                    name: a.name,
                    gender: a.gender,
                    birthDate: a.birthDate,
                    color: a.color,
                    coat: a.coat,
                    sireRegNum: a._fatherRegNum || null,
                    damRegNum: a._motherRegNum || null,
                    isDuplicate: conflictRegNums.has(a._zooEasyRegNum),
                })),
            };
        }

        if (transformedLitters.length) {
            preview.litters = {
                total: transformedLitters.length,
                items: transformedLitters.map(l => ({
                    maleRegNum: l._maleRegNum,
                    femaleRegNum: l._femaleRegNum,
                    birthDate: l.birthDate,
                    matingDate: l.matingDate,
                    nestLetter: l.breedingPairCodeName,
                    litterSizeBorn: l.litterSizeBorn,
                })),
            };
        }

        return res.json({ preview, speciesUsed: species });
    }

    // ── CONFIRM WRITE ─────────────────────────────────────────────────────────
    const written = { animals: 0, litters: 0 };
    const skipped = { animals: 0 };
    const errors = [];

    // Map of ZooEasy RegistrationNumber → CT id_public (for sire/dam resolution).
    // Populated from both newly created animals AND pre-existing duplicates that
    // were skipped, so lineage links still resolve correctly.
    const regNumToIdPublic = new Map();

    // Parse optional list of ZooEasy reg nums the user selected for import
    const selectedSet = req.body.selectedAnimals
        ? new Set(JSON.parse(req.body.selectedAnimals))
        : null; // null = all selected

    // ── Pass 1: Create animals (with per-record conflict resolution) ──────────
    for (const animal of transformedAnimals) {
        const { _zooEasyRegNum, _fatherRegNum, _motherRegNum, ...rec } = animal;
        try {
            // If user deselected this animal, skip — but still honour map_to for lineage
            if (selectedSet && !selectedSet.has(_zooEasyRegNum)) {
                const resolution = conflictResolutions[_zooEasyRegNum] || '';
                if (resolution.startsWith('map_to:')) {
                    if (_zooEasyRegNum) regNumToIdPublic.set(_zooEasyRegNum, resolution.slice(7));
                }
                skipped.animals++;
                continue;
            }

            const hit = await findGlobalDuplicate(_zooEasyRegNum, animal.name, animal.birthDate);

            if (hit) {
                const resolution = conflictResolutions[_zooEasyRegNum] || 'use_existing';
                if (resolution === 'skip' || resolution === 'use_existing') {
                    skipped.animals++;
                    // Register existing CT id so sire/dam links from other animals resolve correctly
                    if (_zooEasyRegNum) regNumToIdPublic.set(_zooEasyRegNum, hit.match.id_public);
                    continue;
                }
                if (resolution.startsWith('map_to:')) {
                    skipped.animals++;
                    if (_zooEasyRegNum) regNumToIdPublic.set(_zooEasyRegNum, resolution.slice(7));
                    continue;
                }
                // 'import_anyway': fall through and create a new record
            }

            const id_public = await getNextSequence('animalId');
            rec.id_public = id_public;
            rec.ownerId = userId;
            rec.ownerId_public = req.user.id_public || '';
            await Animal.create(rec);
            written.animals++;
            if (_zooEasyRegNum) regNumToIdPublic.set(_zooEasyRegNum, id_public);
        } catch (err) {
            errors.push({ section: 'animals', id: _zooEasyRegNum || animal.name || '?', error: err.message });
        }
    }

    // ── Pass 2: Resolve sire/dam links on newly created animals ──────────────
    for (const animal of transformedAnimals) {
        const { _zooEasyRegNum, _fatherRegNum, _motherRegNum } = animal;
        if (!_zooEasyRegNum) continue;

        const myIdPublic = regNumToIdPublic.get(_zooEasyRegNum);
        if (!myIdPublic) continue;

        const sireIdPublic = _fatherRegNum ? regNumToIdPublic.get(_fatherRegNum) : null;
        const damIdPublic = _motherRegNum ? regNumToIdPublic.get(_motherRegNum) : null;
        if (!sireIdPublic && !damIdPublic) continue;

        try {
            const update = {};
            if (sireIdPublic) update.sireId_public = sireIdPublic;
            if (damIdPublic) update.damId_public = damIdPublic;
            // Only update animals owned by this user (skipped/existing animals are not touched)
            await Animal.updateOne({ id_public: myIdPublic, ownerId: userId }, { $set: update });
        } catch (err) {
            errors.push({ section: 'animals', id: myIdPublic, error: `Lineage link failed: ${err.message}` });
        }
    }

    // ── Litters ───────────────────────────────────────────────────────────────
    for (const litter of transformedLitters) {
        const { _maleRegNum, _femaleRegNum, ...rec } = litter;
        rec.sireId_public = _maleRegNum ? (regNumToIdPublic.get(_maleRegNum) || null) : null;
        rec.damId_public = _femaleRegNum ? (regNumToIdPublic.get(_femaleRegNum) || null) : null;
        try {
            rec.litter_id_public = await getNextSequence('litterId');
            rec.ownerId = userId;
            await Litter.create(rec);
            written.litters++;
        } catch (err) {
            errors.push({ section: 'litters', id: rec.breedingPairCodeName || '?', error: err.message });
        }
    }

    return res.json({ written, skipped, errors });
});

module.exports = router;
