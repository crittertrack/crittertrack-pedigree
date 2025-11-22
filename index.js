const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Database Connection Service (Fixed path)
const connectDB = require('./database/db_service'); 
// Auth Middleware (New file imported here, causing the error previously)
const authMiddleware = require('./middleware/auth'); 

const app = express();

// --- Middleware Setup ---
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());

// --- Database Connection ---
connectDB();

// --- Routes (Example: Protecting a route) ---

// Basic unprotected health check
app.get('/', (req, res) => {
    res.status(200).send('CritterTrack Backend API is running!');
});

// Example of a Protected Route (requires a valid JWT token)
app.get('/api/protected-info', authMiddleware, (req, res) => {
    // If we reach here, the token was valid, and req.user contains the user data
    res.json({ message: 'This is secure data.', user: req.user });
});

// TODO: Add your actual authentication and data routes here.

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Something broke!', error: err.message });
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});