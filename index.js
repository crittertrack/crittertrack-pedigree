const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Assuming these files exist in your project:
// NOTE: These files must be present for the server to run correctly.
const { registerUser } = require('./database/db_service'); 

// Load environment variables from .env file (for MONGODB_URI)
dotenv.config();

const app = express();

// --- CRITICAL FIX FOR DEPLOYMENT ---
// The server must listen on the port assigned by the hosting environment (e.g., Cloud Run), 
// or default to 8080 if running locally without the PORT variable set.
const PORT = process.env.PORT || 8080; 

// --- Middleware setup ---

// 1. CORS Middleware: Allows the React/Android frontends to communicate with the server.
// Allows all origins for development flexibility.
app.use(cors()); 

// 2. JSON Body Parser Middleware: Parses incoming JSON payloads.
app.use(express.json());

// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI;

// Check for MongoDB URI before attempting connection
if (!mongoUri) {
    console.error('FATAL ERROR: MONGODB_URI environment variable is not set. Please create a .env file and define it.');
    process.exit(1);
}

// Attempt to connect to MongoDB
mongoose.connect(mongoUri)
    .then(() => {
        console.log('📦 MongoDB connection successful.');
        
        // Start the server only after the DB connection is successful
        app.listen(PORT, () => {
            console.log(`🚀 CritterTrack Server is listening on port ${PORT}.`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        console.error('Failed to connect to DB. Ensure MONGODB_URI is correct and the database is running.', err);
        process.exit(1); // Exit if DB connection fails
    });

// --- API Routes ---

// Health Check / Basic Route
app.get('/', (req, res) => {
    res.send('CritterTrack Backend API is running!');
});

/**
 * POST /api/users/register
 * Handles new user registration, including validation and database storage.
 * Expected JSON Body: { email, password, personalName, breederName (optional), profileImage (optional) }
 */
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, password, personalName, breederName, profileImage } = req.body;

        // Basic validation: ensures required fields are present
        if (!email || !password || !personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required.' });
        }

        // Get the Mongoose Model. It should be registered either by user_schema.js or db_service.js
        const User = mongoose.model('User'); 
        
        // Check for existing user by email (ensures uniqueness)
        const existingUser = await User.findOne({ email: email });
        
        if (existingUser) {
            return res.status(409).json({ message: 'This email is already registered.' });
        }

        // Create the new user using the database service (handles password hashing and saving)
        const newUser = await createUser(email, password, personalName, breederName, profileImage);
        
        // Respond with success (201 Created) and the public ID for frontend confirmation
        res.status(201).json({ 
            message: 'User registered successfully!',
            id_public: newUser.id_public // Must match the field the frontend expects
        });

    } catch (error) {
        // Log the detailed error on the server side
        console.error('Error during user registration:', error);
        
        // Send a generic 500 error to the client
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});
