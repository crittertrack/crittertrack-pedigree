const express = require('express');
const router = express.Router();
const { WaitlistEntry, Animal } = require('../database/models');
const Contact = require('../database/contactModel');

const VALID_GENDERS = ['Male', 'Female', 'Any'];

// Normalise one species request into { species, genderCounts, genders, amount }.
// Accepts the new `genderCounts` shape or the legacy `genders` + total `amount`.
function normalizeSpeciesRequest(r) {
    const species = r.species.trim();
    let genderCounts = [];
    if (Array.isArray(r.genderCounts)) {
        genderCounts = r.genderCounts
            .filter(c => VALID_GENDERS.includes(c?.gender) && Number(c.count) > 0)
            .map(c => ({ gender: c.gender, count: Math.floor(Number(c.count)) }));
    }
    if (genderCounts.length === 0) {
        const total = r.amount !== '' && r.amount != null && Number(r.amount) > 0 ? Math.floor(Number(r.amount)) : 1;
        const g = (Array.isArray(r.genders) ? r.genders : []).filter(x => VALID_GENDERS.includes(x));
        genderCounts = g.length === 1 && g[0] !== 'Any'
            ? [{ gender: g[0], count: total }]
            : [{ gender: 'Any', count: total }];
    }
    return {
        species,
        genderCounts,
        genders: genderCounts.map(c => c.gender),
        amount: genderCounts.reduce((s, c) => s + c.count, 0),
    };
}

// Resolve a contactId coming from the client into { contactId, contactName }.
//
// Rules:
//   - no id            → no link (a waitlist entry may simply have no contact)
//   - malformed id     → an error: the client sent something that can never be a contact
//   - unknown/foreign  → an error, worded identically either way so the response
//                        can't be used to probe which contact ids exist
// The contact must belong to the current user, so a link can never point at
// somebody else's contact record.
async function resolveContact(contactId, userId) {
    if (!contactId) return { contactId: null, contactName: '' };
    if (!/^[a-f\d]{24}$/i.test(String(contactId))) {
        return { error: 'Invalid contactId' };
    }
    const contact = await Contact.findOne({ _id: contactId, userId }).lean();
    if (!contact) return { error: 'Contact not found' };
    return { contactId: contact._id, contactName: getContactName(contact) };
}

// Apply an incoming contactId to an existing waitlist entry during a PATCH.
//
// Rules:
//   - contactId === undefined → leave the current link untouched
//   - contactId === null     → explicitly unlink
//   - same id as the current link → no-op (don't re-resolve): editing an unrelated
//                                  field on an entry whose contact has since been
//                                  deleted must not fail with "Contact not found"
//   - otherwise              → resolve it (must be a contact of the current user)
//
// Returns null on success, or { error } to be reported as a 400.
async function applyContactToEntry(entry, contactId, userId) {
    if (contactId === undefined) return null;
    if (contactId === null) {
        entry.contactId = null;
        entry.contactName = '';
        return null;
    }
    const alreadyLinked = entry.contactId && String(entry.contactId) === String(contactId);
    if (alreadyLinked) return null;
    const resolved = await resolveContact(contactId, userId);
    if (resolved.error) return { error: resolved.error };
    entry.contactId = resolved.contactId;
    entry.contactName = resolved.contactName;
    return null;
}

// Display name for a contact record, mirroring the frontend's contact picker
// (ContactAssignModal.getContactDisplayName) so the name shown on the waitlist card
// and the attendee name stored in the entry are always the same string.
function getContactName(contact) {
    const personal = (contact.personalName || '').trim();
    const breeder = (contact.breederName || '').trim();
    const prefix = (contact.prefix || '').trim();
    const suffix = (contact.suffix || '').trim();
    if (personal && breeder) return `${personal} (${breeder})`;
    if (personal) return [prefix, personal, suffix].filter(Boolean).join(' ');
    if (breeder) return [prefix, breeder, suffix].filter(Boolean).join(' ');
    return [prefix, personal, suffix].filter(Boolean).join(' ') || 'Unnamed Contact';
}

// Sort a list of waitlist entries into the requested order.
//
// 'oldest' / 'newest' order by entry date. 'manual' is the custom order set with the
// chevrons on each card: entries with a stored position come first in that order, and
// entries that were never positioned (sortOrder 0) go LAST otherwise every newly
// added entry jumped to the top and scrambled the order the user had set.
//
// Sorting happens in JS rather than in mongo so the "never positioned" rule can be
// applied (mongo would sort those 0s to the front).
function sortWaitlistEntries(entries, sortParam) {
    const byEntryDate = (a, b) => {
        const da = new Date(a.entryDate || a.createdAt).getTime();
        const db = new Date(b.entryDate || b.createdAt).getTime();
        return da - db;
    };
    const sorted = [...entries];
    if (sortParam === 'newest') {
        sorted.sort((a, b) => byEntryDate(b, a));
    } else if (sortParam === 'manual') {
        sorted.sort((a, b) => {
            const sa = a.sortOrder > 0 ? a.sortOrder : Infinity;
            const sb = b.sortOrder > 0 ? b.sortOrder : Infinity;
            if (sa !== sb) return sa - sb;
            return byEntryDate(a, b);
        });
    } else {
        sorted.sort(byEntryDate);
    }
    return sorted;
}

// GET /api/waitlist list all entries owned by the current user.
// Query: ?sort=oldest|newest|manual the order the caller wants.
//
// The order is honoured exactly. The old implementation force-switched to the
// manual order as soon as *any* entry had been positioned, which silently broke
// the "Oldest/Newest" toggle for everyone who had ever used the chevrons.
router.get('/', async (req, res) => {
    try {
        const sortParam = (req.query.sort || 'oldest').toString();
        const entries = await WaitlistEntry.find({ userId: req.user.id })
            // Populate the linked contact so the client can show its details without
            // an extra request. contactName stays as the snapshot taken when linking.
            .populate('contactId', 'personalName breederName prefix suffix linkedCTUID address');
        res.json(sortWaitlistEntries(entries, sortParam));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch waitlist', error: err.message });
    }
});

// POST /api/waitlist create a new waitlist entry (multi-species)
router.post('/', async (req, res) => {
    try {
        const { name, contactInfo, speciesRequests, species, genders, amount, notes, contactId } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

        // Normalize speciesRequests: array of { species, genders, amount }
        let requests = speciesRequests;
        if (!Array.isArray(requests) || requests.length === 0) {
            // Backward compat: build a single request from legacy fields
            if (!species?.trim()) return res.status(400).json({ message: 'At least one species is required' });
            requests = [{
                species: species.trim(),
                genders: Array.isArray(genders) ? genders : [],
                amount: amount !== '' && amount != null ? Number(amount) : 1,
            }];
        }
        requests = requests.filter(r => r.species?.trim());
        if (requests.length === 0) return res.status(400).json({ message: 'At least one species is required' });
        const normalized = requests.map(normalizeSpeciesRequest);
        const resolved = await resolveContact(contactId, req.user.id);
        if (resolved.error) return res.status(400).json({ message: resolved.error });

        const entry = new WaitlistEntry({
            userId: req.user.id,
            name: name.trim(),
            contactInfo: contactInfo || '',
            contactId: resolved.contactId,
            contactName: resolved.contactName,
            speciesRequests: normalized,
            // Mirror canonical request into legacy fields for quick lookup.
            species: normalized[0]?.species || '',
            genders: normalized[0]?.genders || [],
            amount: normalized[0]?.amount ?? 1,
            notes: notes || '',
        });
        await entry.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create waitlist entry', error: err.message });
    }
});

// PATCH /api/waitlist/:id update a waitlist entry (multi-species)
router.patch('/:id', async (req, res) => {
    try {
        const entry = await WaitlistEntry.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Waitlist entry not found' });
        const { name, contactInfo, speciesRequests, species, genders, amount, notes, isActive, contactId, sortOrder, entryDate } = req.body;
        if (name !== undefined) entry.name = name.trim();
        if (contactInfo !== undefined) entry.contactInfo = contactInfo;
        // contactId === null explicitly unlinks the contact; undefined leaves it as-is.
        const contactError = await applyContactToEntry(entry, contactId, req.user.id);
        if (contactError) return res.status(400).json({ message: contactError.error });
        if (Array.isArray(speciesRequests)) {
            entry.speciesRequests = speciesRequests.filter(r => r.species?.trim()).map(normalizeSpeciesRequest);
            const first = entry.speciesRequests[0];
            if (first) { entry.species = first.species; entry.genders = first.genders; entry.amount = first.amount; }
        } else {
            if (species !== undefined) entry.species = species;
            if (genders !== undefined) entry.genders = Array.isArray(genders) ? genders : [];
            if (amount !== undefined) entry.amount = amount !== '' && amount != null ? Number(amount) : 1;
        }
        if (notes !== undefined) entry.notes = notes;
        if (isActive !== undefined) entry.isActive = !!isActive;
        if (sortOrder !== undefined) entry.sortOrder = Number(sortOrder) || 0;
        if (entryDate !== undefined) entry.entryDate = entryDate ? new Date(entryDate) : null;
        await entry.save();
        res.json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update waitlist entry', error: err.message });
    }
});

// POST /api/waitlist/reorder bulk-assign sortOrder from an ordered ID list (move up/down).
// Body: { orderedIds: [id1, id2, id3, ...] } assigns sortOrder 1, 2, 3, … in list order.
router.post('/reorder', async (req, res) => {
    try {
        const { orderedIds } = req.body;
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({ message: 'orderedIds is required' });
        }
        const bulkOps = orderedIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id, userId: req.user.id },
                update: { $set: { sortOrder: index + 1 } },
            },
        }));
        await WaitlistEntry.bulkWrite(bulkOps);
        res.json({ message: 'Reordered' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to reorder waitlist', error: err.message });
    }
});

// POST /api/waitlist/:id/finalize move to history, snapshotting animals assigned via the picker
// (animals whose reservedWaitlistEntryId points at this entry)
router.post('/:id/finalize', async (req, res) => {
    try {
        const entry = await WaitlistEntry.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Waitlist entry not found' });
        const assigned = await Animal.find({
            creatorId: req.user.id,
            reservedWaitlistEntryId: entry._id,
        }).select('id_public name prefix suffix species gender reservedPrice reservedPriceCurrency reservedDeposit reservedDepositStatus reservedPaymentStatus').lean();
        entry.assignedAnimals = assigned.map(a => ({
            id_public: a.id_public,
            name: a.name,
            // prefix/suffix are part of the snapshot so the waitlist card can show the
            // animal's full display name (e.g. "Ratsy Doe of Windwhistle") later on.
            prefix: a.prefix || '',
            suffix: a.suffix || '',
            species: a.species,
            gender: a.gender,
            // The reservation money is snapshotted too, so a finalized entry can still
            // show what deposit/payment was due for its animals after the reservations
            // have been cleared by the rehome flow.
            reservedPrice: a.reservedPrice ?? null,
            reservedPriceCurrency: a.reservedPriceCurrency || 'USD',
            reservedDeposit: a.reservedDeposit ?? null,
            reservedDepositStatus: a.reservedDepositStatus || null,
            reservedPaymentStatus: a.reservedPaymentStatus || null,
            assignedAt: new Date(),
        }));
        entry.isActive = false;
        entry.finalizedAt = new Date();
        await entry.save();
        res.json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to finalize waitlist entry', error: err.message });
    }
});

// DELETE /api/waitlist/:id delete a waitlist entry
router.delete('/:id', async (req, res) => {
    try {
        const result = await WaitlistEntry.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!result) return res.status(404).json({ message: 'Waitlist entry not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete waitlist entry', error: err.message });
    }
});

module.exports = router;
// Exposed for unit tests (contact resolution / linking rules).
module.exports.resolveContact = resolveContact;
module.exports.getContactName = getContactName;
module.exports.applyContactToEntry = applyContactToEntry;
module.exports.sortWaitlistEntries = sortWaitlistEntries;
