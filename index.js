const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Database Connection Service (Fixed path)
const { connectDB, getUserProfileById, updateUserProfile } = require('./database/db_service'); 
// Auth Middleware (FIXED PATH: resolves the MODULE_NOT_FOUND error)
const authMiddleware = require('./middleware/auth'); 

// --- Route Imports (Using the new routes folder) ---
const authRoutes = require('./routes/auth');
const animalRoutes = require('./routes/animalRoutes');
const litterRoutes = require('./routes/litterRoutes');
const pedigreeRoutes = require('./routes/pedigreeRoutes');
const publicRoutes = require('./routes/publicRoutes');


const app = express();

// --- Middleware Setup ---\
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());

// --- Database Connection ---\
// NOTE: Ensure your MONGODB_URI is set in your environment variables.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrackdb';
connectDB(MONGODB_URI);

// --- UNPROTECTED Routes ---\

// Basic unprotected health check
app.get('/', (req, res) => {
    res.status(200).send('CritterTrack Backend API is running!');
});

// Authentication and Public Data Routes (DO NOT require authMiddleware)
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);


// --- PROTECTED Routes (Requires JWT token) ---\

// Profile Management (GET & PUT)
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


// --- Error Handling Middleware ---\
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Send a generic 500 status response for unhandled errors
    res.status(500).send({ message: 'Something broke on the server!', error: err.message });
});


// --- Server Start ---\
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));