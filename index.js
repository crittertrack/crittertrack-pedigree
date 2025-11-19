// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./database/db_service');
const dbService = require('./database/db_service');
const jwt = require('jsonwebtoken');

// Ensure essential env variables are set
if (!process.env.MONGODB_URI) {
    console.error("FATAL ERROR: MONGODB_URI is not defined.");
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined.");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // for parsing application/json

// --- API Routes ---

/**
 * Helper middleware to verify JWT token.
 * Attaches user payload (e.g., { id: 'backend_id', email: '...', id_public: 1001 }) to req.user
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: 'Bearer TOKEN'
    
    if (token == null) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }
        req.user = user; // user payload from the token
        next();
    });
};

// --- User Routes ---

// 1. User Registration Route
app.post('/api/users/register', async (req, res) => {
    try {
        // password, email, personalName, etc. are in req.body
        const user = await dbService.registerUser(req.body);
        res.status(201).json({ 
            message: 'User registered successfully.',
            userId: user._id,
            id_public: user.id_public
        });
    } catch (error) {
        if (error.message.includes('Email already in use')) {
            return res.status(409).json({ message: error.message });
        }
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// 2. User Login Route
app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const token = await dbService.loginUser(email, password);
        res.json({ token, message: 'Login successful.' });
    } catch (error) {
        if (error.message === 'User not found' || error.message === 'Invalid credentials') {
            return res.status(401).json({ message: error.message });
        }
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// 3. Update User Profile (Protected)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const updatedUser = await dbService.updateProfile(req.user.id, req.body);
        res.json({ message: 'Profile updated.', user: updatedUser });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// 4. Search Public Profiles (Public)
app.get('/api/users/search', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ message: 'Search query is required.' });
    }
    try {
        const results = await dbService.searchPublicProfiles(query);
        res.json(results);
    } catch (error) {
        console.error('Profile search error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


// --- Animal Routes ---

// 5. Add Animal (Protected)
app.post('/api/animals', authenticateToken, async (req, res) => {
    try {
        const newAnimal = await dbService.addAnimal(req.user.id, req.body);
        res.status(201).json(newAnimal);
    } catch (error) {
        console.error('Add animal error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// 6. Get Logged-in User's Animals (Function 1 - Protected)
app.get('/api/animals', authenticateToken, async (req, res) => {
    try {
        const animals = await dbService.getUsersAnimals(req.user.id, req.query);
        res.json(animals);
    } catch (error) {
        console.error('Get user animals error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// 7. Toggle Animal Public Visibility (Function 2 - Protected)
app.patch('/api/animals/:animalId/toggle-public', authenticateToken, async (req, res) => {
    const { animalId } = req.params;
    const { makePublic } = req.body; // { "makePublic": true }
    
    if (typeof makePublic !== 'boolean') {
        return res.status(400).json({ message: 'Field "makePublic" (boolean) is required.' });
    }

    try {
        const updatedAnimal = await dbService.toggleAnimalPublic(req.user.id, animalId, makePublic);
        res.json({ 
            message: `Animal visibility set to ${makePublic}.`, 
            id_public: updatedAnimal.id_public,
            showOnPublicProfile: updatedAnimal.showOnPublicProfile
        });
    } catch (error) {
        console.error('Toggle animal public error:', error);
        res.status(500).json({ message: error.message });
    }
});

// 8. Get a User's Public-Facing Animals (Public)
app.get('/api/users/:userPublicId/animals', async (req, res) => {
    try {
        const userPublicId = parseInt(req.params.userPublicId, 10);
        if (isNaN(userPublicId)) {
            return res.status(400).json({ message: 'Invalid User Public ID.' });
        }
        const animals = await dbService.getPublicAnimalsByUser(userPublicId);
        res.json(animals);
    } catch (error) {
        console.error('Get public animals error:', error);
        res.status(500).json({ message: error.message });
    }
});


// --- Litter Routes ---

// 9. Add Litter (Protected)
app.post('/api/litters', authenticateToken, async (req, res) => {
    try {
        const newLitter = await dbService.addLitter(req.user.id, req.body);
        res.status(201).json(newLitter);
    } catch (error) {
        console.error('Add litter error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// 10. Register Offspring to Litter (Protected)
app.patch('/api/litters/:litterId/register-offspring', authenticateToken, async (req, res) => {
    const { litterId } = req.params;
    const { offspringPublicId } = req.body; // { "offspringPublicId": 1045 }

    if (!offspringPublicId) {
        return res.status(400).json({ message: 'Field "offspringPublicId" is required.' });
    }
    
    try {
        const updatedLitter = await dbService.registerOffspringToLitter(req.user.id, litterId, offspringPublicId);
        res.json({ message: 'Offspring linked to litter.', litter: updatedLitter });
    } catch (error) {
        console.error('Register offspring error:', error);
        res.status(500).json({ message: error.message });
    }
});


// --- Start Server ---
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`CritterTrack Server running on http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('Failed to connect to DB and start server:', error);
    process.exit(1);
});
