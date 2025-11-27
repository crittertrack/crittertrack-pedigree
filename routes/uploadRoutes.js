const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use the same uploads directory as other routes
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
        cb(null, name);
    }
});

const imageFileFilter = (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    const err = new Error('INVALID_FILE_TYPE');
    err.status = 415;
    return cb(err, false);
};

const upload = multer({ storage, limits: { fileSize: 500 * 1024 }, fileFilter: imageFileFilter });

// POST /upload
// Accepts multipart form-data with field `file` and returns a JSON with { url, filename }
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file provided.' });
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        return res.status(201).json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
        console.error('Upload error:', error && error.stack ? error.stack : error);
        if (error && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Uploaded file exceeds 500KB limit.' });
        if (error && error.message === 'INVALID_FILE_TYPE') return res.status(415).json({ message: 'Unsupported file type. Only PNG and JPEG images are allowed.' });
        return res.status(500).json({ message: 'Internal server error during upload.', error: error && error.message ? error.message : String(error) });
    }
});

// DELETE /upload/:filename
// Removes an uploaded file by filename. Note: in production you should verify ownership.
router.delete('/upload/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename || filename.includes('..')) return res.status(400).json({ message: 'Invalid filename.' });
        const filePath = path.join(uploadDir, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found.' });
        await fs.promises.unlink(filePath);
        return res.status(200).json({ message: 'File deleted.' });
    } catch (error) {
        console.error('Upload delete error:', error);
        return res.status(500).json({ message: 'Failed to delete file.' });
    }
});

module.exports = router;
