const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { WaitlistEntry } = require('../database/models');
const Contact = require('../database/contactModel');
const waitlistRouter = require('../routes/waitlistRoutes');
const { resolveContact, getContactName, applyContactToEntry, sortWaitlistEntries } = waitlistRouter;

const USER_ID = new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60701');
const OTHER_USER_ID = new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60702');

const originalFindOne = Contact.findOne;

// Replace the Contact lookup with a stub so the linking rules can be tested
// without a live MongoDB connection.
function stubContactFindOne(behaviour) {
    Contact.findOne = behaviour;
}

test.afterEach(() => {
    Contact.findOne = originalFindOne;
});

test('resolveContact returns null link when contactId is missing', async () => {
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const result = await resolveContact(undefined, USER_ID);
    assert.equal(result.contactId, null);
    assert.equal(result.contactName, '');
    assert.equal(result.error, undefined);
});

test('resolveContact reports an error for a malformed contactId', async () => {
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const result = await resolveContact('not-an-object-id', USER_ID);
    assert.equal(result.error, 'Invalid contactId');
    assert.equal(result.contactId, undefined);
});

test('resolveContact links a contact that belongs to the current user', async () => {
    const contact = {
        _id: new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60703'),
        personalName: 'Jane Doe',
        breederName: 'Doe Rats',
    };
    let seenQuery = null;
    stubContactFindOne((query) => {
        seenQuery = query;
        return { lean: async () => contact };
    });

    const result = await resolveContact(contact._id, USER_ID);
    assert.equal(String(result.contactId), String(contact._id));
    assert.equal(result.contactName, 'Jane Doe (Doe Rats)');
    assert.equal(result.error, undefined);
    // The lookup must be scoped to the current user.
    assert.equal(String(seenQuery._id), String(contact._id));
    assert.equal(String(seenQuery.userId), String(USER_ID));
});

test('resolveContact reports an error when the contact belongs to another user', async () => {
    const contact = {
        _id: new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60704'),
        personalName: 'Someone Else',
    };
    // The stub emulates mongo's query scoping: nothing matches for a foreign userId.
    stubContactFindOne((query) => ({
        lean: async () => (String(query.userId) === String(USER_ID) ? contact : null),
    }));

    const result = await resolveContact(contact._id, OTHER_USER_ID);
    assert.equal(result.error, 'Contact not found');
    assert.equal(result.contactId, undefined);
});

test('resolveContact reports an error when the contact does not exist', async () => {
    stubContactFindOne(() => ({ lean: async () => null }));
    const result = await resolveContact(new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60705'), USER_ID);
    assert.equal(result.error, 'Contact not found');
    assert.equal(result.contactId, undefined);
});

test('resolveContact treats an explicit null contactId as an unlink', async () => {
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const result = await resolveContact(null, USER_ID);
    assert.equal(result.contactId, null);
    assert.equal(result.contactName, '');
    assert.equal(result.error, undefined);
});

test('getContactName mirrors the frontend contact picker display name', () => {
    assert.equal(getContactName({ personalName: 'Ann', breederName: 'AnnB' }), 'Ann (AnnB)');
    assert.equal(getContactName({ personalName: 'Ann' }), 'Ann');
    assert.equal(getContactName({ breederName: 'Bob' }), 'Bob');
    // Prefix/suffix are included when there is no breeder name, matching the picker.
    assert.equal(getContactName({ prefix: 'Dr', personalName: 'Ann', suffix: 'Jr' }), 'Dr Ann Jr');
    assert.equal(getContactName({ prefix: 'Dr', breederName: 'Bob', suffix: 'Jr' }), 'Dr Bob Jr');
    assert.equal(getContactName({ linkedCTUID: 'CTU-9' }), 'Unnamed Contact');
    assert.equal(getContactName({}), 'Unnamed Contact');
});

test('waitlist entry stores the linked contact id and the name snapshot', () => {
    const contactId = new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60706');
    const entry = new WaitlistEntry({
        userId: USER_ID,
        name: 'Jane',
        contactId,
        contactName: 'Jane Doe',
        speciesRequests: [{ species: 'Fancy Mouse', genders: ['Female'], amount: 1 }],
    });
    const obj = entry.toObject();
    assert.equal(String(obj.contactId), String(contactId));
    assert.equal(obj.contactName, 'Jane Doe');
});

test('waitlist entries without a contact keep the link empty', () => {
    const entry = new WaitlistEntry({
        userId: USER_ID,
        name: 'Sam',
        speciesRequests: [{ species: 'Fancy Rat', genders: ['Any'], amount: 1 }],
    });
    const obj = entry.toObject();
    assert.equal(obj.contactId, null);
    assert.equal(obj.contactName, '');
});

test('waitlist assignedAnimals snapshot keeps species and gender', () => {
    const entry = new WaitlistEntry({
        userId: new (require('mongoose').Types.ObjectId)('64b7f1c2a1b2c3d4e5f60718'),
        name: 'Jane',
        speciesRequests: [{ species: 'Fancy Mouse', genders: ['Female'], amount: 2 }],
        assignedAnimals: [
            { id_public: 'CTC1', name: 'Peanut', species: 'Fancy Mouse', gender: 'Female' },
            { id_public: 'CTC2', name: 'Butter', species: 'Fancy Rat', gender: 'Male' },
        ],
    });
    const snapshot = entry.toObject().assignedAnimals;
    assert.equal(snapshot.length, 2);
    assert.equal(snapshot[0].species, 'Fancy Mouse');
    assert.equal(snapshot[0].gender, 'Female');
    assert.equal(snapshot[1].species, 'Fancy Rat');
    assert.equal(snapshot[1].gender, 'Male');
});

test('waitlist assignedAnimals snapshot defaults species/gender to empty strings', () => {
    const entry = new WaitlistEntry({
        userId: new (require('mongoose').Types.ObjectId)('64b7f1c2a1b2c3d4e5f60718'),
        name: 'Sam',
        assignedAnimals: [{ id_public: 'CTC9' }],
    });
    const snapshot = entry.toObject().assignedAnimals;
    assert.equal(snapshot[0].species, '');
    assert.equal(snapshot[0].gender, '');
});

test('waitlist assignedAnimals snapshot keeps prefix and suffix', () => {
    const entry = new WaitlistEntry({
        userId: new (require('mongoose').Types.ObjectId)('64b7f1c2a1b2c3d4e5f60718'),
        name: 'Jane',
        assignedAnimals: [
            { id_public: 'CTC1', name: 'Peanut', prefix: 'Fancy', suffix: 'of Windwhistle', species: 'Fancy Mouse', gender: 'Female' },
        ],
    });
    const snapshot = entry.toObject().assignedAnimals;
    assert.equal(snapshot[0].prefix, 'Fancy');
    assert.equal(snapshot[0].suffix, 'of Windwhistle');
});

test('waitlist assignedAnimals snapshot defaults prefix/suffix to empty strings', () => {
    const entry = new WaitlistEntry({
        userId: new (require('mongoose').Types.ObjectId)('64b7f1c2a1b2c3d4e5f60718'),
        name: 'Sam',
        assignedAnimals: [{ id_public: 'CTC9' }],
    });
    const snapshot = entry.toObject().assignedAnimals;
    assert.equal(snapshot[0].prefix, '');
    assert.equal(snapshot[0].suffix, '');
});

test('waitlist assignedAnimals snapshot keeps the reservation money', () => {
    const entry = new WaitlistEntry({
        userId: new (require('mongoose').Types.ObjectId)('64b7f1c2a1b2c3d4e5f60718'),
        name: 'Jane',
        assignedAnimals: [{
            id_public: 'CTC1', name: 'Peanut', species: 'Fancy Mouse', gender: 'Female',
            reservedPrice: 40, reservedPriceCurrency: 'EUR', reservedDeposit: 20,
            reservedDepositStatus: 'due', reservedPaymentStatus: 'due',
        }],
    });
    const snapshot = entry.toObject().assignedAnimals;
    assert.equal(snapshot[0].reservedPrice, 40);
    assert.equal(snapshot[0].reservedPriceCurrency, 'EUR');
    assert.equal(snapshot[0].reservedDeposit, 20);
    assert.equal(snapshot[0].reservedDepositStatus, 'due');
    assert.equal(snapshot[0].reservedPaymentStatus, 'due');
});

test('waitlist assignedAnimals snapshot defaults the reservation money to empty', () => {
    const entry = new WaitlistEntry({
        userId: new (require('mongoose').Types.ObjectId)('64b7f1c2a1b2c3d4e5f60718'),
        name: 'Sam',
        assignedAnimals: [{ id_public: 'CTC9' }],
    });
    const snapshot = entry.toObject().assignedAnimals;
    assert.equal(snapshot[0].reservedPrice, null);
    assert.equal(snapshot[0].reservedDeposit, null);
    assert.equal(snapshot[0].reservedDepositStatus, null);
    assert.equal(snapshot[0].reservedPaymentStatus, null);
});

// --- Waitlist ordering -----------------------------------------------------------------

const mkEntry = (name, entryDate, sortOrder) => ({ name, entryDate, sortOrder });

test('sortWaitlistEntries orders by entry date for oldest and newest', () => {
    const entries = [
        mkEntry('B', '2026-01-02', 0),
        mkEntry('A', '2026-01-01', 0),
        mkEntry('C', '2026-01-03', 0),
    ];
    assert.deepEqual(
        sortWaitlistEntries(entries, 'oldest').map(e => e.name),
        ['A', 'B', 'C']
    );
    assert.deepEqual(
        sortWaitlistEntries(entries, 'newest').map(e => e.name),
        ['C', 'B', 'A']
    );
});

test('sortWaitlistEntries honours the requested order even when entries are positioned', () => {
    // The old implementation force-switched to the manual order as soon as any entry
    // had a position, which silently broke the oldest/newest toggle.
    const entries = [
        mkEntry('A', '2026-01-01', 2),
        mkEntry('B', '2026-01-02', 1),
    ];
    assert.deepEqual(
        sortWaitlistEntries(entries, 'oldest').map(e => e.name),
        ['A', 'B']
    );
    assert.deepEqual(
        sortWaitlistEntries(entries, 'newest').map(e => e.name),
        ['B', 'A']
    );
});

test('sortWaitlistEntries puts never-positioned entries last in the custom order', () => {
    const entries = [
        mkEntry('Unpositioned', '2026-01-01', 0),
        mkEntry('Third', '2026-01-02', 3),
        mkEntry('First', '2026-01-03', 1),
        mkEntry('Second', '2026-01-04', 2),
    ];
    assert.deepEqual(
        sortWaitlistEntries(entries, 'manual').map(e => e.name),
        ['First', 'Second', 'Third', 'Unpositioned']
    );
});

test('sortWaitlistEntries does not mutate the input array', () => {
    const entries = [mkEntry('B', '2026-01-02', 0), mkEntry('A', '2026-01-01', 0)];
    sortWaitlistEntries(entries, 'oldest');
    assert.deepEqual(entries.map(e => e.name), ['B', 'A']);
});


test('applyContactToEntry leaves the link untouched when contactId is undefined', async () => {
    const contactId = new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60710');
    const entry = { contactId, contactName: 'Jane Doe' };
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const result = await applyContactToEntry(entry, undefined, USER_ID);
    assert.equal(result, null);
    assert.equal(String(entry.contactId), String(contactId));
    assert.equal(entry.contactName, 'Jane Doe');
});

test('applyContactToEntry explicitly unlinks when contactId is null', async () => {
    const entry = {
        contactId: new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60711'),
        contactName: 'Jane Doe',
    };
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const result = await applyContactToEntry(entry, null, USER_ID);
    assert.equal(result, null);
    assert.equal(entry.contactId, null);
    assert.equal(entry.contactName, '');
});

test('applyContactToEntry replaces the link when a different contact is assigned', async () => {
    const contact = {
        _id: new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60712'),
        personalName: 'New Person',
    };
    stubContactFindOne(() => ({ lean: async () => contact }));
    const entry = {
        contactId: new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60713'),
        contactName: 'Old Person',
    };
    const result = await applyContactToEntry(entry, contact._id, USER_ID);
    assert.equal(result, null);
    assert.equal(String(entry.contactId), String(contact._id));
    assert.equal(entry.contactName, 'New Person');
});

test('applyContactToEntry is a no-op when the same contact is re-sent', async () => {
    // The contact may have been deleted in the meantime; re-sending the same id must not
    // fail the whole PATCH (e.g. when only the notes were edited).
    const contactId = new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60714');
    const entry = { contactId, contactName: 'Jane Doe' };
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const result = await applyContactToEntry(entry, String(contactId), USER_ID);
    assert.equal(result, null);
    assert.equal(String(entry.contactId), String(contactId));
    assert.equal(entry.contactName, 'Jane Doe');
});

test('applyContactToEntry reports an error for an unknown contact', async () => {
    stubContactFindOne(() => ({ lean: async () => null }));
    const entry = { contactId: null, contactName: '' };
    const result = await applyContactToEntry(entry, new mongoose.Types.ObjectId('64b7f1c2a1b2c3d4e5f60715'), USER_ID);
    assert.equal(result.error, 'Contact not found');
    // The entry must be left untouched when the link could not be resolved.
    assert.equal(entry.contactId, null);
});

test('applyContactToEntry reports an error for a malformed contactId', async () => {
    stubContactFindOne(() => { throw new Error('should not query the database'); });
    const entry = { contactId: null, contactName: '' };
    const result = await applyContactToEntry(entry, 'not-an-object-id', USER_ID);
    assert.equal(result.error, 'Invalid contactId');
    assert.equal(entry.contactId, null);
});
