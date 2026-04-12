const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { Animal } = require('../database/models');
const { getNextSequence } = require('../database/db_service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SB_BASE = 'https://www.simplebreed.com';
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
};

/** Validate + normalise a SimpleBreed profile URL or username → canonical URL */
function normaliseSbUrl(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim();
    // Accept: full URL, or just username
    const m = input.match(/(?:https?:\/\/)?(?:www\.)?simplebreed\.com\/([a-zA-Z0-9_-]+)\/?$/);
    if (m) return `${SB_BASE}/${m[1]}`;
    // Accept plain username with no slashes/dots
    if (/^[a-zA-Z0-9_-]+$/.test(input)) return `${SB_BASE}/${input}`;
    return null;
}

/** Fetch HTML from a simplebreed page */
async function fetchSbHtml(url) {
    const res = await axios.get(url, { headers: FETCH_HEADERS, timeout: 20000, maxRedirects: 5 });
    return res.data;
}

/** Async sleep helper */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Process an array in batches with concurrency limit */
async function batchAll(items, batchSize, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
        if (i + batchSize < items.length) await sleep(150);
    }
    return results;
}

/** Map simplebreed status text → CritterTrack status */
function mapStatus(raw) {
    if (!raw) return 'Pet';
    const s = raw.trim().toUpperCase();
    if (s === 'RETIRED') return 'Retired';
    if (s === 'DECEASED') return 'Deceased';
    if (s === 'BREEDER') return 'Breeder';
    if (s === 'AVAILABLE') return 'Available';
    if (s === 'SOLD') return 'Sold';
    if (s === 'PET') return 'Pet';
    if (s === 'BOOKED') return 'Booked';
    return 'Pet';
}

/** Normalise gender string */
function mapGender(raw) {
    if (!raw) return 'Unknown';
    const s = raw.trim().toLowerCase();
    if (s === 'male') return 'Male';
    if (s === 'female') return 'Female';
    return 'Unknown';
}

/** Convert YYYY/MM/DD → Date object (or null) */
function parseSbDate(str) {
    if (!str) return null;
    const m = str.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse the profile page → array of { sbId, name, birthDate, status, species }
 * The profile page lists animals grouped under species headings.
 */
function parseProfilePage(html) {
    const $ = cheerio.load(html);
    const animals = [];
    let currentSpecies = 'Unknown';

    // Walk through all text nodes and elements in document order
    $('body').find('*').addBack().contents().each((_, node) => {
        const el = $(node);
        const text = node.type === 'text' ? node.data.trim() : el.text().trim();

        // Detect species headings — they appear as text like "Fancy mouse (196)"
        if (node.type === 'text' && /^[A-Za-z][a-z &]+ \(\d+\)$/.test(text)) {
            currentSpecies = text.replace(/\s*\(\d+\)$/, '').trim();
            // Proper capitalise: "Fancy mouse" → "Fancy Mouse"
            currentSpecies = currentSpecies.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        // Animal links
        if (node.name === 'a') {
            const href = el.attr('href') || '';
            const m = href.match(/\/animal\?aid=(\d+)$/);
            if (!m) return;
            const sbId = m[1];
            const name = el.text().trim();
            if (!name) return;

            // Date and status are in the surrounding parent element text
            const parentText = el.parent().text();
            const dateMatch = parentText.match(/(\d{4}\/\d{2}\/\d{2})/);
            const birthDate = dateMatch ? dateMatch[1].replace(/\//g, '-') : null;

            // Status: text after the animal name in the parent block
            const afterName = parentText.split(name).pop().trim();
            const statusWord = afterName.split(/\s+/)[0];
            const status = mapStatus(statusWord);

            // Avoid duplicates (same sbId can appear more than once due to DOM traversal)
            if (!animals.find(a => a.sbId === sbId)) {
                animals.push({ sbId, name, birthDate, status, species: currentSpecies });
            }
        }
    });

    return animals;
}

/**
 * Parse an animal detail page → full animal data
 */
function parseAnimalDetail(html, sbId) {
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    // Helper: extract value after a label in body text
    const extractField = (label) => {
        const re = new RegExp(label + '\\s*:?\\s*([^\\n\\r]+)', 'i');
        const m = bodyText.match(re);
        return m ? m[1].trim() : null;
    };

    const name = extractField('Name');
    const gender = mapGender(extractField('Gender'));
    const birthRaw = extractField('Birth');
    const birthDate = birthRaw ? parseSbDate(birthRaw.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/)?.[1]) : null;
    const morph = extractField('Variation/morph') || extractField('Variation') || null;
    const internalId = extractField('ID in breedery') || null;

    // Status: look for STATUS label, or pull from prominent RETIRED/BREEDER/PET text near top
    let status = 'Pet';
    const statusMatch = bodyText.match(/^\s*(RETIRED|BREEDER|PET|AVAILABLE|SOLD|DECEASED|BOOKED)\s/im);
    if (statusMatch) status = mapStatus(statusMatch[1]);

    // Species: from page title pattern "NAME - FANCY MOUSE" or text
    let species = 'Unknown';
    const speciesMatch = bodyText.match(/(?:^|\n)(Fancy mouse|Fancy rat|Syrian hamster|Dwarf hamster|Campbells|Russian dwarf|Roborovski|Guinea pig|Rabbit|Chinchilla|Gerbil|Sugar glider|Ferret|Hedgehog)\b/i);
    if (speciesMatch) {
        species = speciesMatch[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    // ── Parent links ─────────────────────────────────────────────────────────
    // Strategy 1: look for table/row elements with Father/Mother/Sire/Dam label near a link
    let sireId = null, damId = null;

    $('tr, li, div, td').each((_, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();
        const link = $el.find('a[href*="/animal?aid="]').first();
        if (!link.length) return;
        const m = (link.attr('href') || '').match(/aid=(\d+)/);
        if (!m || m[1] === sbId) return;
        if ((text.includes('father') || text.includes('sire')) && !sireId) sireId = m[1];
        if ((text.includes('mother') || text.includes('dam')) && !damId) damId = m[1];
    });

    // Strategy 2: if labels not found, collect all non-self/non-offspring links near "PARENTS" text
    if (!sireId && !damId) {
        const bodyHtml = $.html('body');
        const parentsIdx = bodyHtml.toUpperCase().indexOf('>PARENTS<');
        const offspringIdx = bodyHtml.toUpperCase().indexOf('>DIRECT OFFSPRING<');
        if (parentsIdx !== -1) {
            const end = offspringIdx !== -1 && offspringIdx > parentsIdx ? offspringIdx : parentsIdx + 3000;
            const section = bodyHtml.slice(parentsIdx, end);
            const linkRe = /href="\/animal\?aid=(\d+)"/gi;
            const foundIds = [];
            let lm;
            while ((lm = linkRe.exec(section)) !== null) {
                if (lm[1] !== sbId && !foundIds.includes(lm[1])) foundIds.push(lm[1]);
            }
            if (foundIds.length >= 1) sireId = foundIds[0]; // will swap if genders reveal otherwise
            if (foundIds.length >= 2) damId = foundIds[1];
        }
    }

    return { sbId, name, gender, birthDate, morph, status, species, sireId, damId, internalId };
}

// ─── Preview Endpoint ─────────────────────────────────────────────────────────

/**
 * POST /api/import/simplebreed/preview
 * Body: { profileUrl: string }
 * Returns: { animals: [...], profileUrl }
 */
router.post('/preview', async (req, res) => {
    const { profileUrl } = req.body;
    const canonicalUrl = normaliseSbUrl(profileUrl);
    if (!canonicalUrl) return res.status(400).json({ message: 'Invalid SimpleBreed profile URL or username.' });

    let html;
    try {
        html = await fetchSbHtml(canonicalUrl);
    } catch (err) {
        return res.status(502).json({ message: 'Could not reach SimpleBreed. Check the URL and try again.' });
    }

    let animals;
    try {
        animals = parseProfilePage(html);
    } catch (err) {
        return res.status(422).json({ message: 'Could not parse the SimpleBreed profile page.' });
    }

    if (!animals.length) {
        return res.status(404).json({ message: 'No animals found on this SimpleBreed profile. The account may be private or empty.' });
    }

    // Check for existing duplicates by breederAssignedId (sbId stored as "#NNNNN")
    const userId = req.user.id;
    const existingMap = {};
    const sbIdKeys = animals.map(a => `#${a.sbId}`);
    const existing = await Animal.find({
        ownerId: userId,
        breederAssignedId: { $in: sbIdKeys }
    }).select('breederAssignedId id_public name').lean();
    for (const ex of existing) {
        existingMap[ex.breederAssignedId] = { id_public: ex.id_public, name: ex.name };
    }

    const result = animals.map(a => ({
        ...a,
        duplicate: existingMap[`#${a.sbId}`] || null,
    }));

    res.json({ animals: result, profileUrl: canonicalUrl });
});

// ─── Import Endpoint ──────────────────────────────────────────────────────────

/**
 * POST /api/import/simplebreed/import
 * Body: {
 *   selectedIds: string[],         — sbIds to import
 *   conflictResolutions: { [sbId]: 'skip' | 'import_anyway' },
 *   confirm: boolean
 * }
 */
router.post('/import', async (req, res) => {
    const { selectedIds, conflictResolutions = {}, confirm = false } = req.body;

    if (!Array.isArray(selectedIds) || !selectedIds.length) {
        return res.status(400).json({ message: 'No animals selected.' });
    }

    const userId = req.user.id;
    const userId_public = req.user.id_public || '';

    // ── Step 1: Fetch detail pages for all selected animals ───────────────────
    const detailMap = {}; // sbId → parsed detail

    await batchAll(selectedIds, 5, async (sbId) => {
        try {
            const html = await fetchSbHtml(`${SB_BASE}/animal?aid=${sbId}`);
            detailMap[sbId] = parseAnimalDetail(html, sbId);
        } catch {
            detailMap[sbId] = null; // will be reported as error
        }
    });

    // ── Step 2: Collect all unique parent sbIds not already in detailMap ──────
    const allParentIds = new Set();
    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d) continue;
        if (d.sireId && !selectedIds.includes(d.sireId)) allParentIds.add(d.sireId);
        if (d.damId && !selectedIds.includes(d.damId)) allParentIds.add(d.damId);
    }

    // Fetch parent detail pages (needed for gender-based sire/dam assignment)
    const parentDetailMap = {}; // sbId → parsed detail
    await batchAll([...allParentIds], 5, async (sbId) => {
        try {
            const html = await fetchSbHtml(`${SB_BASE}/animal?aid=${sbId}`);
            parentDetailMap[sbId] = parseAnimalDetail(html, sbId);
        } catch {
            parentDetailMap[sbId] = null;
        }
    });

    // Combined lookup: selected + parent details
    const allDetails = { ...detailMap, ...parentDetailMap };

    // ── Step 3: Determine sire/dam using gender when label-based detection failed ─
    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d) continue;

        // If both are set, verify gender correctness and swap if needed
        const swapIfNeeded = (id1, id2) => {
            if (!id1 || !id2) return { sire: id1, dam: id2 };
            const g1 = (allDetails[id1]?.gender || 'Unknown');
            const g2 = (allDetails[id2]?.gender || 'Unknown');
            if (g1 === 'Female' && g2 !== 'Female') return { sire: id2, dam: id1 };
            if (g2 === 'Female' && g1 !== 'Female') return { sire: id1, dam: id2 };
            // If same gender or unknown, keep as-is
            return { sire: id1, dam: id2 };
        };

        if (d.sireId || d.damId) {
            const corrected = swapIfNeeded(d.sireId || d.damId, d.sireId && d.damId ? d.damId : null);
            d.sireId = corrected.sire;
            d.damId = corrected.dam;
        }
    }

    // ── Step 4: Check for existing duplicates in DB ───────────────────────────
    const allSbIds = [...selectedIds, ...allParentIds];
    const sbIdKeys = allSbIds.map(id => `#${id}`);
    const existingAnimals = await Animal.find({
        ownerId: userId,
        breederAssignedId: { $in: sbIdKeys }
    }).select('breederAssignedId id_public name').lean();
    const existingMap = {}; // '#sbId' → { id_public, name }
    for (const ex of existingAnimals) existingMap[ex.breederAssignedId] = ex;

    // Also check globally (any owner) for breeding records linking
    const existingGlobal = await Animal.find({
        breederAssignedId: { $in: sbIdKeys }
    }).select('breederAssignedId id_public').lean();
    const globalMap = {};
    for (const ex of existingGlobal) globalMap[ex.breederAssignedId] = ex;

    // ── Step 5: Dry run / preview ─────────────────────────────────────────────
    const willCreate = [];
    const willSkip = [];
    const errors = [];

    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d) { errors.push({ sbId, error: 'Failed to fetch animal detail page' }); continue; }

        const key = `#${sbId}`;
        const resolution = conflictResolutions[sbId] || (existingMap[key] ? 'skip' : 'create');

        if (existingMap[key] && resolution === 'skip') {
            willSkip.push({ sbId, name: d.name, existingId: existingMap[key].id_public });
        } else {
            willCreate.push({ sbId, name: d.name, action: existingMap[key] ? 'import_anyway' : 'create' });
        }
    }

    if (!confirm) {
        return res.json({
            preview: {
                willCreate: willCreate.length,
                willSkip: willSkip.length,
                parentsFetched: allParentIds.size,
                items: willCreate,
                skipped: willSkip,
                errors,
            }
        });
    }

    // ── Step 6: Write to DB ───────────────────────────────────────────────────
    const sbIdToCtId = {}; // sbId → id_public (for parent linking)

    // Pre-fill with existing animals from globalMap
    for (const [key, ex] of Object.entries(globalMap)) {
        const id = key.replace('#', '');
        sbIdToCtId[id] = ex.id_public;
    }

    // Pass 1: Create all selected animals (and parent stubs if needed)
    const toCreate = [...new Set([
        ...selectedIds.filter(id => {
            const key = `#${id}`;
            const res = conflictResolutions[id] || (existingMap[key] ? 'skip' : 'create');
            return res !== 'skip';
        }),
        ...[...allParentIds].filter(id => !globalMap[`#${id}`]) // parent stubs only if not in DB
    ])];

    let created = 0;
    const createErrors = [];

    for (const sbId of toCreate) {
        const d = allDetails[sbId];
        if (!d) { createErrors.push({ sbId, error: 'No detail data' }); continue; }

        try {
            const id_public = await getNextSequence('animalId');
            const isSelectedAnimal = selectedIds.includes(sbId);

            await Animal.create({
                id_public,
                ownerId: userId,
                ownerId_public: userId_public,
                isOwned: isSelectedAnimal,
                name: d.name || `SimpleBreed #${sbId}`,
                gender: d.gender || 'Unknown',
                birthDate: d.birthDate || null,
                color: d.morph || null,
                status: d.status || 'Pet',
                species: d.species !== 'Unknown' ? d.species : null,
                breederAssignedId: `#${sbId}`,
                remarks: d.internalId ? `SimpleBreed internal ID: ${d.internalId}` : '',
            });

            sbIdToCtId[sbId] = id_public;
            created++;
        } catch (err) {
            createErrors.push({ sbId, error: err.message });
        }
    }

    // Pass 2: Link parents
    let parentLinked = 0;
    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d || !sbIdToCtId[sbId]) continue;

        const sireCtId = d.sireId ? (sbIdToCtId[d.sireId] || null) : null;
        const damCtId = d.damId ? (sbIdToCtId[d.damId] || null) : null;

        if (sireCtId || damCtId) {
            await Animal.updateOne(
                { id_public: sbIdToCtId[sbId], ownerId: userId },
                { $set: { sireId_public: sireCtId, damId_public: damCtId } }
            );
            parentLinked++;
        }
    }

    res.json({
        written: { animals: created },
        skipped: { animals: willSkip.length },
        parentLinked,
        errors: [...errors, ...createErrors],
    });
});

module.exports = router;
