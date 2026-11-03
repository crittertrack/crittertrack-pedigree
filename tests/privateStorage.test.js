const test = require('node:test');
const assert = require('node:assert/strict');
const { createPrivateStorage } = require('../utils/privateStorage');

// A fake S3 client that records what it is asked to do.
const fakeClient = (handler) => {
    const sent = [];
    return { sent, send: async (command) => { sent.push(command); return handler ? handler(command) : {}; } };
};

test('refuses to store anything when no private bucket is configured (never falls back to public)', async () => {
    const storage = createPrivateStorage({ client: fakeClient(), bucket: '' });
    assert.equal(storage.isConfigured(), false);
    await assert.rejects(storage.put('k', Buffer.from('x'), 'application/pdf'), (e) => e.code === 'STORAGE_NOT_CONFIGURED');
    await assert.rejects(storage.get('k'), (e) => e.code === 'STORAGE_NOT_CONFIGURED');
    assert.equal(await storage.remove('k'), false);
});

test('stores files in the private bucket with their content type', async () => {
    const client = fakeClient();
    const storage = createPrivateStorage({ client, bucket: 'private-bucket' });
    assert.equal(storage.isConfigured(), true);
    await storage.put('receipts/u1/a.pdf', Buffer.from('pdf'), 'application/pdf');
    assert.equal(client.sent.length, 1);
    assert.equal(client.sent[0].input.Bucket, 'private-bucket');
    assert.equal(client.sent[0].input.Key, 'receipts/u1/a.pdf');
    assert.equal(client.sent[0].input.ContentType, 'application/pdf');
});

test('reads a stored file back as a buffer', async () => {
    const client = fakeClient(() => ({
        ContentType: 'application/pdf',
        Body: { transformToByteArray: async () => new Uint8Array([37, 80, 68, 70]) },
    }));
    const storage = createPrivateStorage({ client, bucket: 'b' });
    const file = await storage.get('k');
    assert.equal(file.buffer.toString(), '%PDF');
    assert.equal(file.contentType, 'application/pdf');
});

test('a missing file reads back as null, other errors are not hidden', async () => {
    const missing = createPrivateStorage({ client: fakeClient(() => { const e = new Error('nope'); e.name = 'NoSuchKey'; throw e; }), bucket: 'b' });
    assert.equal(await missing.get('k'), null);

    const broken = createPrivateStorage({ client: fakeClient(() => { throw new Error('network down'); }), bucket: 'b' });
    await assert.rejects(broken.get('k'), /network down/);
});

test('removing a file never throws, and ignores empty keys', async () => {
    const failing = createPrivateStorage({ client: fakeClient(() => { throw new Error('boom'); }), bucket: 'b' });
    assert.equal(await failing.remove('k'), false);

    const client = fakeClient();
    const ok = createPrivateStorage({ client, bucket: 'b' });
    assert.equal(await ok.remove(null), false);
    assert.equal(client.sent.length, 0);
    assert.equal(await ok.remove('receipts/u1/a.pdf'), true);
    assert.equal(client.sent[0].input.Key, 'receipts/u1/a.pdf');
});
