const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const router = express.Router();

// Use memory storage to avoid saving files locally
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/webp') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
    }
  }
});

// R2 uploader URL
const R2_UPLOADER_URL = process.env.R2_UPLOADER_URL || 'https://uploads.crittertrack.net';

// POST /api/upload - proxy to R2 uploader
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create form data to send to R2 uploader
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Upload to R2
    const uploadResponse = await axios.post(R2_UPLOADER_URL, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (uploadResponse.data && uploadResponse.data.url) {
      return res.json({ 
        url: uploadResponse.data.url,
        filename: uploadResponse.data.key || req.file.originalname
      });
    } else {
      throw new Error('Invalid response from R2 uploader');
    }
  } catch (err) {
    console.error('Upload error:', err.response?.data || err.message);
    return res.status(500).json({ 
      error: 'Failed to upload file',
      details: err.response?.data || err.message 
    });
  }
});

// DELETE /api/upload/:filename - Note: This endpoint is deprecated as files are now in R2
// Kept for backward compatibility but will not delete R2 files
router.delete('/:filename', (req, res) => {
  return res.status(410).json({ 
    message: 'Delete endpoint deprecated. Files are stored in R2 and managed separately.' 
  });
});

module.exports = router;