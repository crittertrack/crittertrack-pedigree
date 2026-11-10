const test = require('node:test');
const assert = require('node:assert/strict');
const {
    SECRET_USER_FIELDS, DEFAULT_EXCLUDED, fileNameFor, collectionFor, stripSecrets, looksLikeDataLoss, listBackupCollections, EJSON,
} = require('../utils/backupExport');

test('legacy file names map both ways', () => {
    assert.equal(fileNameFor('publicprofiles'), 'publicProfiles');
    assert.equal(fileNameFor('publicanimals'), 'publicAnimals');
    assert.equal(fileNameFor('litters'), 'litters');
    assert.equal(collectionFor('publicProfiles'), 'publicprofiles');
    assert.equal(collectionFor('transactions'), 'transactions');
});

test('secrets are stripped from users only, and the input is not mutated', () => {
    const user = { email: 'a@b.c', password: 'hash', resetPasswordToken: 't', adminPassword: 'x', personalName: 'A' };
    const [out] = stripSecrets('users', [user]);
    for (const f of SECRET_USER_FIELDS) assert.equal(f in out, false, f);
    assert.equal(out.email, 'a@b.c');
    assert.equal(user.password, 'hash');
    assert.deepEqual(stripSecrets('litters', [{ password: 'keep-me-not-a-user' }]), [{ password: 'keep-me-not-a-user' }]);
});

test('BACKUP_INCLUDE_SECRETS=true keeps credentials', () => {
    process.env.BACKUP_INCLUDE_SECRETS = 'true';
    try { assert.equal(stripSecrets('users', [{ password: 'h' }])[0].password, 'h'); }
    finally { delete process.env.BACKUP_INCLUDE_SECRETS; }
});

test('EJSON round-trips ObjectIds and Dates exactly', () => {
    const { ObjectId } = require('mongoose').mongo;
    const doc = { _id: new ObjectId(), at: new Date('2026-11-10T03:00:00Z'), n: 5 };
    const back = EJSON.parse(EJSON.stringify([doc], { relaxed: false }))[0];
    assert.equal(String(back._id), String(doc._id));
    assert.ok(back._id instanceof ObjectId);
    assert.equal(back.at.getTime(), doc.at.getTime());
});

test('collections are discovered from the database; ephemeral ones and views are skipped', async () => {
    const db = { listCollections: () => ({ toArray: async () => [
        { name: 'users' }, { name: 'litters' }, { name: 'brandnewcollection' }, { name: 'two_factor_codes' },
        { name: 'adminaccountsessions' }, { name: 'system.views' }, { name: 'someview', type: 'view' },
    ] }) };
    assert.deepEqual(await listBackupCollections(db), ['brandnewcollection', 'litters', 'users']);
    assert.ok(DEFAULT_EXCLUDED.includes('two_factor_codes'));
});

test('BACKUP_EXCLUDE_COLLECTIONS adds extra exclusions', async () => {
    process.env.BACKUP_EXCLUDE_COLLECTIONS = 'messages, notifications';
    try {
        const db = { listCollections: () => ({ toArray: async () => [{ name: 'messages' }, { name: 'notifications' }, { name: 'litters' }] }) };
        assert.deepEqual(await listBackupCollections(db), ['litters']);
    } finally { delete process.env.BACKUP_EXCLUDE_COLLECTIONS; }
});

test('data-loss guard flags an emptied database but not normal changes', () => {
    assert.match(looksLikeDataLoss({ users: 0, animals: 0 }, { users: 173, animals: 8109 }), /users dropped from 173 to 0/);
    assert.match(looksLikeDataLoss({ users: 170, animals: 100 }, { users: 173, animals: 8109 }), /animals dropped/);
    assert.equal(looksLikeDataLoss({ users: 171, animals: 8100 }, { users: 173, animals: 8109 }), null);
    assert.equal(looksLikeDataLoss({ users: 0, animals: 0 }, undefined), null);
    assert.equal(looksLikeDataLoss({ users: 1, animals: 1 }, { users: 5, animals: 5 }), null); // tiny/new installs are not alarming
});
