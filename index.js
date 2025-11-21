const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// --- IMPORT ALL REQUIRED FILES ---\n
const { 
    connectDB, 
    registerUser, 
    loginUser, 
    updateUserProfile // <<< NEW IMPORT
} = require('./database/db_service');
const animalRoutes = require('./routes/animalRoutes'); 
const publicRoutes = require('./routes/publicRoutes');
const litterRoutes = require('./routes/litterRoutes');
const pedigreeRoutes = require('./routes/pedigreeRoutes');

// Load environment variables from .env file (for MONGODB_URI)
dotenv.config();

// Connect to the database on startup
connectDB();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET; 

// --- Middleware setup ---\n
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
        // payload.id is the backend _id for the user
        req.user = payload; 
        next(); // Proceed to the protected route handler
    } catch (error) {
        // Token is invalid (expired, wrong secret, malformed)
        return res.status(401).json({ message: 'Authentication invalid: Token expired or invalid.' });
    }
};

// --- BASE ROUTE ---
app.get('/', (req, res) => {
    res.send('CritterTrack Pedigree API is running.');
});

// --- UNPROTECTED ROUTES (Users and Public Data) ---

/**
 * POST /api/users/register
 */
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, password, personalName, breederName, profileImage, showBreederName } = req.body;

        if (!email || !password || !personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required.' });
        }

        const newUser = await registerUser({ email, password, personalName, breederName, profileImage, showBreederName });
        
        res.status(201).json({ 
            message: 'User registered successfully!',
            id_public: newUser.id_public
        });

    } catch (error) {
        // Handle common MongoDB duplicate key error (code 11000) for email uniqueness
        if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
            return res.status(409).json({ message: 'This email is already registered.' });
        }

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

// Mount the PUBLIC routes (NO AUTH MIDDLEWARE)
app.use('/api/public', publicRoutes); 

// --- PROTECTED ROUTES ---\n

/**
 * PUT /api/users/profile
 * Updates the logged-in user's profile information.
 */
app.put('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const userId_backend = req.user.id;
        const updates = req.body;

        // Note: Password changes should be handled in a dedicated route, 
        // but we allow all other fields here.
        if (updates.password) {
             delete updates.password; // Prevent accidental password change via this route
             // If a user is changing their password, the database service needs to handle hashing it, 
             // but we prevent direct insertion here for safety.
        }

        const updatedUser = await updateUserProfile(userId_backend, updates);

        res.status(200).json({
            message: 'Profile updated successfully!',
            // Return only non-sensitive fields
            profile: {
                id_public: updatedUser.id_public,
                email: updatedUser.email,
                personalName: updatedUser.personalName,
                breederName: updatedUser.breederName,
                profileImage: updatedUser.profileImage,
                showBreederName: updatedUser.showBreederName,
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during profile update.' });
    }
});

// Mount the Animal routes
app.use('/api/animals', authMiddleware, animalRoutes);

// Mount the Litter routes
app.use('/api/litters', authMiddleware, litterRoutes);

// Mount the Pedigree routes
app.use('/api/pedigree', authMiddleware, pedigreeRoutes);


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
