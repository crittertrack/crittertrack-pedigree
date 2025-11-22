const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../database/db_service');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    const { personalName, email, password, breederName, showBreederName } = req.body;

    if (!personalName || !email || !password) {
        return res.status(400).json({ message: 'Please enter all mandatory fields (Name, Email, Password).' });
    }

    try {
        const result = await registerUser({ personalName, email, password, breederName, showBreederName });

        // Do not return token on registration, only successful confirmation
        res.status(201).json({
            message: 'User registered successfully. Please log in.',
            id_public: result.id_public
        });

    } catch (error) {
        console.error('Error during registration:', error.message);
        if (error.message.includes('already exists')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please enter all fields.' });
    }

    try {
        const result = await loginUser(email, password);

        // Return JWT and the user's public ID
        res.json({ 
            token: result.token,
            id_public: result.id_public 
        });

    } catch (error) {
        console.error('Error during login:', error.message);
        if (error.message.includes('Invalid Credentials')) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

module.exports = router;