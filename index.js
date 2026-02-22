const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken'); // <-- REQUIRED for inlined Auth Middleware
require('dotenv').config();
const { ProfanityError } = require('./utils/profanityFilter');

// Database Connection Service and User Profile Controllers
const { 
    connectDB, 
    getUserProfileById, 
    updateUserProfile,
} = require('./database/db_service'); 

// Import User model for authMiddleware
const { User } = require('./database/models');

// Import 2FA models for authentication
const { TwoFactorCode, LoginAuditLog } = require('./database/2faModels');

// --- Route Imports (Using existing folders: routes, database) ---
// Note: There is NO require for './middleware/auth' here.
const authRoutes = require('./routes/authRoutes'); 
const animalRoutes = require('./routes/animalRoutes');
const litterRoutes = require('./routes/litterRoutes');
const pedigreeRoutes = require('./routes/pedigreeRoutes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fieldTemplateRoutes = require('./routes/fieldTemplateRoutes');


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
        
        // 4. Fetch and attach user's public ID, email, and role for authorization
        try {
            const user = await User.findById(req.user.id).select('id_public email role');
            if (user) {
                req.user.id_public = user.id_public;
                req.user.email = user.email;
                req.user.role = user.role || 'user'; // Attach role for authorization checks
            }
        } catch (dbError) {
            console.error("Failed to fetch user details:", dbError.message);
            // Continue anyway - id_public, email and role are optional for most routes
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
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for base64 images
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
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
const legacyAdminRoutes = require('./routes/admin');
app.use('/api/admin', authMiddleware, legacyAdminRoutes);

// Species admin routes (species management, configs, genetics builder)
const speciesAdminRoutes = require('./routes/speciesAdminRoutes');
app.use('/api/admin', authMiddleware, speciesAdminRoutes);

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

// --- Initialize Backup Scheduler ---
const { initBackupScheduler } = require('./utils/backupScheduler');
// Start the scheduler after a short delay to ensure DB is connected
setTimeout(() => {
    try {
        initBackupScheduler();
    } catch (err) {
        console.error('[Server] Failed to initialize backup scheduler:', err);
    }
}, 5000);


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

// Client IP endpoint - for maintenance mode bypass
app.get('/api/client-ip', (req, res) => {
    // Get IP from various possible headers (for proxied requests)
    const ip = (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip
    );
    res.json({ ip, clientIp: ip });
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
        
        console.log('[PROFILE UPDATE] Received updates:', {
            showBreederName: updates.showBreederName,
            breederName: updates.breederName,
            bio: updates.bio,
            showBio: updates.showBio,
            profileImage: updates.profileImage ? 'present' : 'none'
        });

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
        console.log('[PROFILE UPDATE] After update, user showBreederName:', updatedUser.showBreederName);
        res.json({ message: 'Profile updated successfully!', user: updatedUser });
    } catch (error) {
        console.error('Error updating user profile:', error.message);
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during profile update.' });
    }
});

// Tutorial completion tracking
app.post('/api/users/tutorial-complete', authMiddleware, async (req, res) => {
    try {
        const { tutorialId, isOnboardingComplete, isAdvancedFeaturesComplete } = req.body;
        const { PublicProfile } = require('./database/models');
        
        const userProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        // Add tutorial to completedTutorials if not already there
        if (!userProfile.completedTutorials.includes(tutorialId)) {
            userProfile.completedTutorials.push(tutorialId);
        }

        // Mark onboarding as complete if specified
        if (isOnboardingComplete) {
            userProfile.hasCompletedOnboarding = true;
        }

        // Mark advanced features as complete if specified
        if (isAdvancedFeaturesComplete) {
            userProfile.hasCompletedAdvancedFeatures = true;
        }

        await userProfile.save();
        
        res.json({ 
            message: 'Tutorial progress saved',
            completedTutorials: userProfile.completedTutorials,
            hasCompletedOnboarding: userProfile.hasCompletedOnboarding,
            hasCompletedAdvancedFeatures: userProfile.hasCompletedAdvancedFeatures
        });
    } catch (error) {
        console.error('Error saving tutorial completion:', error);
        res.status(500).json({ message: 'Failed to save tutorial progress' });
    }
});

// Dismiss welcome banner
app.post('/api/users/dismiss-welcome-banner', authMiddleware, async (req, res) => {
    try {
        const { PublicProfile } = require('./database/models');
        
        const userProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        userProfile.hasSeenWelcomeBanner = true;
        await userProfile.save();

        res.json({ 
            success: true, 
            hasSeenWelcomeBanner: true 
        });
    } catch (error) {
        console.error('Error dismissing welcome banner:', error);
        res.status(500).json({ message: 'Failed to dismiss welcome banner' });
    }
});

app.get('/api/users/tutorial-progress', authMiddleware, async (req, res) => {
    try {
        const { PublicProfile } = require('./database/models');
        
        console.log('[TUTORIAL PROGRESS] Fetching for user:', req.user.id);
        
        const userProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!userProfile) {
            console.log('[TUTORIAL PROGRESS] User profile not found for:', req.user.id);
            return res.status(404).json({ message: 'User profile not found' });
        }

        const response = {
            completedTutorials: userProfile.completedTutorials || [],
            hasCompletedOnboarding: userProfile.hasCompletedOnboarding || false,
            hasCompletedAdvancedFeatures: userProfile.hasCompletedAdvancedFeatures || false,
            hasSeenWelcomeBanner: userProfile.hasSeenWelcomeBanner || false,
            hasSeenProfileSetupGuide: userProfile.hasSeenProfileSetupGuide || false
        };
        
        console.log('[TUTORIAL PROGRESS] Returning:', response);
        
        res.json(response);
    } catch (error) {
        console.error('[TUTORIAL PROGRESS] Error:', error);
        res.status(500).json({ message: 'Failed to fetch tutorial progress' });
    }
});

// Dismiss profile setup guide
app.post('/api/users/dismiss-profile-setup-guide', authMiddleware, async (req, res) => {
    try {
        const { PublicProfile } = require('./database/models');
        
        console.log('[DISMISS PROFILE SETUP GUIDE] User ID:', req.user.id);
        
        const userProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!userProfile) {
            console.log('[DISMISS PROFILE SETUP GUIDE] User profile not found for:', req.user.id);
            return res.status(404).json({ message: 'User profile not found' });
        }

        console.log('[DISMISS PROFILE SETUP GUIDE] Before save:', userProfile.hasSeenProfileSetupGuide);
        userProfile.hasSeenProfileSetupGuide = true;
        await userProfile.save();
        console.log('[DISMISS PROFILE SETUP GUIDE] After save:', userProfile.hasSeenProfileSetupGuide);
        
        // Verify it was saved by reading it back
        const verifyProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        console.log('[DISMISS PROFILE SETUP GUIDE] Verification read:', verifyProfile.hasSeenProfileSetupGuide);

        res.json({ 
            success: true, 
            hasSeenProfileSetupGuide: true 
        });
    } catch (error) {
        console.error('[DISMISS PROFILE SETUP GUIDE] Error:', error);
        res.status(500).json({ message: 'Failed to dismiss profile setup guide' });
    }
});

// Get user's custom species order
app.get('/api/users/species-order', authMiddleware, async (req, res) => {
    try {
        const { PublicProfile } = require('./database/models');
        
        const userProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        res.json({ speciesOrder: userProfile.speciesOrder || [] });
    } catch (error) {
        console.error('[SPECIES ORDER] Error fetching:', error);
        res.status(500).json({ message: 'Failed to fetch species order' });
    }
});

// Save user's custom species order
app.post('/api/users/species-order', authMiddleware, async (req, res) => {
    try {
        const { PublicProfile } = require('./database/models');
        const { speciesOrder } = req.body;

        if (!Array.isArray(speciesOrder)) {
            return res.status(400).json({ message: 'speciesOrder must be an array' });
        }

        const userProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        userProfile.speciesOrder = speciesOrder;
        await userProfile.save();

        res.json({ success: true, speciesOrder });
    } catch (error) {
        console.error('[SPECIES ORDER] Error saving:', error);
        res.status(500).json({ message: 'Failed to save species order' });
    }
});

// Reset profile setup guide for testing (admin/moderator only)
app.post('/api/users/reset-profile-setup-guide/:userIdPublic', authMiddleware, async (req, res) => {
    try {
        const { User, PublicProfile } = require('./database/models');
        const { userIdPublic } = req.params;
        
        // Check if requester is admin or moderator
        const requester = await User.findById(req.user.id);
        if (!requester || !['admin', 'moderator'].includes(requester.role)) {
            return res.status(403).json({ message: 'Access denied. Admin/Moderator only.' });
        }

        const userProfile = await PublicProfile.findOne({ id_public: userIdPublic });
        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        userProfile.hasSeenProfileSetupGuide = false;
        await userProfile.save();

        res.json({ 
            success: true, 
            message: `Reset profile setup guide for user ${userIdPublic}`,
            hasSeenProfileSetupGuide: false 
        });
    } catch (error) {
        console.error('Error resetting profile setup guide:', error);
        res.status(500).json({ message: 'Failed to reset profile setup guide' });
    }
});

// ==================== BREEDER DIRECTORY ENDPOINTS ====================

// GET /api/users/breeder-directory
// Public endpoint: Returns list of users who are active or retired breeders
app.get('/api/users/breeder-directory', async (req, res) => {
    try {
        const { PublicProfile } = require('./database/models');
        
        // Find all users with breedingStatus containing 'breeder' or 'retired'
        const breeders = await PublicProfile.find({
            $or: [
                { 'breedingStatus': { $exists: true } }
            ]
        }).select('id_public personalName showPersonalName breederName showBreederName bio profileImage breedingStatus country state')
          .lean();

        // Filter to only include users with at least one 'breeder' or 'retired' status
        const filteredBreeders = breeders.filter(profile => {
            if (!profile.breedingStatus) return false;
            
            // breedingStatus is a Map, need to check its values
            const statusObj = profile.breedingStatus instanceof Map 
                ? Object.fromEntries(profile.breedingStatus) 
                : profile.breedingStatus;
            
            return Object.values(statusObj).some(status => 
                status === 'breeder' || status === 'retired'
            );
        });

        // Convert Map to plain object for JSON response
        const processedBreeders = filteredBreeders.map(breeder => ({
            ...breeder,
            breedingStatus: breeder.breedingStatus instanceof Map 
                ? Object.fromEntries(breeder.breedingStatus)
                : breeder.breedingStatus
        }));

        res.json(processedBreeders);
    } catch (error) {
        console.error('Error fetching breeder directory:', error);
        res.status(500).json({ message: 'Failed to fetch breeder directory' });
    }
});

// PUT /api/users/breeding-status
// Protected endpoint: Update user's breeding status for species
app.put('/api/users/breeding-status', authMiddleware, async (req, res) => {
    try {
        const { User, PublicProfile } = require('./database/models');
        const { breedingStatus } = req.body;

        // Validate input
        if (!breedingStatus || typeof breedingStatus !== 'object') {
            return res.status(400).json({ message: 'breedingStatus object is required' });
        }

        // Validate all status values
        const validStatuses = ['breeder', 'retired'];
        for (const [species, status] of Object.entries(breedingStatus)) {
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ 
                    message: `Invalid status "${status}" for ${species}. Must be: breeder or retired` 
                });
            }
        }

        // Update in User model
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Replace the entire breedingStatus Map
        user.breedingStatus = new Map(Object.entries(breedingStatus));
        await user.save();

        // Also update PublicProfile
        const publicProfile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (publicProfile) {
            publicProfile.breedingStatus = new Map(Object.entries(breedingStatus));
            await publicProfile.save();
        }

        // Convert Map to object for response
        const breedingStatusObj = Object.fromEntries(user.breedingStatus);

        res.json({ 
            message: 'Breeding status updated successfully',
            breedingStatus: breedingStatusObj
        });
    } catch (error) {
        console.error('Error updating breeding status:', error);
        res.status(500).json({ message: 'Failed to update breeding status' });
    }
});

// GET /api/users/breeding-status
// Protected endpoint: Get current user's breeding status
app.get('/api/users/breeding-status', authMiddleware, async (req, res) => {
    try {
        const { User } = require('./database/models');
        
        const user = await User.findById(req.user.id).select('breedingStatus');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert Map to object for response
        const breedingStatusObj = user.breedingStatus 
            ? Object.fromEntries(user.breedingStatus)
            : {};

        res.json({ breedingStatus: breedingStatusObj });
    } catch (error) {
        console.error('Error fetching breeding status:', error);
        res.status(500).json({ message: 'Failed to fetch breeding status' });
    }
});

// ==================== END BREEDER DIRECTORY ENDPOINTS ====================


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

// Enclosure Routes (private management)
const enclosureRoutes = require('./routes/enclosureRoutes');
app.use('/api/enclosures', authMiddleware, enclosureRoutes);
app.use('/api/pedigree', authMiddleware, pedigreeRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/moderation', authMiddleware, moderationRoutes);

// Field Template Routes (some endpoints require admin auth)
app.use('/api/field-templates', fieldTemplateRoutes);

// Budget Routes (Require authMiddleware)
const budgetRoutes = require('./routes/budgetRoutes');
app.use('/api/budget', authMiddleware, budgetRoutes);

// Transfer Routes (Require authMiddleware)
const transferRoutes = require('./routes/transferRoutes');
app.use('/api/transfers', authMiddleware, transferRoutes);

// Genetics Feedback Routes (Require authMiddleware)
const geneticsFeedbackRoutes = require('./routes/geneticsFeedbackRoutes');
app.use('/api/genetics-feedback', authMiddleware, geneticsFeedbackRoutes);

// Bug Report Routes (Require authMiddleware)
const bugReportRoutes = require('./routes/bugReportRoutes');
app.use('/api/bug-reports', authMiddleware, bugReportRoutes);

// Feedback Routes (Require authMiddleware)
const feedbackRoutes = require('./routes/feedbackRoutes');
app.use('/api/feedback', authMiddleware, feedbackRoutes);

// Message Routes (Require authMiddleware)
const messageRoutes = require('./routes/messageRoutes');
app.use('/api/messages', authMiddleware, messageRoutes);

// Activity Log Routes (Require authMiddleware)
const activityLogRoutes = require('./routes/activityLogRoutes');
app.use('/api/activity-logs', authMiddleware, activityLogRoutes);

// Species Routes (GET is public, POST requires auth except migration)
const speciesRoutes = require('./routes/speciesRoutes');
app.use('/api/species', (req, res, next) => {
    if (req.method === 'POST' && req.path !== '/migrate-categories') {
        authMiddleware(req, res, next);
    } else {
        next();
    }
}, speciesRoutes);

// Migration Routes (No auth for one-time migrations - remove after running)
const migrationRoutes = require('./routes/migrationRoutes');
app.use('/api/migrations', migrationRoutes);

// Two-Factor Authentication Routes (2FA for admin/moderator access)
const twoFactorRoutes = require('./routes/twoFactorRoutes');
app.use('/api/admin', authMiddleware, twoFactorRoutes); // 2FA endpoints: send-code, verify-code, resend-code, track-login, login-history, suspicious-logins

// Admin Routes (Require authMiddleware)
app.use('/api/admin', authMiddleware, adminRoutes);


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
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// --- Scheduled Jobs ---
// Broadcast Cron Job: Send scheduled broadcasts every minute
const broadcastCronJob = async () => {
    try {
        const { Notification } = require('./database/models');
        
        // Find all pending notifications that are ready to send
        const now = new Date();
        const pendingNotifications = await Notification.find({
            isPending: true,
            sendAt: { $lte: now },
            type: 'broadcast'
        });

        if (pendingNotifications.length > 0) {
            console.log(`[BROADCAST CRON] Found ${pendingNotifications.length} broadcasts to send`);

            for (const notification of pendingNotifications) {
                try {
                    // Send email via Resend (if user has email notifications enabled)
                    const user = await require('./database/models').User.findById(notification.userId);
                    
                    if (user && user.emailNotificationPreference !== 'none') {
                        const { sendEmail } = require('./utils/emailService') || {};
                        if (sendEmail) {
                            await sendEmail(user.email, notification.title, notification.message);
                            console.log(`[BROADCAST CRON] Email sent to ${user.email}`);
                        }
                    }

                    // Mark as sent
                    notification.isPending = false;
                    notification.sentAt = new Date();
                    await notification.save();

                    // Log to audit
                    const { createAuditLog } = require('./utils/auditLogger');
                    await createAuditLog({
                        moderatorId: null,
                        moderatorEmail: 'system',
                        action: 'broadcast_sent',
                        targetType: 'system',
                        targetId: null,
                        details: {
                            title: notification.title,
                            recipientId: notification.userId,
                            scheduled: true,
                            scheduledFor: notification.sendAt.toISOString()
                        },
                        reason: `Scheduled broadcast: ${notification.title}`,
                        ipAddress: null,
                        userAgent: null
                    });
                } catch (error) {
                    console.error(`[BROADCAST CRON] Error sending broadcast to ${notification.userId}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('[BROADCAST CRON] Error in cron job:', error);
    }
};

// Run broadcast cron every minute
setInterval(broadcastCronJob, 60000);

// Also run once on startup after a short delay
setTimeout(broadcastCronJob, 5000);