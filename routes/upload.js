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

    console.log('Upload request received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.buffer.length
    });

    // Sanitize filename - remove special characters and URL-unsafe chars
    const sanitizedFilename = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace unsafe chars with underscore
      .replace(/_+/g, '_')               // Replace multiple underscores with single
      .replace(/^_|_$/g, '')             // Remove leading/trailing underscores
      .substring(0, 100);                 // Limit length

    // Create form data to send to R2 uploader
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: sanitizedFilename,
      contentType: req.file.mimetype
    });

    // Upload to R2
    console.log('Uploading to R2:', R2_UPLOADER_URL, 'as', sanitizedFilename);
    const uploadResponse = await axios.post(R2_UPLOADER_URL, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000 // 30 second timeout
    });

    console.log('R2 upload response:', uploadResponse.data);

    if (uploadResponse.data && uploadResponse.data.url) {
      return res.json({ 
        url: uploadResponse.data.url,
        filename: uploadResponse.data.key || sanitizedFilename
      });
    } else if (uploadResponse.data && uploadResponse.data.ok && uploadResponse.data.url) {
      // Handle R2 worker response format
      return res.json({ 
        url: uploadResponse.data.url,
        filename: uploadResponse.data.key || sanitizedFilename
      });
    } else {
      throw new Error('Invalid response from R2 uploader: ' + JSON.stringify(uploadResponse.data));
    }
  } catch (err) {
    console.error('Upload error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
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