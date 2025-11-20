const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
// FIX 1: Import the cors middleware
const cors = require('cors');

const { createUser } = require('./database/db_service');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 3000;

// Middleware setup

// FIX 2: Use cors middleware to allow cross-origin requests from any origin
// This resolves the "Failed to fetch" (CORS) error when the React frontend talks to the server.
app.use(cors()); 

// Middleware to parse JSON bodies
app.use(express.json());

// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
    .then(() => {
        console.log('MongoDB connection successful.');
        
        // Start the server only after the DB connection is successful
        app.listen(port, () => {
            console.log(`CritterTrack Server running on http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection failed:', err.message);
        console.error('Failed to connect to DB and start server:', err);
    });

// --- API Routes ---

// User Registration Route
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, password, personalName, breederName, profileImage } = req.body;

        // Basic validation
        if (!email || !password || !personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required.' });
        }

        // Check if the email already exists
        const existingUser = await mongoose.model('User').findOne({ email: email });
        if (existingUser) {
            return res.status(409).json({ message: 'This email is already registered.' });
        }

        // Create the new user using the database service
        const newUser = await createUser(email, password, personalName, breederName, profileImage);
        
        // Respond with success and the public ID
        res.status(201).json({ 
            message: 'User registered successfully!',
            id_public: newUser.id_public
        });

    } catch (error) {
        console.error('Error during user registration:', error);
        // Handle specific Mongoose validation errors or general server errors
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// Basic check route (optional)
app.get('/', (req, res) => {
    res.send('CritterTrack Backend API is running!');
});
