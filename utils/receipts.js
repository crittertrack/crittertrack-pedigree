// Pure helpers for Budget receipts and transaction attachments (no database or network access, so
// they can be unit-tested directly - see tests/receipts.test.js).

// File types allowed as attachments, mapped to the extension used for the stored key.
const ALLOWED_ATTACHMENT_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB, same as image uploads elsewhere in the app
const MAX_ATTACHMENTS_PER_TRANSACTION = 10;
const ATTACHMENT_KINDS = ['receipt', 'upload', 'invoice'];

// The shared Counter starts at 1000 and the first increment returns 1001, so subtract 1000 to get
// a friendly per-user number: 1001 -> R-0001.
function formatReceiptNumber(counterValue) {
    const n = Math.max(1, Math.floor(Number(counterValue) || 0) - 1000);
    return `R-${String(n).padStart(4, '0')}`;
}

// Strip any path, control characters and odd whitespace from an uploaded file name.
function sanitizeFilename(name, fallback = 'attachment') {
    const base = String(name || '').split(/[\\/]/).pop() || '';
    const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    return cleaned || fallback;
}

// Returns an error message when the file can't be attached, or null when it's fine.
function checkAttachmentFile(file, existingCount = 0) {
    if (!file) return 'No file uploaded.';
    if (!ALLOWED_ATTACHMENT_TYPES[file.mimetype]) return 'Only PNG, JPEG, WebP images and PDF files can be attached.';
    const size = file.size ?? (file.buffer ? file.buffer.length : 0);
    if (!(size > 0)) return 'The file is empty.';
    if (size > MAX_ATTACHMENT_BYTES) return 'Files must be 5 MB or smaller.';
    if (existingCount >= MAX_ATTACHMENTS_PER_TRANSACTION) {
        return `A transaction can have at most ${MAX_ATTACHMENTS_PER_TRANSACTION} attachments.`;
    }
    return null;
}

// Look at the file's first bytes to find out what it really is. The type a browser reports can be
// faked, so this is what decides whether a file is accepted. Returns a mime type or null.
function sniffFileType(buffer) {
    if (!buffer || buffer.length < 12) return null;
    if (buffer.slice(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
    if (buffer[0] === 0x89 && buffer.slice(1, 4).toString('latin1') === 'PNG') return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.slice(0, 4).toString('latin1') === 'RIFF' && buffer.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    return null;
}

// True when the file's real contents match the type it claims to be.
function contentMatchesType(buffer, claimedMime) {
    const real = sniffFileType(buffer);
    if (!real) return false;
    const normalise = (m) => (m === 'image/jpg' ? 'image/jpeg' : m);
    return real === normalise(claimedMime);
}

function normaliseKind(kind) {
    return ATTACHMENT_KINDS.includes(kind) ? kind : 'upload';
}

// Storage key for an uploaded attachment: receipts/<userId>/<timestamp>-<random>.<ext>
function buildAttachmentKey(userId, mimetype, now = Date.now(), random = Math.random()) {
    const ext = ALLOWED_ATTACHMENT_TYPES[mimetype] || 'bin';
    const rand = random.toString(36).slice(2, 10);
    return `receipts/${userId}/${now}-${rand}.${ext}`;
}

// The subdocument saved on the transaction once the file has been stored.
function buildAttachment({ key, file, kind, uploadedAt = new Date() }) {
    return {
        key, // private storage key - files are only readable through the authenticated download route
        filename: sanitizeFilename(file.originalname),
        mimeType: file.mimetype,
        size: file.size ?? (file.buffer ? file.buffer.length : 0),
        kind: normaliseKind(kind),
        uploadedAt,
    };
}

module.exports = {
    ALLOWED_ATTACHMENT_TYPES,
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
};
