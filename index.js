const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken'); // <-- Required for inlined Auth Middleware
require('dotenv').config();

// Database Connection Service and Controllers
const { 
    connectDB, 
    getUserProfileById, 
    updateUserProfile
    // registerUser and loginUser are now imported by authRoutes
} = require('./database/db_service'); 

// --- Route Imports (Assumes routes/authRoutes.js now exists) ---
const authRoutes = require('./routes/authRoutes'); 
const animalRoutes = require('./routes/animalRoutes');
const litterRoutes = require('./routes/litterRoutes');
const pedigreeRoutes = require('./routes/pedigreeRoutes');
const publicRoutes = require('./routes/publicRoutes');


const app = express();

// --- Global Constants for Auth ---
// Ensure this secret is set in your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';


// --- INLINED AUTH MIDDLEWARE (Resolves MODULE_NOT_FOUND) ---
/**
 * Middleware function to verify JWT token.
 * It expects the token in the 'Authorization' header as 'Bearer [token]'.
 * If valid, it adds the decoded user payload to req.user and proceeds.
 */
const authMiddleware = (req, res, next) => {
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
        
        // 4. Proceed to the next middleware/route handler
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

// Authentication Routes (register and login)
app.use('/api/auth', authRoutes); 

// Public Data Routes
app.use('/api/public', publicRoutes);


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

app.put('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const updates = req.body;
        const updatedUser = await updateUserProfile(req.user.id, updates);
        res.json({ message: 'Profile updated successfully!', user: updatedUser });
    } catch (error) {
        console.error('Error updating user profile:', error.message);
        res.status(500).json({ message: 'Internal server error during profile update.' });
    }
});

// Main Data Routes (Require authMiddleware)
app.use('/api/animals', authMiddleware, animalRoutes);
app.use('/api/litters', authMiddleware, litterRoutes);
app.use('/api/pedigree', authMiddleware, pedigreeRoutes);


// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Send a generic 500 status response for unhandled errors
    res.status(500).send({ message: 'Something broke on the server!', error: err.message });
});


// --- Server Start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});