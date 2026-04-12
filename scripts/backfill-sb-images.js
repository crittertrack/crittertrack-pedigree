// scripts/backfill-sb-images.js
// Finds all animals with an sbId but no imageUrl, fetches the image from
// SimpleBreed, uploads to R2, and updates the animal record.
//
// Usage:
//   node scripts/backfill-sb-images.js              # process all
//   node scripts/backfill-sb-images.js --dry-run    # just list what would be fetched
//   node scripts/backfill-sb-images.js --limit 50   # process at most 50
//
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const { Animal } = require('../database/models');

const SB_BASE = 'https://www.simplebreed.com';
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function resolveSbImageBuffer(url) {
    if (!url) return null;
    try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', headers: FETCH_HEADERS, timeout: 15000 });
        const ct = (resp.headers['content-type'] || '').split(';')[0].trim();
        if (ct.startsWith('image/')) {
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
        return { buffer: Buffer.from(imgResp.data), contentType: imgCt };
    } catch {
        return null;
    }
}

async function findSbImageUrl(sbId) {
    try {
        const resp = await axios.get(`${SB_BASE}/animal?aid=${sbId}`, { headers: FETCH_HEADERS, timeout: 20000 });
        const $ = cheerio.load(resp.data);
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
        // Fallback: any reasonably sized <img>
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
    } catch {
        return null;
    }
}

async function run() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 0 : 0;

    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    if (!process.env.UPLOADER_URL && !process.env.PUBLIC_HOST) {
        process.env.UPLOADER_URL = 'https://uploads.crittertrack.net';
    }
    const r2 = require('../storage/r2_client');

    const query = {
        sbId: { $ne: null, $exists: true },
        $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }],
    };
    const total = await Animal.countDocuments(query);
    console.log(`Found ${total} animals with sbId but no image`);
    if (!total) { await mongoose.disconnect(); return; }

    const animals = limit > 0
        ? await Animal.find(query).select('id_public sbId name').limit(limit).lean()
        : await Animal.find(query).select('id_public sbId name').lean();

    console.log(`Processing ${animals.length} animals${dryRun ? ' (dry run)' : ''}...\n`);

    let success = 0, noImage = 0, failed = 0;

    for (let i = 0; i < animals.length; i++) {
        const a = animals[i];
        const label = `[${i + 1}/${animals.length}] ${a.id_public} "${a.name}" (SB#${a.sbId})`;

        if (dryRun) {
            console.log(`  ${label} — would fetch`);
            continue;
        }

        const sbImageUrl = await findSbImageUrl(a.sbId);
        if (!sbImageUrl) {
            console.log(`  ${label} — no image on SB page`);
            noImage++;
            await sleep(200);
            continue;
        }

        const img = await resolveSbImageBuffer(sbImageUrl);
        if (!img) {
            console.log(`  ${label} — failed to download image`);
            failed++;
            await sleep(200);
            continue;
        }

        try {
            const ext = img.contentType.replace('image/', '').replace('jpeg', 'jpg').split('+')[0] || 'jpg';
            const key = `animals/${a.id_public}-sb.${ext}`;
            const uploadedUrl = await r2.uploadBuffer(key, img.buffer, img.contentType);
            if (uploadedUrl) {
                await Animal.updateOne({ id_public: a.id_public }, { $set: { imageUrl: uploadedUrl } });
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

        // Be polite to SB servers
        await sleep(300);
    }

    console.log(`\nDone! ${success} uploaded, ${noImage} no image on SB, ${failed} failed`);
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
