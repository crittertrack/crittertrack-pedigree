const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_ATTACHMENT_BYTES,
    MAX_ATTACHMENTS_PER_TRANSACTION,
    formatReceiptNumber,
    sanitizeFilename,
    checkAttachmentFile,
    sniffFileType,
    contentMatchesType,
    normaliseKind,
    buildAttachmentKey,
    buildAttachment,
} = require('../utils/receipts');

const file = (over = {}) => ({ mimetype: 'application/pdf', size: 1000, originalname: 'vet.pdf', ...over });

test('formats receipt numbers from the shared counter (first value is 1001)', () => {
    assert.equal(formatReceiptNumber(1001), 'R-0001');
    assert.equal(formatReceiptNumber(1002), 'R-0002');
    assert.equal(formatReceiptNumber(2000), 'R-1000');
    assert.equal(formatReceiptNumber(12000), 'R-11000');
    // Never produces R-0000 or a negative number.
    assert.equal(formatReceiptNumber(1000), 'R-0001');
    assert.equal(formatReceiptNumber('nope'), 'R-0001');
});

test('sanitizes file names', () => {
    assert.equal(sanitizeFilename('C:\\Users\\me\\receipt.pdf'), 'receipt.pdf');
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeFilename('  a\u0000b \n c.png '), 'ab c.png');
    assert.equal(sanitizeFilename(''), 'attachment');
    assert.equal(sanitizeFilename(null, 'x'), 'x');
    assert.equal(sanitizeFilename('a'.repeat(300)).length, 100);
});

test('accepts images and PDFs within the limits', () => {
    for (const mimetype of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) {
        assert.equal(checkAttachmentFile(file({ mimetype })), null);
    }
    assert.equal(checkAttachmentFile(file({ size: MAX_ATTACHMENT_BYTES })), null);
});

test('rejects missing, wrong-type, empty, oversized files and too many attachments', () => {
    assert.match(checkAttachmentFile(null), /No file/);
    assert.match(checkAttachmentFile(file({ mimetype: 'application/zip' })), /Only PNG/);
    assert.match(checkAttachmentFile(file({ mimetype: 'text/html' })), /Only PNG/);
    assert.match(checkAttachmentFile(file({ size: 0 })), /empty/);
    assert.match(checkAttachmentFile(file({ size: MAX_ATTACHMENT_BYTES + 1 })), /5 MB/);
    assert.match(checkAttachmentFile(file(), MAX_ATTACHMENTS_PER_TRANSACTION), /at most 10/);
    assert.equal(checkAttachmentFile(file(), MAX_ATTACHMENTS_PER_TRANSACTION - 1), null);
});

test('reads the size from the buffer when multer has no size field', () => {
    assert.equal(checkAttachmentFile({ mimetype: 'image/png', buffer: Buffer.alloc(10) }), null);
    assert.match(checkAttachmentFile({ mimetype: 'image/png', buffer: Buffer.alloc(0) }), /empty/);
});

test('only known attachment kinds are kept', () => {
    assert.equal(normaliseKind('receipt'), 'receipt');
    assert.equal(normaliseKind('upload'), 'upload');
    assert.equal(normaliseKind('whatever'), 'upload');
    assert.equal(normaliseKind(undefined), 'upload');
});

test('builds a storage key under the user with the right extension', () => {
    assert.equal(buildAttachmentKey('u1', 'application/pdf', 123, 0.5), 'receipts/u1/123-i.pdf');
    assert.match(buildAttachmentKey('u1', 'image/jpeg', 1), /^receipts\/u1\/1-[a-z0-9]+\.jpg$/);
});

test('builds the attachment record from an upload, with a private key and no public url', () => {
    const when = new Date('2026-01-02T00:00:00Z');
    const a = buildAttachment({ key: 'receipts/u1/1-a.pdf', file: file({ originalname: '../vet bill.pdf' }), kind: 'receipt', uploadedAt: when });
    assert.deepEqual(a, {
        key: 'receipts/u1/1-a.pdf', filename: 'vet bill.pdf', mimeType: 'application/pdf',
        size: 1000, kind: 'receipt', uploadedAt: when,
    });
    assert.equal('url' in a, false);
});

const pdfBytes = () => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20)]);
const pngBytes = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const jpegBytes = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const webpBytes = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(10)]);

test('recognises real file types from their contents', () => {
    assert.equal(sniffFileType(pdfBytes()), 'application/pdf');
    assert.equal(sniffFileType(pngBytes()), 'image/png');
    assert.equal(sniffFileType(jpegBytes()), 'image/jpeg');
    assert.equal(sniffFileType(webpBytes()), 'image/webp');
    assert.equal(sniffFileType(Buffer.from('<html><script>alert(1)</script></html>')), null);
    assert.equal(sniffFileType(Buffer.from('MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000')), null);
    assert.equal(sniffFileType(Buffer.alloc(3)), null);
    assert.equal(sniffFileType(null), null);
});

test('a file must really be what it claims to be', () => {
    assert.equal(contentMatchesType(pdfBytes(), 'application/pdf'), true);
    assert.equal(contentMatchesType(jpegBytes(), 'image/jpg'), true);
    // A web page renamed to .pdf, or an image claiming to be a PDF, is refused.
    assert.equal(contentMatchesType(Buffer.from('<html>not a pdf at all</html>'), 'application/pdf'), false);
    assert.equal(contentMatchesType(pngBytes(), 'application/pdf'), false);
    assert.equal(contentMatchesType(pdfBytes(), 'image/png'), false);
});
