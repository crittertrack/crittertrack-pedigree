const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Need jwt for the middleware

// --- IMPORT ALL REQUIRED FILES ---
const { registerUser, loginUser } = require('./database/db_service');
const animalRoutes = require('./routes/animalRoutes'); // New Animal Routes

// Load environment variables from .env file (for MONGODB_URI)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET; // Needed for auth middleware

// --- Middleware setup ---
app.use(cors());
app.use(express.json());

// --- CORE AUTHENTICATION MIDDLEWARE ---
/**
 * Verifies the JWT token and adds user data (id, email, id_public) to req.user.
 */
const authMiddleware = (req, res, next) => {
    // 1. Check for token in the Authorization header (Bearer <token>)
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication invalid: No token provided.' });
    }

    const token = authHeader.split(' ')[1]; // Extract the token part

    try {
        // 2. Verify the token using the secret
        const payload = jwt.verify(token, JWT_SECRET);
        
        // 3. Attach the user's data (from the token) to the request object
        // payload.id is the backend _id used for file ownership/access control.
        req.user = { id: payload.id, email: payload.email, id_public: payload.id_public }; 
        next(); // Proceed to the next middleware/route handler

    } catch (error) {
        // Handle token expiration or signature mismatch
        console.error('JWT Verification Error:', error.message);
        return res.status(401).json({ message: 'Authentication invalid: Token expired or invalid.' });
    }
};


// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI;

// Check for MongoDB URI before attempting connection
if (!mongoUri) {
    console.error('FATAL ERROR: MONGODB_URI environment variable is not set.');
    process.exit(1);
}

mongoose.connect(mongoUri)
    .then(() => {
        console.log('📦 MongoDB connection successful.');
        app.listen(PORT, () => {
            console.log(`🚀 CritterTrack Server is listening on port ${PORT}.`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });

// --- API Routes ---

// Health Check / Basic Route
app.get('/', (req, res) => {
    res.send('CritterTrack Backend API is running!');
});

// --- PUBLIC ROUTES (User Registration/Login) ---

/**
 * POST /api/users/register 
 */
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, password, personalName, breederName, profileImage, showBreederName } = req.body;
        if (!email || !password || !personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required.' });
        }
        
        // We get the model via mongoose.model('User') since it was registered in models.js
        const User = mongoose.model('User'); 
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(409).json({ message: 'This email is already registered.' });
        }

        const newUser = await registerUser({ email, password, personalName, breederName, profileImage, showBreederName });
        
        res.status(201).json({ 
            message: 'User registered successfully!',
            id_public: newUser.id_public
        });

    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

/**
 * POST /api/users/login
 */
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required for login.' });
        }
        
        const token = await loginUser(email, password); 

        res.status(200).json({ token });

    } catch (error) {
        if (error.message === 'User not found' || error.message === 'Invalid credentials') {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        console.error('Error during user login:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});


// --- PROTECTED ROUTES ---

// Mount the Animal routes and apply the authMiddleware.
// All requests to /api/animals/* will be checked for a valid JWT token first.
app.use('/api/animals', authMiddleware, animalRoutes);
