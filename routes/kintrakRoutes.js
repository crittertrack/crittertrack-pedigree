const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Animal, Litter } = require('../database/models');
const { getNextSequence } = require('../database/db_service');

// ─── Multer: accept up to 2 CSV files in memory ───────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = (file.originalname || '').split('.').pop().toLowerCase();
        if (ext === 'csv') return cb(null, true);
        cb(new Error('Only .csv files are accepted'));
    },
});

// ─── Kintraks CSV parser ──────────────────────────────────────────────────────
// Kintraks exports use standard comma-delimited RFC 4180 CSV with double-quote
// escaping. The animals export has duplicate "Breeder" column headers — the
// parser renames them Breeder, Breeder_2, Breeder_3.

function parseKintrakCSV(buffer) {
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
                if (text[i + 1] === '"') { field += '"'; i++; }
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
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);

    if (rows.length < 2) return [];

    // Handle duplicate column names by appending _2, _3, etc.
    const headerCounts = {};
    const headers = rows[0].map(h => {
        h = (h || '').trim();
        if (!headerCounts[h]) {
            headerCounts[h] = 1;
            return h;
        } else {
            headerCounts[h]++;
            return `${h}_${headerCounts[h]}`;
        }
    });

    return rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = (r[i] !== undefined ? r[i] : '').trim();
        });
        return obj;
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strip tracking characters the user added (⭐ stars, ❤️ hearts variants).
function cleanName(str) {
    if (!str) return '';
    return str.replace(/[⭐❤️★♥💙💚💛🧡💜🖤🤍🤎💗💕💞💓💘💝]/g, '').trim();
}

// Strip trailing " (XX)" kennel abbreviation used in Kintraks breeding records.
// e.g. "Zodiac (MM)" → "Zodiac", "Rocky Road⭐ (PvK)" → "Rocky Road"
function stripKennel(str) {
    return str.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// Parse dates. Kintraks animals use YYYY-MM-DD; breeding records use DD/MM/YYYY
// (slash-separated). "Born DD/MM/YYYY" in the Due column is handled by callers
// stripping the "Born " prefix before passing here.
function parseKintrakDate(str, format) {
    if (!str || str.trim() === '') return null;
    const s = str.trim();
    let iso;
    if (format === 'DD/MM/YYYY') {
        const parts = s.split('/');
        if (parts.length !== 3) return null;
        const [d, m, y] = parts;
        if (!d || !m || !y || y.length < 4) return null;
        iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
        if (s === '0000-00-00' || s === '0') return null;
        iso = s;
    }
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
}

// Parse Kintraks litter count string: "4 Male, 3 Female, 2 Undefined"
function parseKintrakLitterCounts(str) {
    if (!str || str.trim() === '') {
        return { maleCount: null, femaleCount: null, unknownCount: null, litterSizeBorn: null };
    }
    const maleMatch = str.match(/(\d+)\s+Male/i);
    const femaleMatch = str.match(/(\d+)\s+Female/i);
    const unknownMatch = str.match(/(\d+)\s+Undefined/i);
    const m = maleMatch ? parseInt(maleMatch[1]) : null;
    const f = femaleMatch ? parseInt(femaleMatch[1]) : null;
    const u = unknownMatch ? parseInt(unknownMatch[1]) : null;
    const total = (m || 0) + (f || 0) + (u || 0);
    return {
        maleCount: m,
        femaleCount: f,
        unknownCount: u,
        litterSizeBorn: total > 0 ? total : null,
    };
}

// Assemble genetic code from individual Kintraks locus columns (same trait set as ZooEasy).
function assembleKintrakGeneticCode(row) {
    const locusCols = ['A Locus', 'B Locus', 'C Locus', 'D Locus', 'E Locus', 'P Locus', 'Pied', 'DWS', 'Splashed', 'Merle', 'Longhair', 'Satin', 'Rex', 'Rosette'];
    const parts = locusCols.map(c => (row[c] || '').trim()).filter(v => v && v !== '0' && v !== 'False' && v !== 'false');
    return parts.length ? parts.join(' ') : null;
}

// ─── Row transformers ─────────────────────────────────────────────────────────

function transformKintrakAnimalRow(row, species) {
    const rawName = cleanName((row['Name'] || '').trim());
    const rawCallName = cleanName((row['Call Name'] || '').trim());
    const rawRegistration = (row['Registration'] || '').trim();
    // Only use Call Name if it's non-empty, different from Name, and different from Registration
    const effectiveCallName = (rawCallName && rawCallName !== rawName && rawCallName !== rawRegistration) ? rawCallName : '';
    const rawPrefix = (row['Prefix'] || '').trim();
    const rawSuffix = (row['Suffix'] || '').trim();

    // Full name: Name + Call Name (if meaningful — not blank, not same as Name, not same as Registration)
    const nameParts = [rawName, effectiveCallName].filter(Boolean);
    const name = nameParts.join(' ') || '(unnamed)';

    const nameVariants = [...new Set([
        rawName,
        effectiveCallName,
        name,
        [rawPrefix, rawName].filter(Boolean).join(' '),
        [rawName, rawSuffix].filter(Boolean).join(' '),
        [rawPrefix, rawName, rawSuffix].filter(Boolean).join(' '),
    ].filter(Boolean))];

    const gender = row['Sex'] === 'male' ? 'Male' : row['Sex'] === 'female' ? 'Female' : 'Unknown';
    const birthDate = parseKintrakDate(row['Dob'], 'YYYY-MM-DD');
    const isDeceased = row['Deceased'] === 'True';
    const deceasedDate = isDeceased ? parseKintrakDate(row['Date Deceased'], 'YYYY-MM-DD') : null;

    const inbreedingRaw = parseFloat(row['Coi']);
    const geneticCode = assembleKintrakGeneticCode(row);

    // manualBreederName: combine Breeder (col 13) and Breeder_3 (col 44) if both
    // exist and differ. Breeder_2 is a True/False checkbox — ignored.
    const breeder1 = (row['Breeder']   || '').trim();
    const breeder3 = (row['Breeder_3'] || '').trim();
    let manualBreederName = null;
    if (breeder1 && breeder3 && breeder1 !== breeder3) {
        manualBreederName = `${breeder1} / ${breeder3}`;
    } else {
        manualBreederName = breeder1 || breeder3 || null;
    }

    // Remarks: notes + owner info
    const remarksParts = [];
    if ((row['Notes'] || '').trim()) remarksParts.push(row['Notes'].trim());
    const ownerStr = (row['Owner'] || '').trim();
    if (ownerStr) remarksParts.push(`Owner: ${ownerStr}`);

    // Sire/dam names from the animals CSV (for parent lookup fallback)
    const sireName = cleanName((row['Sire'] || '').trim());
    const damName = cleanName((row['Dam'] || '').trim());

    return {
        // Private: internal Kintraks IDs + registration for parent resolution
        _kintrakId: (row['Id'] || '').trim(),
        _fatherKintrakId: (row['Fatherid'] || '').trim(),
        _motherKintrakId: (row['Motherid'] || '').trim(),
        _registration: (row['Registration'] || '').trim(),
        _nameVariants: nameVariants,
        _prefixForDupe: rawPrefix || null,
        _suffixForDupe: rawSuffix || null,
        _sireName: sireName,
        _damName: damName,

        // CritterTrack fields
        breederAssignedId: (row['Registration'] || '').trim() || null,
        name,
        prefix: rawPrefix || null,
        suffix: rawSuffix || null,
        gender,
        species,
        color: (row['Colour'] || '').trim() || null,
        coat: (row['Breed'] || '').trim() || null,
        birthDate,
        deceasedDate: deceasedDate || null,
        causeOfDeath: (row['Deceased Reason'] || '').trim() || null,
        status: isDeceased ? 'Deceased' : 'Pet',
        manualBreederName,
        microchipNumber: (row['Microchip'] || '').trim() || null,
        inbreedingCoefficient: isNaN(inbreedingRaw) ? null : inbreedingRaw,
        geneticCode: geneticCode || null,
        remarks: remarksParts.join('\n') || null,
        isOwned: true,
    };
}

function transformKintrakLitterRow(row) {
    // Rows with empty sire AND dam are artifact duplicates — skip them
    if (!(row['Sire'] || '').trim() && !(row['Dam'] || '').trim()) return null;

    const rawSire = (row['Sire'] || '').trim();
    const rawDam = (row['Dam'] || '').trim();

    // Clean name: strip ⭐/❤️ markers
    const cleanSireName = cleanName(rawSire);
    const cleanDamName  = cleanName(rawDam);

    // Extract kennel abbreviation from "(XX)" suffix and use it as prefix
    const sireKennelMatch = cleanSireName.match(/\(([^)]+)\)\s*$/);
    const damKennelMatch  = cleanDamName.match(/\(([^)]+)\)\s*$/);
    const sirePrefix = sireKennelMatch ? sireKennelMatch[1] : null;
    const damPrefix  = damKennelMatch  ? damKennelMatch[1]  : null;

    // Clean name without kennel suffix
    const cleanSire = stripKennel(cleanSireName);
    const cleanDam  = stripKennel(cleanDamName);

    const matingDate  = parseKintrakDate(row['Mated'], 'DD/MM/YYYY');
    const weaningDate = parseKintrakDate(row['Wean'],  'DD/MM/YYYY');

    // Due column: "Born DD/MM/YYYY"
    let birthDate = null;
    const dueRaw = (row['Due'] || '').trim();
    if (dueRaw.startsWith('Born ')) {
        birthDate = parseKintrakDate(dueRaw.slice(5), 'DD/MM/YYYY');
    } else if (dueRaw) {
        birthDate = parseKintrakDate(dueRaw, 'DD/MM/YYYY');
    }

    const counts = parseKintrakLitterCounts(row['Details'] || '');

    // Nest letter from Notes column, stripping ❤️ and similar hearts
    const nestLetter = cleanName((row['Notes'] || '')).trim() || null;

    // Name variants for parent CT lookup (most specific first)
    // Include prefix-stripped name, full cleaned name, and prefix variant
    const sireVariants = [...new Set([
        cleanSire,
        cleanSireName,
        sirePrefix ? `${sirePrefix} ${cleanSire}` : null,
    ].filter(Boolean))];
    const damVariants = [...new Set([
        cleanDam,
        cleanDamName,
        damPrefix ? `${damPrefix} ${cleanDam}` : null,
    ].filter(Boolean))];

    return {
        _sireRawName:       rawSire    || null,
        _damRawName:        rawDam     || null,
        _sireCleanName:     cleanSire  || null,
        _damCleanName:      cleanDam   || null,
        _sirePrefix:        sirePrefix || null,
        _damPrefix:         damPrefix  || null,
        _sireNameVariants:  sireVariants,
        _damNameVariants:   damVariants,

        matingDate:           matingDate  || null,
        birthDate:            birthDate   || null,
        weaningDate:          weaningDate || null,
        isPlanned:            !birthDate,
        outcome:              birthDate ? 'Successful' : 'Unknown',
        breedingPairCodeName: nestLetter,
        maleCount:            counts.maleCount,
        femaleCount:          counts.femaleCount,
        unknownCount:         counts.unknownCount,
        litterSizeBorn:       counts.litterSizeBorn,
        notes:                String(row['Notes'] || '').trim(),
    };
}

// ─── Duplicate detection helpers (mirrors zooeasyRoutes.js) ──────────────────

async function findGlobalDuplicate(regNum, nameVariants, birthDate, userId, species, prefixForDupe) {
    // Primary: exact breederAssignedId match
    if (regNum) {
        const byId = await Animal.findOne({ breederAssignedId: regNum })
            .select('id_public name ownerId_public breederAssignedId birthDate')
            .lean();
        if (byId) return { match: byId, matchType: 'id', confidence: 'high' };
    }
    // Secondary: name + birthDate
    if (birthDate && nameVariants?.length) {
        const start = new Date(birthDate); start.setHours(0, 0, 0, 0);
        const end   = new Date(birthDate); end.setHours(23, 59, 59, 999);
        for (const n of nameVariants) {
            const byName = await Animal.findOne({ name: n, birthDate: { $gte: start, $lte: end } })
                .select('id_public name ownerId_public breederAssignedId birthDate').lean();
            if (byName) return { match: byName, matchType: 'name+birthDate', confidence: 'high' };
        }
        if (prefixForDupe && nameVariants[0]) {
            const byPfx = await Animal.findOne({ prefix: prefixForDupe, name: nameVariants[0], birthDate: { $gte: start, $lte: end } })
                .select('id_public name ownerId_public breederAssignedId birthDate').lean();
            if (byPfx) return { match: byPfx, matchType: 'name+birthDate', confidence: 'high' };
        }
    }
    // Tertiary: name-only — own animals first, then global
    if (nameVariants?.length) {
        const speciesFilter = species ? { species } : {};
        for (const n of nameVariants) {
            const own = await Animal.findOne({ name: n, ownerId: userId, ...speciesFilter })
                .select('id_public name ownerId_public breederAssignedId birthDate').lean();
            if (own) return { match: own, matchType: 'name_only', confidence: 'high' };
        }
        if (prefixForDupe && nameVariants[0]) {
            const ownByPfx = await Animal.findOne({ prefix: prefixForDupe, name: nameVariants[0], ownerId: userId })
                .select('id_public name ownerId_public breederAssignedId birthDate').lean();
            if (ownByPfx) return { match: ownByPfx, matchType: 'name_only', confidence: 'high' };
        }
        for (const n of nameVariants) {
            const global = await Animal.findOne({ name: n, ...speciesFilter })
                .select('id_public name ownerId_public breederAssignedId birthDate').lean();
            if (global) return { match: global, matchType: 'name_only', confidence: 'possible' };
        }
    }
    return null;
}

// Find a CT animal for a parent link.
// Strategies: (1) breederAssignedId exact, (2) name variant exact, (3) case-insensitive regex.
async function findParentCT(regNum, nameVariants) {
    if (regNum) {
        const byId = await Animal.findOne({ breederAssignedId: regNum })
            .select('id_public name prefix suffix').lean();
        if (byId) return { id_public: byId.id_public, name: [byId.prefix, byId.name, byId.suffix].filter(Boolean).join(' ') };
    }
    if (nameVariants?.length) {
        for (const n of nameVariants) {
            if (!n) continue;
            const byName = await Animal.findOne({ name: n })
                .select('id_public name prefix suffix').lean();
            if (byName) return { id_public: byName.id_public, name: [byName.prefix, byName.name, byName.suffix].filter(Boolean).join(' ') };
        }
        const longest = [...nameVariants].sort((a, b) => b.length - a.length)[0];
        if (longest) {
            const byRegex = await Animal.findOne({ name: { $regex: `^${longest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
                .select('id_public name prefix suffix').lean();
            if (byRegex) return { id_public: byRegex.id_public, name: [byRegex.prefix, byRegex.name, byRegex.suffix].filter(Boolean).join(' ') };
        }
    }
    return null;
}

// ─── POST /api/import/kintraks ────────────────────────────────────────────────
//
// Multipart form fields:
//   animals            - Kintraks animal export CSV (optional)
//   breedingrecords    - Kintraks "Breeding Record - All Records" CSV (optional)
//   species            - Species name string (required when importing animals)
//   confirm            - 'true' to write to DB; omit for a dry-run preview
//   conflictResolutions - JSON string: { "Registration": "skip"|"import_anyway"|"map_to:CTC..." }
//   selectedAnimals    - JSON array of Registration strings (animals to import)
//   selectedLitters    - JSON array of litter indices (numbers)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.fields([
    { name: 'animals', maxCount: 1 },
    { name: 'breedingrecords', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files || {};
    if (!files.animals && !files.breedingrecords) {
        return res.status(400).json({ message: 'No files uploaded. Attach animals and/or breedingrecords CSV files.' });
    }

    const userId  = req.user.id;
    const confirm = req.body.confirm === 'true';
    const species = (req.body.species || '').trim();

    if (files.animals && !species) {
        return res.status(400).json({ message: 'species is required when importing animals.' });
    }

    let conflictResolutions = {};
    if (req.body.conflictResolutions) {
        try { conflictResolutions = JSON.parse(req.body.conflictResolutions); }
        catch { return res.status(400).json({ message: 'conflictResolutions is not valid JSON.' }); }
    }

    let litterMappingsParam = {};
    if (req.body.litterMappings) {
        try { litterMappingsParam = JSON.parse(req.body.litterMappings); }
        catch { /* ignore malformed, just use auto */ }
    }

    let animalRows = [];
    let litterRows = [];
    try {
        if (files.animals)        animalRows = parseKintrakCSV(files.animals[0].buffer);
        if (files.breedingrecords) litterRows = parseKintrakCSV(files.breedingrecords[0].buffer);
    } catch (err) {
        return res.status(400).json({ message: `Failed to parse CSV: ${err.message}` });
    }

    const transformedAnimals = animalRows.map(row => transformKintrakAnimalRow(row, species));
    // Filter out null rows (empty sire+dam rows from breeding records)
    const transformedLitters = litterRows
        .map(row => transformKintrakLitterRow(row))
        .filter(Boolean);

    // Build a lookup: Kintraks Id → Registration (for parent ID resolution in animals)
    const kintrakIdToReg = new Map();
    for (const a of transformedAnimals) {
        if (a._kintrakId) kintrakIdToReg.set(a._kintrakId, a._registration);
    }

    // ── DRY RUN ───────────────────────────────────────────────────────────────
    if (!confirm) {
        const preview = {};

        if (transformedAnimals.length) {
            // ── Batched duplicate detection (avoids N individual queries) ──────
            // Step 1: single $in query for all registration numbers
            const allRegNums = transformedAnimals.map(a => a._registration).filter(Boolean);
            const byRegMap = new Map(); // regNum → CT animal
            if (allRegNums.length) {
                const byReg = await Animal.find({ breederAssignedId: { $in: allRegNums } })
                    .select('id_public name prefix ownerId_public breederAssignedId birthDate').lean();
                for (const doc of byReg) byRegMap.set(doc.breederAssignedId, doc);
            }

            // Step 2: single $in query for all unique cleaned names (covers name+birthDate and name-only)
            const allNames = [...new Set(transformedAnimals.flatMap(a => a._nameVariants))].filter(Boolean);
            const byNameMap = new Map(); // name → [CT animals]
            if (allNames.length) {
                const byName = await Animal.find({ name: { $in: allNames } })
                    .select('id_public name prefix ownerId_public breederAssignedId birthDate').lean();
                for (const doc of byName) {
                    if (!byNameMap.has(doc.name)) byNameMap.set(doc.name, []);
                    byNameMap.get(doc.name).push(doc);
                }
            }

            // Step 3: resolve conflicts using pre-fetched maps
            const conflicts = [];
            for (const a of transformedAnimals) {
                let hit = null;

                // Primary: name + birthDate → definitive duplicate
                if (a.birthDate && a._nameVariants?.length) {
                    const ts = a.birthDate.getTime?.() ?? new Date(a.birthDate).getTime();
                    for (const n of a._nameVariants) {
                        const docs = byNameMap.get(n) || [];
                        for (const doc of docs) {
                            if (doc.birthDate && Math.abs(new Date(doc.birthDate).getTime() - ts) < 86400000) {
                                hit = { match: doc, matchType: 'name+birthDate', confidence: 'high' };
                                break;
                            }
                        }
                        if (hit) break;
                    }
                }

                // Secondary: registration number → possible match
                if (!hit && a._registration && byRegMap.has(a._registration)) {
                    hit = { match: byRegMap.get(a._registration), matchType: 'id', confidence: 'possible' };
                }

                // Tertiary: name-only → possible match (prefer same prefix, then own animal)
                if (!hit && a._nameVariants?.length) {
                    for (const n of a._nameVariants) {
                        const docs = byNameMap.get(n) || [];
                        if (docs.length) {
                            const samePrefix = a._prefixForDupe && docs.find(d => d.prefix === a._prefixForDupe);
                            const own = docs.find(d => String(d.ownerId_public) === String(req.user.id_public));
                            hit = { match: samePrefix || own || docs[0], matchType: 'name_only', confidence: 'possible' };
                            break;
                        }
                    }
                }

                if (hit) {
                    conflicts.push({
                        kintrakId:         a._kintrakId,
                        registration:      a._registration,
                        name:              a.name,
                        matchType:         hit.matchType,
                        confidence:        hit.confidence,
                        existingId:        hit.match.id_public,
                        existingOwner:     hit.match.ownerId_public,
                        existingPrefix:    hit.match.prefix || null,
                        existingName:      hit.match.name,
                        existingBirthDate: hit.match.birthDate ? String(hit.match.birthDate).slice(0, 10) : null,
                        isOwnedByImporter: String(hit.match.ownerId_public) === String(req.user.id_public),
                    });
                }
            }
            const conflictKeys = new Set(conflicts.map(c => c.registration || c.kintrakId).filter(Boolean));
            preview.animals = {
                total: transformedAnimals.length,
                new:   transformedAnimals.length - conflicts.length,
                conflicts,
                items: transformedAnimals.map(a => ({
                    kintrakId:   a._kintrakId,
                    registration: a._registration,
                    name:        a.name,
                    prefix:      a.prefix || null,
                    suffix:      a.suffix || null,
                    gender:      a.gender,
                    birthDate:   a.birthDate,
                    color:       a.color,
                    coat:        a.coat,
                    sireKintrakId: a._fatherKintrakId || null,
                    damKintrakId:  a._motherKintrakId || null,
                    isDuplicate: conflictKeys.has(a._registration || a._kintrakId),
                })),
            };
        }

        if (transformedLitters.length) {
            // Seed cache with animals from this batch so preview can show "in this import"
            const parentCache = new Map();
            for (const a of transformedAnimals) {
                if (a._kintrakId) {
                    const entry = { id_public: null, name: [a.prefix, a.name, a.suffix].filter(Boolean).join(' '), _inThisImport: true };
                    parentCache.set(`__kinid__${a._kintrakId}`, entry);
                    // Also index by every name variant so litter name lookup hits the cache
                    for (const variant of (a._nameVariants || [])) {
                        if (variant) parentCache.set(`__name__${variant}`, entry);
                    }
                }
            }

            const litterItems = [];
            for (const l of transformedLitters) {
                // Resolve sire by name
                const sireCacheKey = `__name__${l._sireCleanName}`;
                let maleCtMatch = parentCache.has(sireCacheKey) ? parentCache.get(sireCacheKey) : undefined;
                if (maleCtMatch === undefined) {
                    maleCtMatch = await findParentCT(null, l._sireNameVariants);
                    parentCache.set(sireCacheKey, maleCtMatch);
                }
                // Resolve dam by name
                const damCacheKey = `__name__${l._damCleanName}`;
                let femaleCtMatch = parentCache.has(damCacheKey) ? parentCache.get(damCacheKey) : undefined;
                if (femaleCtMatch === undefined) {
                    femaleCtMatch = await findParentCT(null, l._damNameVariants);
                    parentCache.set(damCacheKey, femaleCtMatch);
                }

                const sireIdForDupe  = maleCtMatch?.id_public  || null;
                const damIdForDupe   = femaleCtMatch?.id_public || null;

                // Dupe detection
                let existingLitterId = null;
                const dateRange = (d) => {
                    const s = new Date(d); s.setHours(0, 0, 0, 0);
                    const e = new Date(d); e.setHours(23, 59, 59, 999);
                    return { $gte: s, $lte: e };
                };
                if (!existingLitterId && sireIdForDupe && damIdForDupe && l.birthDate) {
                    const ex = await Litter.findOne({ ownerId: userId, sireId_public: sireIdForDupe, damId_public: damIdForDupe, birthDate: dateRange(l.birthDate) }).select('litter_id_public').lean();
                    if (ex) existingLitterId = ex.litter_id_public;
                }
                if (!existingLitterId && sireIdForDupe && damIdForDupe && l.matingDate) {
                    const ex = await Litter.findOne({ ownerId: userId, sireId_public: sireIdForDupe, damId_public: damIdForDupe, matingDate: dateRange(l.matingDate) }).select('litter_id_public').lean();
                    if (ex) existingLitterId = ex.litter_id_public;
                }
                if (!existingLitterId && l.breedingPairCodeName && l.birthDate) {
                    const ex = await Litter.findOne({ ownerId: userId, breedingPairCodeName: l.breedingPairCodeName, birthDate: dateRange(l.birthDate) }).select('litter_id_public').lean();
                    if (ex) existingLitterId = ex.litter_id_public;
                }
                if (!existingLitterId && l.breedingPairCodeName && l.matingDate) {
                    const ex = await Litter.findOne({ ownerId: userId, breedingPairCodeName: l.breedingPairCodeName, matingDate: dateRange(l.matingDate) }).select('litter_id_public').lean();
                    if (ex) existingLitterId = ex.litter_id_public;
                }

                litterItems.push({
                    litterIndex:       litterItems.length,
                    sireName:          l._sireCleanName || l._sireRawName || null,
                    sirePrefix:        l._sirePrefix || null,
                    damName:           l._damCleanName  || l._damRawName  || null,
                    damPrefix:         l._damPrefix  || null,
                    maleCtId:          maleCtMatch?.id_public  || null,
                    femaleCtId:        femaleCtMatch?.id_public || null,
                    sireInThisImport:  maleCtMatch?._inThisImport   || false,
                    damInThisImport:   femaleCtMatch?._inThisImport  || false,
                    birthDate:         l.birthDate,
                    matingDate:        l.matingDate,
                    weaningDate:       l.weaningDate,
                    nestLetter:        l.breedingPairCodeName,
                    litterSizeBorn:    l.litterSizeBorn,
                    isDuplicate:       !!existingLitterId,
                    existingLitterId,
                });
            }
            preview.litters = { total: transformedLitters.length, items: litterItems };
        }

        return res.json({ preview, speciesUsed: species });
    }

    // ── CONFIRM WRITE ─────────────────────────────────────────────────────────
    const written = { animals: 0, litters: 0 };
    const skipped = { animals: 0, litters: 0 };
    const errors  = [];

    // Kintraks Id → CT id_public (populated as animals are created or found)
    const kintrakIdToIdPublic = new Map();

    const selectedSet = req.body.selectedAnimals
        ? new Set(JSON.parse(req.body.selectedAnimals))
        : null; // null = all

    const selectedLitterSet = req.body.selectedLitters
        ? new Set(JSON.parse(req.body.selectedLitters).map(Number))
        : null;

    // ── Pass 1: Create animals ─────────────────────────────────────────────────
    // Batch pre-fetch to avoid N sequential duplicate-check queries
    const confirmRegNums = transformedAnimals.map(a => a._registration).filter(Boolean);
    const confirmByRegMap = new Map();
    const confirmByNameMap = new Map();
    if (confirmRegNums.length) {
        const docs = await Animal.find({ breederAssignedId: { $in: confirmRegNums } })
            .select('id_public name ownerId_public breederAssignedId birthDate').lean();
        for (const doc of docs) confirmByRegMap.set(doc.breederAssignedId, doc);
    }
    {
        const allNames = [...new Set(transformedAnimals.flatMap(a => a._nameVariants || []))].filter(Boolean);
        if (allNames.length) {
            const docs = await Animal.find({ name: { $in: allNames } })
                .select('id_public name prefix ownerId_public breederAssignedId birthDate').lean();
            for (const doc of docs) {
                if (!confirmByNameMap.has(doc.name)) confirmByNameMap.set(doc.name, []);
                confirmByNameMap.get(doc.name).push(doc);
            }
        }
    }

    for (const animal of transformedAnimals) {
        const { _kintrakId, _fatherKintrakId, _motherKintrakId, _registration, ...rec } = animal;
        try {
            // Deselected — skip, but honour map_to for lineage
            const _aKey = _registration || _kintrakId;
            if (selectedSet && !selectedSet.has(_aKey)) {
                const res_ = conflictResolutions[_aKey] || '';
                if (res_.startsWith('map_to:')) {
                    if (_kintrakId) kintrakIdToIdPublic.set(_kintrakId, res_.slice(7));
                }
                skipped.animals++;
                continue;
            }

            // Manual map_to: skip creation, register CT ID for lineage
            const preRes = conflictResolutions[_aKey] || '';
            if (preRes.startsWith('map_to:')) {
                skipped.animals++;
                if (_kintrakId) kintrakIdToIdPublic.set(_kintrakId, preRes.slice(7));
                continue;
            }

            // Use pre-fetched batch maps — name+DOB first (definitive), then reg#, then name-only
            let hit = null;
            if (animal.birthDate && animal._nameVariants?.length) {
                const ts = animal.birthDate.getTime?.() ?? new Date(animal.birthDate).getTime();
                for (const n of animal._nameVariants) {
                    const docs = confirmByNameMap.get(n) || [];
                    for (const doc of docs) {
                        if (doc.birthDate && Math.abs(new Date(doc.birthDate).getTime() - ts) < 86400000) {
                            hit = { match: doc };
                            break;
                        }
                    }
                    if (hit) break;
                }
            }
            if (!hit && _registration && confirmByRegMap.has(_registration)) {
                hit = { match: confirmByRegMap.get(_registration) };
            }
            if (!hit && animal._nameVariants?.length) {
                for (const n of animal._nameVariants) {
                    const docs = confirmByNameMap.get(n) || [];
                    if (docs.length) {
                        const samePrefix = animal._prefixForDupe && docs.find(d => d.prefix === animal._prefixForDupe);
                        const own = docs.find(d => String(d.ownerId_public) === String(req.user.id_public));
                        hit = { match: samePrefix || own || docs[0] };
                        break;
                    }
                }
            }

            if (hit) {
                const resolution = conflictResolutions[_aKey] || 'use_existing';
                if (resolution === 'skip' || resolution === 'use_existing') {
                    skipped.animals++;
                    if (_kintrakId) kintrakIdToIdPublic.set(_kintrakId, hit.match.id_public);
                    continue;
                }
                // 'import_anyway': fall through
            }

            const id_public = await getNextSequence('animalId');
            rec.id_public    = id_public;
            rec.ownerId      = userId;
            rec.ownerId_public = req.user.id_public || '';
            await Animal.create(rec);
            written.animals++;
            if (_kintrakId) kintrakIdToIdPublic.set(_kintrakId, id_public);
        } catch (err) {
            errors.push({ section: 'animals', id: _registration || animal.name || '?', error: err.message });
        }
    }

    // ── Pass 2: Resolve sire/dam links on newly created animals ───────────────
    for (const animal of transformedAnimals) {
        const { _kintrakId, _fatherKintrakId, _motherKintrakId, _registration, _sireName, _damName } = animal;
        if (!_kintrakId) continue;
        const myIdPublic = kintrakIdToIdPublic.get(_kintrakId);
        if (!myIdPublic) continue;

        let sireIdPublic = _fatherKintrakId ? (kintrakIdToIdPublic.get(_fatherKintrakId) || null) : null;
        let damIdPublic  = _motherKintrakId ? (kintrakIdToIdPublic.get(_motherKintrakId) || null) : null;

        // CT fallback using the father's registration (from batch map) + sire name
        if (_fatherKintrakId && !sireIdPublic) {
            const fatherReg = kintrakIdToReg.get(_fatherKintrakId) || null;
            const sireVariants = _sireName ? [_sireName] : [];
            const found = await findParentCT(fatherReg, sireVariants);
            if (found) { sireIdPublic = found.id_public; kintrakIdToIdPublic.set(_fatherKintrakId, found.id_public); }
        }
        if (_motherKintrakId && !damIdPublic) {
            const motherReg = kintrakIdToReg.get(_motherKintrakId) || null;
            const damVariants = _damName ? [_damName] : [];
            const found = await findParentCT(motherReg, damVariants);
            if (found) { damIdPublic = found.id_public; kintrakIdToIdPublic.set(_motherKintrakId, found.id_public); }
        }
        if (!sireIdPublic && !damIdPublic) continue;

        try {
            const update = {};
            if (sireIdPublic) update.sireId_public = sireIdPublic;
            if (damIdPublic)  update.damId_public  = damIdPublic;
            await Animal.updateOne({ id_public: myIdPublic, ownerId: userId }, { $set: update });
        } catch (err) {
            errors.push({ section: 'animals', id: myIdPublic, error: `Lineage link failed: ${err.message}` });
        }
    }

    // ── Litters ───────────────────────────────────────────────────────────────
    for (const [litterIndex, litter] of transformedLitters.entries()) {
        // eslint-disable-next-line no-unused-vars
        const { _sireRawName, _damRawName, _sireCleanName, _damCleanName, _sirePrefix, _damPrefix, _sireNameVariants, _damNameVariants, ...rec } = litter;

        if (selectedLitterSet && !selectedLitterSet.has(litterIndex)) { skipped.litters++; continue; }

        // Resolve sire by name variants (manual mapping takes precedence)
        let sireIdPublic = null;
        const lmSire = litterMappingsParam[String(litterIndex)]?.sire;
        if (lmSire?.id_public) {
            sireIdPublic = lmSire.id_public;
        } else {
            const sireFound = await findParentCT(null, _sireNameVariants);
            if (sireFound) sireIdPublic = sireFound.id_public;
        }

        // Resolve dam by name variants (manual mapping takes precedence)
        let damIdPublic = null;
        const lmDam = litterMappingsParam[String(litterIndex)]?.dam;
        if (lmDam?.id_public) {
            damIdPublic = lmDam.id_public;
        } else {
            const damFound = await findParentCT(null, _damNameVariants);
            if (damFound) damIdPublic = damFound.id_public;
        }

        rec.sireId_public = sireIdPublic;
        rec.damId_public  = damIdPublic;

        try {
            let isDupe = false;
            const dateRange = (d) => {
                const start = new Date(d); start.setHours(0, 0, 0, 0);
                const end   = new Date(d); end.setHours(23, 59, 59, 999);
                return { $gte: start, $lte: end };
            };

            if (!isDupe && sireIdPublic && damIdPublic && rec.birthDate) {
                const e = await Litter.findOne({ ownerId: userId, sireId_public: sireIdPublic, damId_public: damIdPublic, birthDate: dateRange(rec.birthDate) }).lean();
                if (e) isDupe = true;
            }
            if (!isDupe && sireIdPublic && damIdPublic && rec.matingDate) {
                const e = await Litter.findOne({ ownerId: userId, sireId_public: sireIdPublic, damId_public: damIdPublic, matingDate: dateRange(rec.matingDate) }).lean();
                if (e) isDupe = true;
            }
            if (!isDupe && rec.breedingPairCodeName && rec.birthDate) {
                const e = await Litter.findOne({ ownerId: userId, breedingPairCodeName: rec.breedingPairCodeName, birthDate: dateRange(rec.birthDate) }).lean();
                if (e) isDupe = true;
            }
            if (!isDupe && rec.breedingPairCodeName && rec.matingDate) {
                const e = await Litter.findOne({ ownerId: userId, breedingPairCodeName: rec.breedingPairCodeName, matingDate: dateRange(rec.matingDate) }).lean();
                if (e) isDupe = true;
            }

            if (isDupe) { skipped.litters++; continue; }

            rec.litter_id_public = await getNextSequence('litterId');
            rec.ownerId = userId;
            await Litter.create(rec);
            written.litters++;
        } catch (err) {
            errors.push({ section: 'litters', id: rec.breedingPairCodeName || '?', error: err.message });
        }
    }

    return res.json({ written, skipped, errors });
  } catch (err) {
    console.error('[kintrakRoutes] Unhandled error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error during Kintraks import.' });
  }
});

module.exports = router;
