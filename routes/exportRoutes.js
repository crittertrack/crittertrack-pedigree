const express = require('express');
const router = express.Router();
const axios = require('axios');
const JSZip = require('jszip');
const { Animal, Litter, Enclosure, SupplyItem, Transaction } = require('../database/models');

// --- CSV helpers ---

function csvEscape(val) {
    if (val === null || val === undefined) return '';
    let s;
    if (typeof val === 'object') {
        s = JSON.stringify(val);
    } else {
        s = String(val);
    }
    if (s.includes(',') || s.includes('\n') || s.includes('"') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function toCSV(records) {
    if (!records || records.length === 0) return 'No records exported.';
    const headers = Object.keys(records[0]);
    const rows = [headers.join(',')];
    for (const rec of records) {
        rows.push(headers.map(h => csvEscape(rec[h])).join(','));
    }
    return rows.join('\r\n');
}

// --- Field strippers: remove internal MongoDB / ObjectId fields ---

function stripAnimal(doc) {
    const { _id, __v, ownerId, originalOwnerId, viewOnlyForUsers, hiddenForUsers, litterId, ...rest } = doc;
    return rest;
}

function stripLitter(doc) {
    const { _id, __v, ownerId, ...rest } = doc;
    return rest;
}

function stripEnclosure(doc) {
    const { _id, __v, ownerId, ...rest } = doc;
    return rest;
}

function stripSupply(doc) {
    const { _id, __v, userId, ...rest } = doc;
    return rest;
}

function stripTransaction(doc) {
    const { _id, __v, userId, buyerUserId, sellerUserId, ...rest } = doc;
    return rest;
}

// --- Image embedding ---

async function embedImageAsBase64(url) {
    if (!url || url.startsWith('data:')) return url;
    try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        const ct = resp.headers['content-type'] || 'image/jpeg';
        const b64 = Buffer.from(resp.data).toString('base64');
        return `data:${ct};base64,${b64}`;
    } catch {
        return url; // keep original URL on failure
    }
}

// GET /api/export
// Query params:
//   sections      comma-separated: animals,litters,enclosures,supplies,budget  (default: all)
//   format        json | csv  (default: json)
//   includeArchived  true | false  (default: false)
//   includeSold      true | false  (default: false)
//   embedImages      true | false  (default: false) — JSON only; embeds images as base64 data URIs
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const sectionsRaw = req.query.sections || 'animals,litters,enclosures,supplies,budget';
        const sections = sectionsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const format = (req.query.format || 'json').toLowerCase();
        const includeArchived = req.query.includeArchived === 'true';
        const includeSold = req.query.includeSold === 'true';
        const embedImages = req.query.embedImages === 'true' && format === 'json';

        const data = {};

        if (sections.includes('animals')) {
            const filter = { ownerId: userId };
            if (!includeArchived) filter.archived = { $ne: true };
            if (!includeSold) filter.soldStatus = { $ne: 'sold' };
            let animals = await Animal.find(filter).lean();
            animals = animals.map(stripAnimal);
            if (embedImages) {
                animals = await Promise.all(animals.map(async a => {
                    if (a.imageUrl) a.imageUrl = await embedImageAsBase64(a.imageUrl);
                    if (a.photoUrl) a.photoUrl = await embedImageAsBase64(a.photoUrl);
                    return a;
                }));
            }
            data.animals = animals;
        }

        if (sections.includes('litters')) {
            const litters = await Litter.find({ ownerId: userId }).lean();
            data.litters = litters.map(stripLitter);
        }

        if (sections.includes('enclosures')) {
            const enclosures = await Enclosure.find({ ownerId: userId }).lean();
            data.enclosures = enclosures.map(stripEnclosure);
        }

        if (sections.includes('supplies')) {
            const supplies = await SupplyItem.find({ userId: userId }).lean();
            data.supplies = supplies.map(stripSupply);
        }

        if (sections.includes('budget')) {
            const transactions = await Transaction.find({ userId: userId }).lean();
            data.budget = transactions.map(stripTransaction);
        }

        const timestamp = new Date().toISOString().slice(0, 10);

        if (format === 'csv') {
            const zip = new JSZip();
            for (const [section, records] of Object.entries(data)) {
                zip.file(`crittertrack_${section}_${timestamp}.csv`, toCSV(records));
            }
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="crittertrack_export_${timestamp}.zip"`);
            return res.send(zipBuffer);
        }

        // JSON format (default)
        const payload = {
            exportedAt: new Date().toISOString(),
            format: 'crittertrack-export-v1',
            sections: Object.keys(data),
            ...data,
        };
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="crittertrack_export_${timestamp}.json"`);
        return res.json(payload);

    } catch (err) {
        console.error('[exportRoutes] Error:', err);
        res.status(500).json({ message: 'Export failed', error: err.message });
    }
});

module.exports = router;
