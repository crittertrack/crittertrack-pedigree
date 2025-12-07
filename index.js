const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken'); // <-- REQUIRED for inlined Auth Middleware
require('dotenv').config();

// Database Connection Service and User Profile Controllers
const { 
    connectDB, 
    getUserProfileById, 
    updateUserProfile,
} = require('./database/db_service'); 

// Import User model for authMiddleware
const { User } = require('./database/models');

// --- Route Imports (Using existing folders: routes, database) ---
// Note: There is NO require for './middleware/auth' here.
const authRoutes = require('./routes/authRoutes'); 
const animalRoutes = require('./routes/animalRoutes');
const litterRoutes = require('./routes/litterRoutes');
const pedigreeRoutes = require('./routes/pedigreeRoutes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
// const adminRoutes = require('./routes/adminRoutes');


const app = express();
// Trust proxy headers so req.protocol reflects the front-facing protocol (useful on Railway)
app.set('trust proxy', true);

// --- Global Constants for Auth ---
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';


// --- INLINED AUTH MIDDLEWARE (FIXED: Resolves MODULE_NOT_FOUND) ---
/**
 * Middleware function to verify JWT token.
 * It expects the token in the 'Authorization' header as 'Bearer [token]'.
 * If valid, it adds the decoded user payload to req.user and proceeds.
 */
const authMiddleware = async (req, res, next) => {
    // 1. Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 401: Unauthorized - No token or invalid format
        return res.status(401).json({ message: 'Access denied. Valid token required.' });
    }
    
    // Authorization header format: "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    try {
        // 2. Verify token
        // The payload (decoded) contains { user: { id: <backend_id> } }
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. Attach user payload to the request (req.user.id will be the MongoDB _id)
        req.user = decoded.user;
        
        // 4. Fetch and attach user's public ID for notification creation
        try {
            const user = await User.findById(req.user.id).select('id_public');
            if (user) {
                req.user.id_public = user.id_public;
            }
        } catch (dbError) {
            console.error("Failed to fetch user public ID:", dbError.message);
            // Continue anyway - id_public is optional for most routes
        }
        
        // 5. Proceed to the next middleware/route handler
        next();
    } catch (error) {
        // 401: Unauthorized - Token is invalid or expired
        console.error("JWT verification failed:", error.message);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};


// --- Middleware Setup ---
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());
// Set Cross-Origin-Resource-Policy to allow cross-origin embedding of uploaded assets
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Admin routes (protected by authMiddleware and restricted by ADMIN_USER_ID)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', authMiddleware, adminRoutes);

// Multer instance for optional multipart handling on profile route
// Only accept PNG and JPEG/JPG files server-side
const imageFileFilter = (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('INVALID_FILE_TYPE'));
    }
};

const storage = multer.memoryStorage(); // Use memory storage to forward files to Worker
const uploadSingle = multer({ storage, limits: { fileSize: 500 * 1024 }, fileFilter: imageFileFilter });

// Provide a guarded upload endpoint that enforces file type and size server-side
// This endpoint now forwards uploads to the Cloudflare Worker (R2 storage)
app.post('/api/upload', uploadSingle.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        // Forward the file to the Cloudflare Worker for R2 storage
        const uploaderUrl = process.env.UPLOADER_URL || process.env.PUBLIC_HOST;
        if (!uploaderUrl) {
            // Fallback: save locally if no uploader configured
            const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
            let base = process.env.PUBLIC_URL || process.env.DOMAIN || null;
            if (base) {
                if (!/^https?:\/\//i.test(base)) base = `${proto}://${base}`;
                base = base.replace(/\/$/, '');
            } else {
                base = `${proto}://${req.get('host')}`;
            }
            const fileUrl = `${base}/uploads/${req.file.filename}`;
            return res.json({ url: fileUrl, filename: req.file.filename });
        }

        // Create FormData and forward to Worker
        const { Blob } = require('buffer');
        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);

        const workerResponse = await fetch(uploaderUrl, {
            method: 'POST',
            body: formData
        });

        if (!workerResponse.ok) {
            const errorText = await workerResponse.text();
            console.error('Worker upload failed:', errorText);
            return res.status(500).json({ message: 'Upload to storage failed' });
        }

        const result = await workerResponse.json();

        return res.json({ url: result.url, filename: result.key || req.file.originalname });
    } catch (err) {
        console.error('Upload endpoint error:', err && err.message ? err.message : err);
        return res.status(500).json({ message: 'Upload failed' });
    }
});

// --- Database Connection ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
     console.error("CRITICAL ERROR: MONGODB_URI is not defined.");
}
connectDB(MONGODB_URI);


// --- UNPROTECTED Routes ---

// Basic unprotected health check
app.get('/', (req, res) => {
    res.status(200).send('CritterTrack Backend API is running!');
});

// Diagnostic endpoint: expose relevant env vars for verification (temporary)
app.get('/diagnostic/env', (req, res) => {
    try {
        const info = {
            PUBLIC_HOST: process.env.PUBLIC_HOST || null,
            UPLOADER_URL: process.env.UPLOADER_URL || null,
            RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || null,
            NODE_ENV: process.env.NODE_ENV || null
        };
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: 'failed to read env' });
    }
});

// Authentication Routes (register and login)
app.use('/api/auth', authRoutes); 

// Public Data Routes
app.use('/api/public', publicRoutes);

// Admin Routes (for migrations and admin tasks)
// app.use('/api/admin', adminRoutes);

// Temporary diagnostic endpoint: list files in uploads directory
app.get('/api/uploads/list', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir || path.join(__dirname, 'uploads'));
        const fileInfos = files.map(f => ({
            filename: f,
            url: `${req.protocol}://${req.get('host')}/uploads/${f}`
        }));
        res.json({ files: fileInfos });
    } catch (err) {
        console.error('Failed to list uploads:', err.message);
        res.status(500).json({ message: 'Failed to list uploads', error: err.message });
    }
});


// --- PROTECTED Routes (Requires JWT token - using the inlined middleware) ---

// User Profile Management (Uses db_service functions directly)
app.get('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const userProfile = await getUserProfileById(req.user.id);
        res.json(userProfile);
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        res.status(404).json({ message: error.message });
    }
});

app.put('/api/users/profile', authMiddleware, uploadSingle.single('profileImage'), async (req, res) => {
    try {
        // Accept either JSON body or multipart upload (profileImage)
        const updates = req.body || {};

        // If a file was uploaded as part of multipart, map it to profileImage URL
        if (req.file) {
            // Prefer X-Forwarded-Proto when behind proxies (trust proxy must be enabled)
            const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
            const fileUrl = `${proto}://${req.get('host')}/uploads/${req.file.filename}`;
            updates.profileImage = fileUrl;
        } else {
            // Normalize common incoming JSON keys to profileImage
            updates.profileImage = updates.profileImage || updates.profileImageUrl || updates.imageUrl || updates.avatarUrl || updates.profile_image || undefined;
        }

        // Ensure stored URLs use HTTPS to avoid browser mixed-content issues
        if (updates.profileImage && typeof updates.profileImage === 'string' && updates.profileImage.startsWith('http://')) {
            updates.profileImage = updates.profileImage.replace(/^http:\/\//i, 'https://');
        }

        const updatedUser = await updateUserProfile(req.user.id, updates);
        res.json({ message: 'Profile updated successfully!', user: updatedUser });
    } catch (error) {
        console.error('Error updating user profile:', error.message);
        res.status(500).json({ message: 'Internal server error during profile update.' });
    }
});

// Delete user account
app.delete('/api/users/account', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { User, PublicProfile, Animal, PublicAnimal, Litter, Notification } = require('./database/models');
        
        // Delete all user's animals from both collections
        await Animal.deleteMany({ ownerId: userId });
        const userPublicId = await User.findById(userId).select('id_public');
        if (userPublicId) {
            await PublicAnimal.deleteMany({ ownerId_public: userPublicId.id_public });
        }
        
        // Delete all user's litters
        await Litter.deleteMany({ ownerId: userId });
        
        // Delete all notifications for this user
        await Notification.deleteMany({ userId: userId });
        
        // Delete public profile
        if (userPublicId) {
            await PublicProfile.deleteOne({ id_public: userPublicId.id_public });
        }
        
        // Delete user account
        await User.deleteOne({ _id: userId });
        
        res.status(200).json({ message: 'Account deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user account:', error.message);
        res.status(500).json({ message: 'Failed to delete account.' });
    }
});

// Main Data Routes (Require authMiddleware)
// The middleware is applied here, before the router handles the request
app.use('/api/animals', authMiddleware, animalRoutes);
app.use('/api/litters', authMiddleware, litterRoutes);
app.use('/api/pedigree', authMiddleware, pedigreeRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);

// Genetics Feedback Routes (Require authMiddleware)
const geneticsFeedbackRoutes = require('./routes/geneticsFeedbackRoutes');
app.use('/api/genetics-feedback', authMiddleware, geneticsFeedbackRoutes);

// Bug Report Routes (Require authMiddleware)
const bugReportRoutes = require('./routes/bugReportRoutes');
app.use('/api/bug-reports', authMiddleware, bugReportRoutes);

// Species Routes (Public read, auth for write)
const speciesRoutes = require('./routes/speciesRoutes');
app.use('/api/species', speciesRoutes);

// Migration Routes (No auth for one-time migrations - remove after running)
const migrationRoutes = require('./routes/migrationRoutes');
app.use('/api/migrations', migrationRoutes);


// --- Error Handling Middleware ---
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err && err.stack ? err.stack : err);
    // Multer file size exceeded
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Uploaded file exceeds 500KB limit. Please compress the image (client will attempt compression automatically) or choose a smaller file.' });
    }
    // Invalid file type from multer fileFilter
    if (err && err.message === 'INVALID_FILE_TYPE') {
        return res.status(415).json({ message: 'Unsupported file type. Only PNG and JPEG images are allowed.' });
    }
    // Other Multer errors
    if (err && err.name === 'MulterError') {
        return res.status(400).json({ message: err.message || 'File upload error.' });
    }

    // Send a generic 500 status response for unhandled errors
    res.status(500).send({ message: 'Something broke on the server!', error: err && err.message ? err.message : String(err) });
});


// --- Server Start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});