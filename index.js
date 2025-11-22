const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

// Import database functions and middleware
const db = require('./database/db_service')
const { authMiddleware } = require('./middleware/auth');

// Load environment variables
require('dotenv').config(); 
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Initialize Express app
const app = express();

// --- Middleware Setup ---
app.use(helmet());
app.use(cors({
    origin: '*', // Allow all origins for development, secure this in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());

// --- Database Connection ---
db.connectDB(MONGODB_URI)
    .catch(err => {
        console.error("Failed to start server due to database connection error:", err);
        process.exit(1);
    });

// --- API Routes ---
const apiRouter = express.Router();

// Public Routes
apiRouter.post('/auth/register', async (req, res) => {
    try {
        const user = await db.registerUser(req.body);
        // Exclude sensitive data from response
        const { password, ...userWithoutPassword } = user.toObject();
        res.status(201).json({ 
            message: 'User registered successfully. Please log in.',
            userId: user.id_public // Provide the public ID for reference
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ message: error.message });
    }
});

apiRouter.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const loginResult = await db.loginUser(email, password);
        res.json(loginResult);
    } catch (error) {
        console.error('Login error:', error);
        // Be vague on login errors for security
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// Protected Route: Get authenticated user's profile
// NEW ROUTE
apiRouter.get('/users/profile', authMiddleware, async (req, res) => {
    try {
        // req.user.id is the MongoDB _id (backend ID) passed by the authMiddleware
        const userProfile = await db.getUserProfileById(req.user.id);
        res.json(userProfile);
    } catch (error) {
        console.error('Get profile error:', error.message);
        res.status(404).json({ message: error.message });
    }
});


// Protected Animal Routes
// POST /api/animals - Add a new animal
apiRouter.post('/animals', authMiddleware, async (req, res) => {
    try {
        const newAnimal = await db.addAnimal(req.user.id, req.body);
        res.status(201).json(newAnimal);
    } catch (error) {
        console.error('Add animal error:', error);
        res.status(400).json({ message: error.message });
    }
});

// GET /api/animals - Get all user's animals (with optional filters)
apiRouter.get('/animals', authMiddleware, async (req, res) => {
    try {
        const animals = await db.getUsersAnimals(req.user.id, req.query);
        res.json(animals);
    } catch (error) {
        console.error('Get animals error:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET /api/animals/:id - Get a specific animal
apiRouter.get('/animals/:id', authMiddleware, async (req, res) => {
    try {
        const animal = await db.getAnimalByIdAndUser(req.user.id, req.params.id);
        res.json(animal);
    } catch (error) {
        console.error('Get animal by ID error:', error);
        res.status(404).json({ message: error.message });
    }
});

// PUT /api/animals/:id - Update a specific animal
apiRouter.put('/animals/:id', authMiddleware, async (req, res) => {
    try {
        const updatedAnimal = await db.updateAnimal(req.user.id, req.params.id, req.body);
        res.json(updatedAnimal);
    } catch (error) {
        console.error('Update animal error:', error);
        res.status(400).json({ message: error.message });
    }
});

// POST /api/animals/:id/toggle-public - Toggle public visibility
apiRouter.post('/animals/:id/toggle-public', authMiddleware, async (req, res) => {
    try {
        const animal = await db.toggleAnimalPublic(req.user.id, req.params.id, req.body);
        res.json(animal);
    } catch (error) {
        console.error('Toggle public error:', error);
        res.status(400).json({ message: error.message });
    }
});

// Protected Litter Routes
// POST /api/litters - Add a new litter
apiRouter.post('/litters', authMiddleware, async (req, res) => {
    try {
        const newLitter = await db.addLitter(req.user.id, req.body);
        res.status(201).json(newLitter);
    } catch (error) {
        console.error('Add litter error:', error);
        res.status(400).json({ message: error.message });
    }
});

// GET /api/litters - Get all user's litters
apiRouter.get('/litters', authMiddleware, async (req, res) => {
    try {
        const litters = await db.getUsersLitters(req.user.id);
        res.json(litters);
    } catch (error) {
        console.error('Get litters error:', error);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/litters/:id - Update a specific litter
apiRouter.put('/litters/:id', authMiddleware, async (req, res) => {
    try {
        const updatedLitter = await db.updateLitter(req.user.id, req.params.id, req.body);
        res.json(updatedLitter);
    } catch (error) {
        console.error('Update litter error:', error);
        res.status(400).json({ message: error.message });
    }
});

// Protected Pedigree Route
// GET /api/pedigree/:animalId - Generate pedigree for an animal
apiRouter.get('/pedigree/:animalId', authMiddleware, async (req, res) => {
    try {
        // Use animalId from URL params (backend ID)
        const pedigreeTree = await db.generatePedigree(req.user.id, req.params.animalId);
        res.json(pedigreeTree);
    } catch (error) {
        console.error('Pedigree generation error:', error);
        res.status(404).json({ message: error.message });
    }
});


// Public Profile/Animal Routes
// GET /api/public/profile/:id_public - Get a breeder's public profile
apiRouter.get('/public/profile/:id_public', async (req, res) => {
    try {
        const profile = await db.getPublicProfile(req.params.id_public);
        res.json(profile);
    } catch (error) {
        console.error('Get public profile error:', error);
        res.status(404).json({ message: error.message });
    }
});

// GET /api/public/animals/:ownerId_public - Get all public animals for a breeder
apiRouter.get('/public/animals/:ownerId_public', async (req, res) => {
    try {
        const animals = await db.getPublicAnimalsByOwner(req.params.ownerId_public);
        res.json(animals);
    } catch (error) {
        console.error('Get public animals error:', error);
        res.status(500).json({ message: error.message });
    }
});


// Apply API router
app.use('/api', apiRouter);

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});