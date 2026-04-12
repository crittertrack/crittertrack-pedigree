// scripts/match-sb-images.js
// Scrapes the given SimpleBreed profile URLs, matches animals to imageless
// CTU1/CTU8/CTU11 animals by name + birthdate, then fetches and uploads images.
//
// Usage:
//   node scripts/match-sb-images.js                 # full run
//   node scripts/match-sb-images.js --dry-run       # just show matches, no uploads
//   node scripts/match-sb-images.js --limit 10      # process at most 10 matches
//
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const { Animal, PublicAnimal } = require('../database/models');

// ─── Config ──────────────────────────────────────────────────────────────────

const SB_BASE = 'https://www.simplebreed.com';
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
};
const TARGET_OWNERS = ['CTU1', 'CTU8', 'CTU11'];
const SB_PROFILES = [
    'https://www.simplebreed.com/profile?uid=1059',
    'https://www.simplebreed.com/profile?uid=1328',
    'https://www.simplebreed.com/morningstardb',
    'https://www.simplebreed.com/tsukinosakura',
    'https://www.simplebreed.com/tsukinosakuradatabase',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── SB scraping (reused logic from simplebreedRoutes) ──────────────────────

async function fetchSbHtml(url) {
    const res = await axios.get(url, { headers: FETCH_HEADERS, timeout: 20000, maxRedirects: 5 });
    return res.data;
}

async function parseProfilePage(html) {
    const animals = [];
    const seen = new Set();

    function extractFromHtml(pageHtml, defaultSpecies = null) {
        const $ = cheerio.load(pageHtml);
        const bodyText = $('body').text();
        const speciesHeadings = [];
        $('*').each((_, el) => {
            const text = $(el).text().trim();
            if (/^[A-Za-z][A-Za-z &]+ \(\d+\)$/.test(text) && $(el).children().length === 0) {
                speciesHeadings.push({ text: text.replace(/\s*\(\d+\)$/, '').trim(), pos: bodyText.indexOf(text) });
            }
        });
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

            let birthDate = null;
            let $ctx = $(el);
            for (let i = 0; i < 6; i++) {
                const ctxText = $ctx.text();
                const dateM = ctxText.match(/(\d{4}\/\d{2}\/\d{2})/);
                if (dateM) {
                    birthDate = dateM[1].replace(/\//g, '-');
                    break;
                }
                const parent = $ctx.parent();
                if (!parent.length || parent.is('body')) break;
                $ctx = parent;
            }

            animals.push({ sbId, name, birthDate });
        });

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

    let pendingFetches = extractFromHtml(html);
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
                console.warn(`  [pagination] Failed ${href}: ${err.message}`);
                return [];
            }
        }));
        for (const next of results.flat()) pendingFetches.push(next);
    }
    return animals;
}

function findSbImageUrl($) {
    // Priority 1: picread link with img inside
    const picreadLink = $('a[href*="picread"]').first();
    if (picreadLink.length) {
        const imgInLink = picreadLink.find('img').first();
        if (imgInLink.length) {
            const src = imgInLink.attr('src') || '';
            if (src) return src.startsWith('http') ? src : `${SB_BASE}${src.startsWith('/') ? src : '/' + src}`;
        }
        const href = (picreadLink.attr('href') || '').trim();
        if (href) return href.startsWith('http') ? href : `${SB_BASE}${href.startsWith('/') ? href : '/' + href}`;
    }
    // Priority 2: any reasonably sized <img>
    let fallback = null;
    $('img').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (!src || /logo|icon|flag|button/i.test(src)) return;
        const w = parseInt($(el).attr('width') || '0', 10);
        if (w > 0 && w < 50) return;
        fallback = src.startsWith('http') ? src : `${SB_BASE}${src.startsWith('/') ? src : '/' + src}`;
        return false;
    });
    return fallback;
}

async function fetchSbDetailImage(sbId) {
    try {
        const html = await fetchSbHtml(`${SB_BASE}/animal?aid=${sbId}`);
        const $ = cheerio.load(html);
        return findSbImageUrl($);
    } catch {
        return null;
    }
}

async function resolveSbImageBuffer(url) {
    if (!url) return null;
    try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', headers: FETCH_HEADERS, timeout: 15000 });
        const ct = (resp.headers['content-type'] || '').split(';')[0].trim();
        if (ct.startsWith('image/')) {
            // Reject tiny images (likely placeholders/silhouettes) — under 5KB
            if (resp.data.byteLength < 5000) return null;
            return { buffer: Buffer.from(resp.data), contentType: ct };
        }
        const html = Buffer.from(resp.data).toString('utf8');
        const $ = cheerio.load(html);
        let imgSrc = null;
        $('img').each((_, el) => {
            const src = $(el).attr('src') || '';
            if (!src || /logo|icon|flag|button/i.test(src)) return;
            const w = parseInt($(el).attr('width') || '0', 10);
            if (w > 0 && w < 50) return;
            imgSrc = src.startsWith('http') ? src : `${SB_BASE}${src.startsWith('/') ? src : '/' + src}`;
            return false;
        });
        if (!imgSrc) return null;
        const imgResp = await axios.get(imgSrc, { responseType: 'arraybuffer', headers: FETCH_HEADERS, timeout: 15000 });
        const imgCt = (imgResp.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
        if (!imgCt.startsWith('image/')) return null;
        if (imgResp.data.byteLength < 5000) return null; // Reject tiny placeholders
        return { buffer: Buffer.from(imgResp.data), contentType: imgCt };
    } catch {
        return null;
    }
}

// ─── Name matching logic ────────────────────────────────────────────────────

const SUFFIX_RE = /\s+(Jr\.?|Sr\.?|II|III|IV|VI{0,3}|[2-9]|No\.?\s*\d+)$/i;

function splitSbName(rawName) {
    if (!rawName) return { prefix: null, baseName: '', nameVariants: [] };
    const trimmed = rawName.trim();
    const prefixMatch = trimmed.match(/^([A-Z]{1,4}[0-9]{0,2}(?:\.[A-Z]{1,4})?)(?:'s)?\s+(.+)$/);
    let prefix = null;
    let working = trimmed;
    if (prefixMatch) {
        prefix = prefixMatch[1];
        working = prefixMatch[2].trim();
    }
    let suffix = null;
    let baseName = working;
    const suffixMatch = working.match(SUFFIX_RE);
    if (suffixMatch) {
        suffix = suffixMatch[1].trim();
        baseName = working.slice(0, working.length - suffixMatch[0].length).trim();
    }
    const nameVariants = [...new Set([
        trimmed.toLowerCase(),
        baseName.toLowerCase(),
        suffix ? `${baseName} ${suffix}`.toLowerCase() : null,
        prefix ? `${prefix} ${baseName}`.toLowerCase() : null,
        prefix && suffix ? `${prefix} ${baseName} ${suffix}`.toLowerCase() : null,
    ].filter(Boolean))];
    return { prefix, baseName, nameVariants };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 0 : 0;

    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // ── Phase 1: Load imageless CT animals ──────────────────────────────────
    console.log(`Loading imageless animals for ${TARGET_OWNERS.join(', ')}...`);
    const ctAnimals = await Animal.find({
        ownerId_public: { $in: TARGET_OWNERS },
        $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }],
    }).select('id_public name prefix suffix birthDate ownerId_public sbId').lean();
    console.log(`Found ${ctAnimals.length} imageless CT animals\n`);

    if (!ctAnimals.length) { await mongoose.disconnect(); return; }

    // Build lookup: lowercase full-name (prefix + name + suffix) → ct animal(s)
    // Also index by baseName (no prefix/suffix) and by name+birthdate
    const ctByName = new Map();      // lowercase name → [animal, ...]
    const ctByNameDate = new Map();  // "name|YYYY-MM-DD" → [animal, ...]

    for (const a of ctAnimals) {
        const parts = [a.prefix, a.name, a.suffix].filter(Boolean);
        const fullName = parts.join(' ').toLowerCase();
        const baseName = (a.name || '').toLowerCase();
        const dateStr = a.birthDate ? new Date(a.birthDate).toISOString().slice(0, 10) : null;

        for (const key of new Set([fullName, baseName])) {
            if (!ctByName.has(key)) ctByName.set(key, []);
            ctByName.get(key).push(a);
            if (dateStr) {
                const dk = `${key}|${dateStr}`;
                if (!ctByNameDate.has(dk)) ctByNameDate.set(dk, []);
                ctByNameDate.get(dk).push(a);
            }
        }
    }

    // ── Phase 2: Scrape SB profiles ──────────────────────────────────────────
    const allSbAnimals = [];
    for (const url of SB_PROFILES) {
        console.log(`Scraping ${url}...`);
        try {
            const html = await fetchSbHtml(url);
            const animals = await parseProfilePage(html);
            console.log(`  → ${animals.length} animals found`);
            allSbAnimals.push(...animals);
        } catch (err) {
            console.error(`  → FAILED: ${err.message}`);
        }
        await sleep(500);
    }

    // Dedupe by sbId
    const sbMap = new Map();
    for (const sb of allSbAnimals) {
        if (!sbMap.has(sb.sbId)) sbMap.set(sb.sbId, sb);
    }
    const sbAnimals = [...sbMap.values()];
    console.log(`\nTotal unique SB animals: ${sbAnimals.length}\n`);

    // ── Phase 3: Match SB animals to CT animals ─────────────────────────────
    console.log('Matching SB animals to imageless CT animals...\n');
    const matches = []; // { ctAnimal, sbAnimal, matchType }
    const matchedCtIds = new Set(); // Prevent double-matching same CT animal

    for (const sb of sbAnimals) {
        const { nameVariants } = splitSbName(sb.name);
        const sbDate = sb.birthDate; // already YYYY-MM-DD string or null

        // Try name+birthdate match first (strongest signal)
        let found = null;
        let matchType = null;

        if (sbDate) {
            for (const variant of nameVariants) {
                const dk = `${variant}|${sbDate}`;
                const candidates = ctByNameDate.get(dk);
                if (candidates) {
                    const unmatched = candidates.find(c => !matchedCtIds.has(c.id_public));
                    if (unmatched) {
                        found = unmatched;
                        matchType = 'name+birthdate';
                        break;
                    }
                }
            }
        }

        // Fallback: name-only (only if exactly 1 CT animal has that name — avoid ambiguity)
        if (!found) {
            for (const variant of nameVariants) {
                const candidates = ctByName.get(variant);
                if (candidates) {
                    const unmatched = candidates.filter(c => !matchedCtIds.has(c.id_public));
                    if (unmatched.length === 1) {
                        found = unmatched[0];
                        matchType = 'name-only (unique)';
                        break;
                    }
                }
            }
        }

        if (found) {
            matchedCtIds.add(found.id_public);
            matches.push({ ctAnimal: found, sbAnimal: sb, matchType });
        }
    }

    console.log(`Matched ${matches.length} of ${sbAnimals.length} SB animals to ${ctAnimals.length} imageless CT animals\n`);

    // ── Phase 4: Fetch detail pages, download images, upload ─────────────────
    if (!process.env.UPLOADER_URL && !process.env.PUBLIC_HOST) {
        process.env.UPLOADER_URL = 'https://uploads.crittertrack.net';
    }
    const r2 = require('../storage/r2_client');

    const toProcess = limit > 0 ? matches.slice(0, limit) : matches;
    let success = 0, noImage = 0, placeholder = 0, failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const { ctAnimal, sbAnimal, matchType } = toProcess[i];
        const label = `[${i + 1}/${toProcess.length}] ${ctAnimal.id_public} "${ctAnimal.prefix ? ctAnimal.prefix + ' ' : ''}${ctAnimal.name}" ← SB#${sbAnimal.sbId} "${sbAnimal.name}" (${matchType})`;

        if (dryRun) {
            console.log(`  ${label} — would fetch`);
            continue;
        }

        // Fetch detail page to get image URL
        const sbImageUrl = await fetchSbDetailImage(sbAnimal.sbId);
        if (!sbImageUrl) {
            console.log(`  ${label} — no image on SB`);
            noImage++;
            await sleep(200);
            continue;
        }

        // Download and validate image
        const img = await resolveSbImageBuffer(sbImageUrl);
        if (!img) {
            console.log(`  ${label} — placeholder/tiny image, skipped`);
            placeholder++;
            await sleep(200);
            continue;
        }

        try {
            const ext = img.contentType.replace('image/', '').replace('jpeg', 'jpg').split('+')[0] || 'jpg';
            const key = `animals/${ctAnimal.id_public}-sb.${ext}`;
            const uploadedUrl = await r2.uploadBuffer(key, img.buffer, img.contentType);
            if (uploadedUrl) {
                await Animal.updateOne({ id_public: ctAnimal.id_public }, { $set: { imageUrl: uploadedUrl } });
                await PublicAnimal.updateOne({ id_public: ctAnimal.id_public }, { $set: { imageUrl: uploadedUrl } });
                // Also set sbId if not already set
                if (!ctAnimal.sbId) {
                    await Animal.updateOne({ id_public: ctAnimal.id_public }, { $set: { sbId: sbAnimal.sbId } });
                    await PublicAnimal.updateOne({ id_public: ctAnimal.id_public }, { $set: { sbId: sbAnimal.sbId } });
                }
                console.log(`  ${label} — ✓ uploaded`);
                success++;
            } else {
                console.log(`  ${label} — R2 returned no URL`);
                failed++;
            }
        } catch (err) {
            console.log(`  ${label} — upload error: ${err.message}`);
            failed++;
        }

        await sleep(300);
    }

    console.log(`\nDone! ${success} uploaded, ${noImage} no image on SB, ${placeholder} placeholder/tiny skipped, ${failed} failed`);
    console.log(`(${ctAnimals.length - matches.length} CT animals had no SB match)`);
    await mongoose.disconnect();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
