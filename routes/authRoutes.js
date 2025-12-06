const express = require('express');
const router = express.Router();
// Import authentication functions from the database service
const { 
    registerUser, 
    loginUser, 
    requestEmailVerification,
    verifyEmailAndRegister,
    requestPasswordReset,
    resetPassword
} = require('../database/db_service');
const { 
    sendVerificationEmail, 
    sendPasswordResetEmail 
} = require('../utils/emailService');

// --- Authentication Route Controllers (NO AUTH REQUIRED) ---

// POST /api/auth/register-request
// Step 1: Request email verification code
router.post('/register-request', async (req, res) => {
    try {
        const { email, password, personalName, breederName, showBreederName } = req.body;
        
        // Basic required field validation
        if (!email || !password || !personalName) {
            return res.status(400).json({ message: 'Email, password, and personal name are required.' });
        }

        // Request verification code
        const { verificationCode } = await requestEmailVerification(
            email, 
            personalName, 
            breederName, 
            showBreederName, 
            password
        );

        // Send verification email
        await sendVerificationEmail(email, verificationCode);

        res.status(200).json({
            message: 'Verification code sent to your email. Please check your inbox.',
            email
        });
    } catch (error) {
        console.error('Error requesting email verification:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        if (error.message.includes('already registered')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to send verification email.' });
    }
});

// POST /api/auth/verify-email
// Step 2: Verify code and complete registration
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and verification code are required.' });
        }

        // Verify code and create account
        const { token, userProfile } = await verifyEmailAndRegister(email, code);

        res.status(201).json({
            message: 'Email verified! Account created successfully.',
            token,
            userProfile
        });
    } catch (error) {
        console.error('Error verifying email:', error);
        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to verify email.' });
    }
});

// POST /api/auth/resend-verification
// Resend verification code
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        // Get user to retrieve stored data
        const { User } = require('../database/models');
        const user = await User.findOne({ email, emailVerified: false });

        if (!user) {
            return res.status(404).json({ message: 'No pending verification found for this email.' });
        }

        // Generate new code
        const { verificationCode } = await requestEmailVerification(
            user.email,
            user.personalName,
            user.breederName,
            user.showBreederName,
            user.password // Already hashed, will be rehashed (acceptable for resend)
        );

        // Send new verification email
        await sendVerificationEmail(email, verificationCode);

        res.status(200).json({
            message: 'New verification code sent to your email.'
        });
    } catch (error) {
        console.error('Error resending verification:', error);
        res.status(500).json({ message: 'Failed to resend verification code.' });
    }
});

// POST /api/auth/register
// Legacy registration endpoint (kept for backward compatibility)
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
// Authenticates a user and returns a JWT token.
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic required field validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required for login.' });
        }
        
        // Check if email is verified
        const { User } = require('../database/models');
        const user = await User.findOne({ email });
        
        if (user && !user.emailVerified) {
            return res.status(403).json({ 
                message: 'Email not verified. Please verify your email first.',
                needsVerification: true
            });
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

// POST /api/auth/forgot-password
// Request password reset email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        // Request reset token
        const { resetToken } = await requestPasswordReset(email);

        // Send reset email
        await sendPasswordResetEmail(email, resetToken);

        res.status(200).json({
            message: 'Password reset instructions sent to your email.'
        });
    } catch (error) {
        console.error('Error requesting password reset:', error);
        // Always return success to prevent email enumeration
        res.status(200).json({
            message: 'If the email exists, password reset instructions have been sent.'
        });
    }
});

// POST /api/auth/reset-password
// Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        if (!email || !token || !newPassword) {
            return res.status(400).json({ message: 'Email, token, and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        // Reset password
        await resetPassword(email, token, newPassword);

        res.status(200).json({
            message: 'Password reset successful. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to reset password.' });
    }
});


module.exports = router;