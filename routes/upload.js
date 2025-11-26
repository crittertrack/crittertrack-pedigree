const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';

// DELETE /api/upload/:filename
// Protected: requires a valid Bearer token. This endpoint is intended
// for maintenance (removing orphaned uploads). It does not perform
// ownership checks and should be used carefully.
router.delete('/:filename', (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization required.' });
    }
    const token = authHeader.replace('Bearer ', '');
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const filename = req.params.filename;
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ message: 'Invalid filename.' });
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    fs.unlinkSync(filePath);
    return res.json({ message: 'File deleted.' });
  } catch (err) {
    console.error('Failed to delete upload:', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Failed to delete file.' });
  }
});

module.exports = router;
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  const express = require('express');
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const jwt = require('jsonwebtoken');

  const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';

  const router = express.Router();

  // Ensure uploads directory exists
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

  const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 }, // 500KB limit to match server policy
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') cb(null, true);
      else cb(new Error('Only PNG and JPEG images are allowed'));
    }
  });

  // POST /api/upload
  router.post('/', upload.single('file'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      return res.json({ url, filename: req.file.filename });
    } catch (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // DELETE /api/upload/:filename
  // Protected: requires a valid Bearer token. This endpoint is intended
  // for maintenance (removing orphaned uploads). It does not perform
  // ownership checks and should be used carefully.
  router.delete('/:filename', (req, res) => {
    try {
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required.' });
      }
      const token = authHeader.replace('Bearer ', '');
      try {
        jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }

      const filename = req.params.filename;
      if (!filename || filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ message: 'Invalid filename.' });
      }

      const filePath = path.join(uploadDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found.' });
      }

      fs.unlinkSync(filePath);
      return res.json({ message: 'File deleted.' });
    } catch (err) {
      console.error('Failed to delete upload:', err && err.stack ? err.stack : err);
      return res.status(500).json({ message: 'Failed to delete file.' });
    }
  });

  module.exports = router;
