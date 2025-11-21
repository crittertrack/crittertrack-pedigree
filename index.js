const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// --- IMPORT ALL REQUIRED FILES ---
const { 
    connectDB, 
    registerUser, 
    loginUser, 
    updateUserProfile 
} = require('./database/db_service');
const animalRoutes = require('./routes/animalRoutes'); 
const publicRoutes = require('./routes/publicRoutes');
const litterRoutes = require('./routes/litterRoutes');
const pedigreeRoutes = require('./routes/pedigreeRoutes');

// Load environment variables from .env file (for MONGODB_URI, JWT_SECRET)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET; 

// --- CORS Configuration (FIXED to allow custom Vercel domain) ---
// 1. Define the specific origins allowed to access this API
const allowedOrigins = [
    'http://localhost:3000',       // For local development
    'https://crittertrack.net',      // The bare custom domain
    'https://www.crittertrack.net',  // Your confirmed main production domain
    // Add your default Vercel domain here as a safeguard for preview builds/proxies:
    // Example: 'https://crittertrack-pedigree.vercel.app', 
];

// 2. Configure CORS middleware options
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps) OR if origin is in the allowed list
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy error: Origin ${origin} not allowed.`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, // IMPORTANT: Allows cookies and Authorization headers (needed for JWT)
    optionsSuccessStatus: 204
};

// 3. Apply the custom CORS middleware
app.use(cors(corsOptions));
// ---------------------------------

// --- General Middleware setup ---
app.use(express.json());


// --- CORE AUTHENTICATION MIDDLEWARE ---
/**
 * Verifies the JWT token and adds user data (id, email, id_public) to req.user.
 */
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication invalid: No token provided.' });
    }

    const token = authHeader.split(' ')[1]; 

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        
        req.user = { 
            id: payload.id, 
            email: payload.email,
            id_public: payload.id_public
        };
        
        next(); 
    } catch (error) {
        return res.status(401).json({ message: 'Authentication failed: Invalid or expired token.' });
    }
};


// --- PUBLIC ROUTES (User Auth/Registration) ---

/**
 * POST /api/users/register
 */
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, password, personalName, breederName, profileImage, showBreederName } = req.body;

        if (!email || !password || !personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required for registration.' });
        }
        
        const existingUser = await mongoose.model('User').findOne({ email }).select('+password');
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

/**
 * PUT /api/users/profile (PROTECTED)
 * Allows the logged-in user to update their personal and public profile details.
 */
app.put('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const userId_backend = req.user.id;
        const updates = req.body;

        if (updates.password) {
             // Prevent accidental password change via this route
             delete updates.password;
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


// --- ROUTE MOUNTING ---

// Public-facing routes (no auth required)
app.use('/api/public', publicRoutes); 

// Protected routes (require authMiddleware)
app.use('/api/animals', authMiddleware, animalRoutes);
app.use('/api/litters', authMiddleware, litterRoutes);
app.use('/api/pedigree', authMiddleware, pedigreeRoutes);


// --- START SERVER (Uses the safer logic from original index.js) ---

// Define the function that starts everything
const startServer = async () => {
    try {
        // 1. Connect to the database and AWAIT the result
        const dbUri = process.env.MONGODB_URI;
        if (!dbUri) {
            // This error is caught if the MONGODB_URI is not set in environment variables
            throw new Error("MONGODB_URI environment variable not found. Cannot connect to database.");
        }
        
        await connectDB(dbUri); 
        console.log('Database connection successful.'); 

        // 2. Start the Express server only after the DB is ready
        app.listen(PORT, () => {
            console.log(`Server is running and listening on port ${PORT}`);
        });

    } catch (error) {
        // If connectDB fails (e.g., MONGODB_URI missing or connection failed)
        console.error('FATAL ERROR: Failed to start server due to database connection issue.', error.message);
        // Exit the process so the application doesn't run without a database
        process.exit(1); 
    }
};

// Start the sequence
startServer();