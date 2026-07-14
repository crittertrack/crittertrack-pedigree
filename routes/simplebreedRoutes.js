const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { Animal } = require('../database/models');
const { getNextSequence } = require('../database/db_service');

// ─── Constants ────────────────────────────────────────────────────────────────

const SB_BASE = 'https://www.simplebreed.com';
const useR2 = (process.env.STORAGE_PROVIDER || '').toUpperCase() === 'R2';
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function normaliseSbUrl(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim();
    // profile?uid=12345 format
    const uidMatch = input.match(/(?:https?:\/\/)?(?:www\.)?simplebreed\.com\/(profile\?uid=\d+)/);
    if (uidMatch) return `${SB_BASE}/${uidMatch[1]}`;
    // plain username path: simplebreed.com/username
    const userMatch = input.match(/(?:https?:\/\/)?(?:www\.)?simplebreed\.com\/([a-zA-Z0-9_@-]+)\/?$/);
    if (userMatch) return `${SB_BASE}/${userMatch[1]}`;
    // bare username
    if (/^[a-zA-Z0-9_@-]+$/.test(input)) return `${SB_BASE}/${input}`;
    return null;
}

async function fetchSbHtml(url) {
    const res = await axios.get(url, { headers: FETCH_HEADERS, timeout: 20000, maxRedirects: 5 });
    return res.data;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

// ─── Field mapping helpers ────────────────────────────────────────────────────

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

function mapGender(raw) {
    if (!raw) return 'Unknown';
    const s = raw.trim().toLowerCase();
    if (s === 'male') return 'Male';
    if (s === 'female') return 'Female';
    return 'Unknown';
}

function parseSbDate(str) {
    if (!str) return null;
    const m = str.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * On SimpleBreed, prefix + name are combined in a single name string, e.g. "MM Curry".
 * This function attempts to split off a breeder prefix (1-4 uppercase letters, optionally
 * followed by a digit) so that CT's separate prefix/name fields are populated correctly,
 * and so findGlobalDuplicate can match against existing CT animals regardless of how they
 * store the prefix.
 *
 * Returns { fullName, prefix, baseName, nameVariants }
 */
// Common animal name suffixes (roman numerals, Jr/Sr, trailing numbers)
const SUFFIX_RE = /\s+(Jr\.?|Sr\.?|II|III|IV|VI{0,3}|[2-9]|No\.?\s*\d+)$/i;

function splitSbName(rawName) {
    if (!rawName) return { fullName: '', prefix: null, baseName: '', suffix: null, nameVariants: [] };
    const trimmed = rawName.trim();

    // Detect prefix: 1-4 uppercase letters (optionally with digits/dot) at start, then
    // optional 's (possessive, e.g. "M3's Mex") then a space
    const prefixMatch = trimmed.match(/^([A-Z]{1,4}[0-9]{0,2}(?:\.[A-Z]{1,4})?)(?:'s)?\s+(.+)$/);
    let prefix = null;
    let working = trimmed;
    if (prefixMatch) {
        prefix = prefixMatch[1];
        working = prefixMatch[2].trim();
    }

    // Detect suffix at end of (prefix-stripped) name
    let suffix = null;
    let baseName = working;
    const suffixMatch = working.match(SUFFIX_RE);
    if (suffixMatch) {
        suffix = suffixMatch[1].trim();
        baseName = working.slice(0, working.length - suffixMatch[0].length).trim();
    }

    const nameVariants = [...new Set([
        trimmed,                                                         // "MM Curry Jr" — full
        baseName,                                                        // "Curry"
        suffix ? `${baseName} ${suffix}` : null,                        // "Curry Jr"
        prefix ? `${prefix} ${baseName}` : null,                        // "MM Curry"
        prefix && suffix ? `${prefix} ${baseName} ${suffix}` : null,    // same as trimmed
    ].filter(Boolean))];

    return { fullName: trimmed, prefix, baseName, suffix, nameVariants };
}

// ─── Duplicate detection (mirrors zooeasyRoutes findGlobalDuplicate) ──────────

// idKeys: string | string[] — all breederAssignedId values to check (e.g. internalId)
// sbIdKey: the SimpleBreed animal ID to check against the dedicated sbId field
async function findGlobalDuplicate(idKeys, sbIdKey, nameVariants, birthDate, userId, species, prefix) {
    const idKeyArr = Array.isArray(idKeys) ? idKeys.filter(Boolean) : (idKeys ? [idKeys] : []);
    const sel = 'id_public name prefix suffix creatorId creatorId_public breederAssignedId sbId birthDate';

    // 1. Name + birthDate (any owner) — highest signal
    if (birthDate && nameVariants?.length) {
        const start = new Date(birthDate); start.setHours(0, 0, 0, 0);
        const end = new Date(birthDate); end.setHours(23, 59, 59, 999);
        for (const n of nameVariants) {
            const byName = await Animal.findOne({ name: n, birthDate: { $gte: start, $lte: end } })
                .select(sel).lean();
            if (byName) return { match: byName, matchType: 'name+birthDate', confidence: 'high' };
        }
        if (prefix) {
            const baseName = nameVariants.find(v => !v.startsWith(prefix)) || nameVariants[nameVariants.length - 1];
            if (baseName) {
                const byPfx = await Animal.findOne({ prefix, name: baseName, birthDate: { $gte: start, $lte: end } })
                    .select(sel).lean();
                if (byPfx) return { match: byPfx, matchType: 'name+birthDate', confidence: 'high' };
            }
        }
    }

    // 2. Name only — own animals (high), then global (possible)
    if (nameVariants?.length) {
        const speciesFilter = species && species !== 'Unknown' ? { species } : {};
        for (const n of nameVariants) {
            const own = await Animal.findOne({ name: n, creatorId: userId, ...speciesFilter })
                .select(sel).lean();
            if (own) return { match: own, matchType: 'name_only', confidence: 'high' };
        }
        if (prefix) {
            const baseName = nameVariants.find(v => !v.startsWith(prefix)) || nameVariants[nameVariants.length - 1];
            if (baseName) {
                const ownPfx = await Animal.findOne({ prefix, name: baseName, creatorId: userId })
                    .select(sel).lean();
                if (ownPfx) return { match: ownPfx, matchType: 'name_only', confidence: 'high' };
            }
        }
        for (const n of nameVariants) {
            const global = await Animal.findOne({ name: n, ...speciesFilter })
                .select(sel).lean();
            if (global) return { match: global, matchType: 'name_only', confidence: 'possible' };
        }
    }

    // 3. BreederAssignedId fallback (any owner)
    if (idKeyArr.length) {
        const byId = await Animal.findOne({ breederAssignedId: { $in: idKeyArr } })
            .select(sel).lean();
        if (byId) return { match: byId, matchType: 'id', confidence: 'high' };
    }

    // 4. SB ID field (dedicated, any owner)
    if (sbIdKey) {
        const bySbId = await Animal.findOne({ sbId: sbIdKey })
            .select(sel).lean();
        if (bySbId) return { match: bySbId, matchType: 'id', confidence: 'high' };
    }

    return null;
}

// ─── HTML scrapers ────────────────────────────────────────────────────────────

/**
 * Parse animals from a SimpleBreed profile HTML page.
 * The page only renders the first few animals; a `.nextData` element carries
 * the URL + POST body needed to load the rest. We follow the chain until there
 * are no more nextData elements.
 */
async function parseProfilePage(html) {
    const animals = [];
    const seen = new Set();

    // defaultSpecies is carried across pagination so paginated partial-HTML pages
    // (which lack the species heading) still get the right species assigned.
    function extractFromHtml(pageHtml, defaultSpecies = null) {
        const $ = cheerio.load(pageHtml);

        // Build species map: heading text → approximate character position in body text
        const bodyText = $('body').text();
        const speciesHeadings = [];
        $('*').each((_, el) => {
            const text = $(el).text().trim();
            if (/^[A-Za-z][A-Za-z &]+ \(\d+\)$/.test(text) && $(el).children().length === 0) {
                speciesHeadings.push({
                    text: text.replace(/\s*\(\d+\)$/, '').trim(),
                    pos: bodyText.indexOf(text),
                });
            }
        });

        // Species context to pass forward: last heading seen on this page, or inherited default
        const pageSpecies = speciesHeadings.length > 0
            ? speciesHeadings[speciesHeadings.length - 1].text
            : defaultSpecies;

        $('a[href*="/animal?aid="]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/animal\?aid=(\d+)/);
            if (!m) return;
            const sbId = m[1];
            if (seen.has(sbId)) return;
            seen.add(sbId);

            const name = $(el).text().trim();
            if (!name) return;

            // Walk up for birth date + status context
            let birthDate = null;
            let status = 'Pet';
            let $ctx = $(el);
            for (let i = 0; i < 6; i++) {
                const ctxText = $ctx.text();
                const dateM = ctxText.match(/(\d{4}\/\d{2}\/\d{2})/);
                if (dateM) {
                    birthDate = dateM[1].replace(/\//g, '-');
                    const after = ctxText.slice(ctxText.indexOf(name) + name.length).trim();
                    status = mapStatus(after.split(/\s{2,}|\n/)[0].trim().split(/\s+/)[0]);
                    break;
                }
                const parent = $ctx.parent();
                if (!parent.length || parent.is('body')) break;
                $ctx = parent;
            }

            // Species: last heading before this animal, falling back to inherited default
            let species = 'Unknown';
            if (speciesHeadings.length > 0) {
                const namePos = bodyText.indexOf(name);
                let best = speciesHeadings[0].text;
                for (const sh of speciesHeadings) {
                    if (sh.pos !== -1 && sh.pos < namePos) best = sh.text;
                }
                species = best.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            } else if (defaultSpecies) {
                species = defaultSpecies.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }

            animals.push({ sbId, name, birthDate, status, species });
        });

        // Collect nextData elements — carry species context forward
        const nextItems = [];
        $('.nextData').each((_, el) => {
            let nextHref = ($(el).attr('href') || '').trim();
            const postBody = ($(el).attr('post') || 'status=all&gender=all').trim();
            if (nextHref && nextHref.includes('user_animals')) {
                if (!nextHref.startsWith('http')) nextHref = `${SB_BASE}${nextHref.startsWith('/') ? '' : '/'}${nextHref}`;
                nextItems.push({ href: nextHref, postBody, speciesContext: pageSpecies });
            }
        });
        return nextItems;
    }

    // Initial profile page
    let pendingFetches = extractFromHtml(html);
    console.log(`[SB] Initial page parse: ${animals.length} animals, ${pendingFetches.length} pagination pages`);

    // Follow nextData pagination (POST to each user_animals URL)
    const visitedUrls = new Set();
    while (pendingFetches.length > 0) {
        const batch = pendingFetches.splice(0);
        const results = await Promise.all(batch.map(async ({ href, postBody, speciesContext }) => {
            if (visitedUrls.has(href)) return [];
            visitedUrls.add(href);
            try {
                const resp = await axios.post(href, postBody, {
                    headers: { ...FETCH_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 20000,
                });
                return extractFromHtml(resp.data, speciesContext);
            } catch (err) {
                console.warn(`[SB] Pagination fetch failed for ${href}:`, err.message);
                return [];
            }
        }));
        for (const next of results.flat()) pendingFetches.push(next);
    }
    console.log(`[SB] Total animals after pagination: ${animals.length}`);

    return animals;
}

function parseAnimalDetail(html, sbId) {
    const $ = cheerio.load(html);
    // Strip script and style tags before extracting text to avoid JS/CSS leaking into field values
    $('script, style').remove();
    const bodyText = $('body').text();

    const extractField = (label) => {
        const re = new RegExp(label + '\\s*:?\\s*([^\\n\\r]+)', 'i');
        const m = bodyText.match(re);
        return m ? m[1].trim() : null;
    };

    const rawName = extractField('Name') || '';
    // The page contains a search filter "Gender: Every sex / Unknown / Female / Male" BEFORE
    // the animal's own "Gender: Female" field, so we must match only Male|Female explicitly.
    const genderMatch = bodyText.match(/\bGender\s*:?\s*(Male|Female)\b/i) || bodyText.match(/\bSex\s*:?\s*(Male|Female)\b/i);
    const gender = mapGender(genderMatch ? genderMatch[1] : null);

    // Birth date: try "Birth:" first (living animals), then parse from "Lived: YYYY/MM/DD - YYYY/MM/DD"
    let birthDate = null;
    let deceasedDate = null;
    const birthRaw = extractField('Birth');
    if (birthRaw) {
        birthDate = parseSbDate(birthRaw.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/)?.[1]);
    } else {
        const livedRaw = extractField('Lived');
        if (livedRaw) {
            const dates = [...livedRaw.matchAll(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/g)].map(m => m[1]);
            if (dates[0]) birthDate = parseSbDate(dates[0]);
            if (dates[1]) deceasedDate = parseSbDate(dates[1]);
        }
    }

    const morph = extractField('Variation/morph') || extractField('Variation') || null;
    const internalId = extractField('ID in breedery') || null;

    let status = 'Pet';
    const statusMatch = bodyText.match(/^\s*(RETIRED|BREEDER|PET|AVAILABLE|SOLD|DECEASED|BOOKED)\s/im);
    if (statusMatch) status = mapStatus(statusMatch[1]);

    let species = 'Unknown';
    // Don't require line-start — the species appears in the page title e.g. "MF DONUT - FANCY MOUSE"
    const speciesMatch = bodyText.match(/\b(Fancy mouse|Fancy rat|Syrian hamster|Dwarf hamster|Campbells|Russian dwarf|Roborovski|Guinea pig|Rabbit|Chinchilla|Gerbil|Sugar glider|Ferret|Hedgehog)\b/i);
    if (speciesMatch) {
        species = speciesMatch[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    // ── Parent links ─────────────────────────────────────────────────────────
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
            if (foundIds.length >= 1) sireId = foundIds[0];
            if (foundIds.length >= 2) damId = foundIds[1];
        }
    }

    // ── Profile image ──────────────────────────────────────────────────────────
    // SimpleBreed wraps the photo in an <a href="/picread?aid=ID&pic=0"> link.
    // Store that URL; the import will fetch picread and resolve the actual img src.
    let sbImageUrl = null;
    const picreadLink = $('a[href*="picread"]').first();
    if (picreadLink.length) {
        // Check if there's a direct <img> inside the link first
        const imgInLink = picreadLink.find('img').first();
        if (imgInLink.length) {
            const src = imgInLink.attr('src') || '';
            if (src) sbImageUrl = src.startsWith('http') ? src : `${SB_BASE}${src.startsWith('/') ? src : '/' + src}`;
        }
        // Otherwise store the picread href for deferred resolution
        if (!sbImageUrl) {
            const href = (picreadLink.attr('href') || '').trim();
            if (href) sbImageUrl = href.startsWith('http') ? href : `${SB_BASE}${href.startsWith('/') ? href : '/' + href}`;
        }
    }
    // Fallback: any <img> that looks like an animal photo (not a tiny icon or logo)
    if (!sbImageUrl) {
        $('img').each((_, el) => {
            const src = $(el).attr('src') || '';
            if (!src || /logo|icon|flag|button/i.test(src)) return;
            const w = parseInt($(el).attr('width') || '0', 10);
            if (w > 0 && w < 50) return;
            sbImageUrl = src.startsWith('http') ? src : `${SB_BASE}${src.startsWith('/') ? src : '/' + src}`;
            return false; // break
        });
    }

    const { fullName, prefix, baseName, suffix, nameVariants } = splitSbName(rawName);
    return { sbId, fullName, prefix, baseName, suffix, nameVariants, gender, birthDate, deceasedDate, morph, species, sireId, damId, internalId, sbImageUrl };
}

// ─── Image helpers ───────────────────────────────────────────────────────────

/**
 * Resolves a SimpleBreed image URL (which may be a picread HTML page or a direct image)
 * into a { buffer, contentType } object, or null if no image found / not supported.
 */
async function resolveSbImageBuffer(url) {
    if (!url) return null;
    try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', headers: FETCH_HEADERS, timeout: 15000 });
        const ct = (resp.headers['content-type'] || '').split(';')[0].trim();
        // Direct image response
        if (ct.startsWith('image/')) {
            return { buffer: Buffer.from(resp.data), contentType: ct };
        }
        // HTML page (e.g. /picread) — parse the actual img src
        const html = Buffer.from(resp.data).toString('utf8');
        const $ = cheerio.load(html);
        let imgSrc = null;
        $('img').each((_, el) => {
            const src = $(el).attr('src') || '';
            if (!src || /logo|icon|flag|button/i.test(src)) return;
            const w = parseInt($(el).attr('width') || '0', 10);
            if (w > 0 && w < 50) return;
            imgSrc = src.startsWith('http') ? src : `${SB_BASE}${src.startsWith('/') ? src : '/' + src}`;
            return false; // break
        });
        if (!imgSrc) return null;
        const imgResp = await axios.get(imgSrc, { responseType: 'arraybuffer', headers: FETCH_HEADERS, timeout: 15000 });
        const imgCt = (imgResp.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
        if (!imgCt.startsWith('image/')) return null;
        return { buffer: Buffer.from(imgResp.data), contentType: imgCt };
    } catch {
        return null;
    }
}

async function uploadSbImage(sbImageUrl, id_public) {
    if (!useR2 || !sbImageUrl) return null;
    const img = await resolveSbImageBuffer(sbImageUrl);
    if (!img) return null;
    try {
        const r2 = require('../storage/r2_client');
        const ext = img.contentType.replace('image/', '').replace('jpeg', 'jpg').split('+')[0] || 'jpg';
        const key = `animals/${id_public}-sb.${ext}`;
        return await r2.uploadBuffer(key, img.buffer, img.contentType);
    } catch (err) {
        console.warn(`[SB] R2 upload failed for CT ${id_public}:`, err.message);
        return null;
    }
}

// ─── Preview Endpoint ─────────────────────────────────────────────────────────

/**
 * POST /api/import/simplebreed/preview
 * Body: { profileUrl: string }
 * Returns: { items, conflicts, total, profileUrl }
 *
 * items[] shape matches zooeasy preview: { sbId, name, prefix, birthDate, status, species, isDuplicate }
 * conflicts[] shape matches zooeasy: { sbId, name, matchType, confidence, existingId, existingName,
 *   existingBirthDate, existingOwner, isOwnedByImporter }
 */
// ─── Preview Endpoint ─────────────────────────────────────────────────────────
// Fast: only fetches the profile page (no per-animal detail pages).
// Returns { items, conflicts, total, profileUrl } to match the frontend data shape.
router.post('/preview', async (req, res) => {
    const { profileUrl } = req.body;
    const canonicalUrl = normaliseSbUrl(profileUrl);
    if (!canonicalUrl) return res.status(400).json({ message: 'Invalid SimpleBreed profile URL or username.' });

    let html;
    try {
        html = await fetchSbHtml(canonicalUrl);
    } catch (err) {
        console.error('[SB PREVIEW] Failed to fetch profile HTML:', err && err.stack ? err.stack : err);
        return res.status(502).json({ message: 'Could not reach SimpleBreed. Check the URL and try again.' });
    }

    let profileAnimals;
    try {
        profileAnimals = await parseProfilePage(html);
    } catch (err) {
        console.error('[SB PREVIEW] Failed to parse profile page:', err && err.stack ? err.stack : err);
        return res.status(422).json({ message: 'Could not parse the SimpleBreed profile page.' });
    }

    if (!profileAnimals.length) {
        return res.status(404).json({ message: 'No animals found on this SimpleBreed profile. The account may be private or empty.' });
    }

    const userId = req.user.id;

    // Preview is fast: no detail-page fetching. Profile page gives us name, birthDate,
    // sbId, status and species — enough for duplicate detection and species dropdown.
    const items = profileAnimals.map(a => ({
        sbId: a.sbId,
        name: a.name,
        birthDate: a.birthDate || null,
        species: (a.species && a.species !== 'Unknown') ? a.species : null,
        status: a.status || 'Pet',
    }));

    // Duplicate detection: sbId field + name+birthDate / name-only (name match)
    const conflicts = [];
    for (const a of profileAnimals) {
        const { nameVariants, prefix } = splitSbName(a.name);
        const birthDate = parseSbDate(a.birthDate);
        const idKeys = [];
        const dup = await findGlobalDuplicate(idKeys, a.sbId, nameVariants, birthDate, userId, a.species, prefix);
        if (dup) {
            const isOwnedByImporter = dup.match.creatorId?.toString() === userId?.toString();
            conflicts.push({
                sbId: a.sbId,
                name: a.name,
                matchType: dup.matchType,
                confidence: dup.confidence,
                existingId: dup.match.id_public,
                existingName: dup.match.name,
                existingBirthDate: dup.match.birthDate ? String(dup.match.birthDate).slice(0, 10) : null,
                existingOwner: isOwnedByImporter ? 'you' : (dup.match.creatorId_public || 'unknown'),
                isOwnedByImporter,
            });
        }
    }

    return res.json({ items, conflicts, total: items.length, profileUrl: canonicalUrl });
});

// ─── Import Endpoint ──────────────────────────────────────────────────────────
// Slow: fetches per-animal detail pages, creates CT records, uploads images.
// Body: { selectedIds, conflictResolutions, speciesMap }
router.post('/import', async (req, res) => {
    const { selectedIds, conflictResolutions = {}, speciesMap = {} } = req.body;
    if (!Array.isArray(selectedIds)) {
        return res.status(400).json({ message: 'Invalid request.' });
    }

    const userId = req.user.id;
    const userId_public = req.user.id_public;

    // ── Stub-only mode: no new animals, just register SB→CT mappings ─────────
    // For each map_to:<ctId> resolution, tag the existing CT animal with sbId
    // so future imports find it.
    if (!selectedIds.length) {
        const mapEntries = Object.entries(conflictResolutions)
            .filter(([, v]) => typeof v === 'string' && v.startsWith('map_to:'));
        let stubsLinked = 0;
        for (const [sbId, resolution] of mapEntries) {
            const ctId = resolution.slice(7);
            const result = await Animal.updateOne(
                { id_public: ctId, $or: [{ sbId: null }, { sbId: '' }, { sbId: { $exists: false } }] },
                { $set: { sbId } }
            );
            if (result.modifiedCount > 0) stubsLinked++;
        }
        return res.json({ written: { animals: 0 }, skipped: { animals: mapEntries.length - stubsLinked }, parentLinked: 0, imagesUploaded: 0, stubsLinked, errors: [] });
    }

    // ── Fetch detail pages for selected animals ───────────────────────────────
    const detailMap = {};
    await batchAll(selectedIds, 5, async (sbId) => {
        try {
            const html = await fetchSbHtml(`${SB_BASE}/animal?aid=${sbId}`);
            detailMap[sbId] = parseAnimalDetail(html, sbId);
        } catch {
            detailMap[sbId] = null;
        }
    });

    // ── Collect parent IDs not already in selectedIds ─────────────────────────
    const allParentIds = new Set();
    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d) continue;
        if (d.sireId && !selectedIds.includes(d.sireId)) allParentIds.add(d.sireId);
        if (d.damId && !selectedIds.includes(d.damId)) allParentIds.add(d.damId);
    }

    const parentDetailMap = {};
    await batchAll([...allParentIds], 5, async (sbId) => {
        try {
            const html = await fetchSbHtml(`${SB_BASE}/animal?aid=${sbId}`);
            parentDetailMap[sbId] = parseAnimalDetail(html, sbId);
        } catch {
            parentDetailMap[sbId] = null;
        }
    });

    const allDetails = { ...detailMap, ...parentDetailMap };

    // ── Gender-correct sire/dam assignments ───────────────────────────────────
    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d || (!d.sireId && !d.damId)) continue;
        const id1 = d.sireId, id2 = d.damId;
        if (id1 && id2) {
            const g1 = allDetails[id1]?.gender || 'Unknown';
            const g2 = allDetails[id2]?.gender || 'Unknown';
            if (g1 === 'Female' && g2 !== 'Female') { d.sireId = id2; d.damId = id1; }
        } else {
            const knownId = id1 || id2;
            const g = allDetails[knownId]?.gender || 'Unknown';
            if (g === 'Female') { d.sireId = null; d.damId = knownId; }
            else { d.sireId = knownId; d.damId = null; }
        }
    }

    // ── DB duplicate check ────────────────────────────────────────────────────
    const allSbIds = [...selectedIds, ...allParentIds];
    const internalIdKeys = allSbIds.map(id => allDetails[id]?.internalId).filter(Boolean);
    // Find existing animals by sbId field OR breederAssignedId (for internalId matches)
    const existingAnimals = await Animal.find({
        $or: [
            { sbId: { $in: allSbIds.map(String) } },
            ...(internalIdKeys.length ? [{ breederAssignedId: { $in: internalIdKeys } }] : []),
        ]
    }).select('breederAssignedId sbId id_public name creatorId').lean();
    const existingBySbId = {};
    const existingByBreeId = {};
    for (const ex of existingAnimals) {
        if (ex.sbId) existingBySbId[ex.sbId] = ex;
        if (ex.breederAssignedId) existingByBreeId[ex.breederAssignedId] = ex;
    }

    // Resolve manual map_to:<ctId> entries
    const manualCtIds = Object.values(conflictResolutions)
        .filter(v => typeof v === 'string' && v.startsWith('map_to:'))
        .map(v => v.slice(7));
    const manualCTMap = {};
    if (manualCtIds.length) {
        const ctAnimals = await Animal.find({ id_public: { $in: manualCtIds } })
            .select('id_public name prefix suffix creatorId').lean();
        const ctById = Object.fromEntries(ctAnimals.map(a => [a.id_public, a]));
        for (const [sbId, resolution] of Object.entries(conflictResolutions)) {
            if (typeof resolution === 'string' && resolution.startsWith('map_to:')) {
                const ctId = resolution.slice(7);
                if (ctById[ctId]) manualCTMap[sbId] = ctById[ctId];
            }
        }
    }

    const resolveExisting = (sbId) => {
        if (manualCTMap[sbId]) return manualCTMap[sbId];
        if (existingBySbId[sbId]) return existingBySbId[sbId];
        const iid = allDetails[sbId]?.internalId;
        return (iid && existingByBreeId[iid]) || null;
    };

    // ── Classify ──────────────────────────────────────────────────────────────
    const willSkip = [];
    const toCreate = [];
    const errors = [];

    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d) { errors.push({ sbId, error: 'Failed to fetch detail page' }); continue; }
        const existing = resolveExisting(sbId);
        const isManualMap = typeof conflictResolutions[sbId] === 'string' && conflictResolutions[sbId].startsWith('map_to:');
        if (existing && (isManualMap || conflictResolutions[sbId] !== 'import_anyway')) {
            willSkip.push({ sbId, existingId: existing.id_public });
        } else {
            toCreate.push(sbId);
        }
    }

    const parentStubs = [...allParentIds].filter(id => {
        if (resolveExisting(id)) return false;
        if (toCreate.includes(id)) return false;
        return toCreate.some(cid => {
            const d = detailMap[cid];
            return d && (d.sireId === id || d.damId === id);
        });
    });
    const allToCreate = [...toCreate, ...parentStubs];

    // ── Pass 1: Create animals ────────────────────────────────────────────────
    const sbIdToCtId = {};
    for (const sbId of allSbIds) {
        const ex = resolveExisting(sbId);
        if (ex) sbIdToCtId[sbId] = ex.id_public;
    }

    let created = 0;
    const createErrors = [];

    for (const sbId of allToCreate) {
        const d = allDetails[sbId];
        if (!d) { createErrors.push({ sbId, error: 'No detail data' }); continue; }
        try {
            const id_public = await getNextSequence('animalId');
            await Animal.create({
                id_public,
                creatorId: userId,
                creatorId_public: userId_public,
                isOwned: selectedIds.includes(sbId),
                isStub: parentStubs.includes(sbId),
                name: d.baseName || d.fullName || `SimpleBreed #${sbId}`,
                prefix: d.prefix || null,
                suffix: d.suffix || null,
                gender: d.gender || 'Unknown',
                birthDate: d.birthDate || null,
                color: d.morph || null,
                deceasedDate: d.deceasedDate || null,
                species: (d.species !== 'Unknown' ? d.species : null) || speciesMap[sbId] || 'Fancy Mouse',
                breederAssignedId: d.internalId || null,
                sbId: String(sbId),
            });
            sbIdToCtId[sbId] = id_public;
            created++;
        } catch (err) {
            createErrors.push({ sbId, error: err.message });
        }
    }

    // ── Pass 1.5: Upload images ───────────────────────────────────────────────
    let imagesUploaded = 0;
    if (useR2) {
        await batchAll(allToCreate, 3, async (sbId) => {
            const d = allDetails[sbId];
            const id_public = sbIdToCtId[sbId];
            if (!d?.sbImageUrl || !id_public) return;
            const uploadedUrl = await uploadSbImage(d.sbImageUrl, id_public);
            if (uploadedUrl) {
                await Animal.updateOne({ id_public }, { $set: { imageUrl: uploadedUrl } });
                imagesUploaded++;
            }
        });

        await batchAll(willSkip, 3, async ({ sbId, existingId }) => {
            const d = allDetails[sbId];
            if (!d?.sbImageUrl) return;
            const existing = await Animal.findOne({ id_public: existingId }).select('imageUrl').lean();
            if (existing?.imageUrl) return;
            const uploadedUrl = await uploadSbImage(d.sbImageUrl, existingId);
            if (uploadedUrl) {
                await Animal.updateOne({ id_public: existingId }, { $set: { imageUrl: uploadedUrl } });
                imagesUploaded++;
            }
        });
    }

    // ── Pass 2: Link parents ──────────────────────────────────────────────────
    let parentLinked = 0;
    for (const sbId of selectedIds) {
        const d = detailMap[sbId];
        if (!d || !sbIdToCtId[sbId]) continue;
        const sireCtId = d.sireId ? (sbIdToCtId[d.sireId] || null) : null;
        const damCtId = d.damId ? (sbIdToCtId[d.damId] || null) : null;
        if (sireCtId || damCtId) {
            await Animal.updateOne(
                { id_public: sbIdToCtId[sbId], creatorId: userId },
                { $set: { sireId_public: sireCtId, damId_public: damCtId } }
            );
            parentLinked++;
        }
    }

    // ── Pass 3: Write sbId on existing CT animals for all map_to / use_existing resolutions
    let stubsLinked = 0;
    for (const [sbId, resolution] of Object.entries(conflictResolutions)) {
        if (selectedIds.includes(sbId)) continue; // already created, sbId set at creation
        let ctId = null;
        if (typeof resolution === 'string' && resolution.startsWith('map_to:')) {
            ctId = resolution.slice(7);
        } else if (resolution === 'use_existing') {
            const ex = resolveExisting(sbId);
            if (ex) ctId = ex.id_public;
        }
        if (!ctId) continue;
        const result = await Animal.updateOne(
            { id_public: ctId, $or: [{ sbId: null }, { sbId: '' }, { sbId: { $exists: false } }] },
            { $set: { sbId: String(sbId) } }
        );
        if (result.modifiedCount > 0) stubsLinked++;
    }

    res.json({ written: { animals: created }, skipped: { animals: willSkip.length }, parentLinked, imagesUploaded, stubsLinked, errors: [...errors, ...createErrors] });
});

module.exports = router;
