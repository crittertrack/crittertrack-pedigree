const express = require('express');
const router = express.Router();
// Import authentication functions from the database service
const { registerUser, loginUser } = require('../database/db_service'); 

// --- Authentication Route Controllers (NO AUTH REQUIRED) ---

// POST /api/auth/register
// 1. Registers a new user.
router.post('/register', async (req, res) => {
    try {
        const userData = req.body;
        
        // Basic required field validation
        if (!userData.email || !userData.password || !userData.personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required for registration.' });
        }

        // Call the service function to register and return the token
        const { token, userProfile } = await registerUser(userData);

        res.status(201).json({
            message: 'User registered successfully!',
            token,
            userProfile // Includes id_public and other non-sensitive data
        });
    } catch (error) {
        console.error('Error registering user:', error);
        // 409 Conflict for duplicate email
        if (error.message.includes('E11000')) {
            return res.status(409).json({ message: 'Email already in use.' });
        }
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});


// POST /api/auth/login
// 2. Authenticates a user and returns a JWT token.
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic required field validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required for login.' });
        }
        
        // Call the service function to log in and return the token
        const { token, userProfile } = await loginUser(email, password);

        res.status(200).json({
            message: 'Login successful!',
            token,
            userProfile // Includes id_public and other non-sensitive data
        });
    } catch (error) {
        console.error('Error logging in user:', error.message);
        // 401 Unauthorized for bad credentials
        if (error.message.includes('Invalid credentials') || error.message.includes('User not found')) {
            return res.status(401).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});


module.exports = router;