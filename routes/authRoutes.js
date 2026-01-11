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
const { ProfanityError } = require('../utils/profanityFilter');
const { createAuditLog } = require('../utils/auditLogger');
const { logUserActivity, USER_ACTIONS } = require('../utils/userActivityLogger');
const { protect } = require('../middleware/authMiddleware');
const { User } = require('../database/models');

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
        try {
            await sendVerificationEmail(email, verificationCode);
            console.log('✓ Verification email sent successfully to:', email);
        } catch (emailError) {
            console.error('✗ FAILED to send verification email:', emailError);
            console.error('Email error details:', emailError.message);
            // Still return success to user since code is stored in DB
            // but log the error for debugging
        }

        res.status(200).json({
            message: 'Verification code sent to your email. Please check your inbox.',
            email
        });
    } catch (error) {
        console.error('Error requesting email verification:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }
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

        console.log('Verification attempt - Email:', email, 'Code:', code, 'Code length:', code.length, 'Code type:', typeof code);

        // Add IP address for IP ban checking
        const userIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

        // Verify code and create account
        const { token, userProfile } = await verifyEmailAndRegister(email, code, userIP);

        res.status(201).json({
            message: 'Email verified! Account created successfully.',
            token,
            userProfile
        });
    } catch (error) {
        console.error('Error verifying email:', error.message);
        console.error('Full error:', error);
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }
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
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }
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

        // Add IP address to user data for IP ban checking
        userData.ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

        // Call the service function to register and return the token
        const { token, userProfile } = await registerUser(userData);

        res.status(201).json({
            message: 'User registered successfully!',
            token,
            userProfile // Includes id_public and other non-sensitive data
        });
    } catch (error) {
        console.error('Error registering user:', error);
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }
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

        // Call the service function to log in and return the token
        const { token, userProfile } = await loginUser(email, password, req);

        // Log admin/moderator logins
        console.log(`[AUTH] Login successful for ${userProfile.email}, role: ${userProfile.role}`);

        // Log user activity
        logUserActivity({
            userId: userProfile._id || userProfile.id,
            id_public: userProfile.id_public,
            action: USER_ACTIONS.LOGIN,
            details: { role: userProfile.role },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

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
        // 403 Forbidden for suspended or banned accounts
        if (error.message.includes('Account suspended') || error.message.includes('Account banned')) {
            // Extract expiry timestamp if present for accurate client-side timer
            const timestampMatch = error.message.match(/ExpiryTimestamp:\s*(\d+)/);
            const expiryTimestamp = timestampMatch ? parseInt(timestampMatch[1]) : null;
            
            return res.status(403).json({ 
                message: error.message,
                expiryTimestamp: expiryTimestamp
            });
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

// --- MODERATION MODE AUTHENTICATION ---

// POST /api/auth/verify-moderation-password
// Verify moderation password (separate from login password)
// REQUIRES: JWT token in Authorization header
router.post('/verify-moderation-password', (req, res, next) => {
    // Inline auth middleware for this route
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // JWT payload structure: { user: { id: ... } }
        const userId = decoded?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        
        try {
            const { password } = req.body;
            
            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            // Get user from database to verify moderation password and role
            const { User } = require('../database/models');
            const user = await User.findById(userId).select('+adminPassword');

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            // Only mods and admins can enter moderation mode
            if (!['admin', 'moderator'].includes(user.role)) {
                return res.status(403).json({ error: 'You do not have moderation permissions' });
            }

            // Check if user has an admin password set
            if (!user.adminPassword) {
                return res.status(401).json({ error: 'Moderation password not configured for this user' });
            }

            // Compare password with admin password using bcrypt
            const bcrypt = require('bcryptjs');
            const isPasswordValid = await bcrypt.compare(password, user.adminPassword);

            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            // Log moderator panel access to audit log
            console.log(`[AUTH] Moderator panel access for ${user.email}`);
            const userIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            try {
                await createAuditLog({
                    moderatorId: user._id,
                    moderatorEmail: user.email,
                    action: user.role === 'admin' ? 'admin_panel_access' : 'moderator_panel_access',
                    targetType: 'system',
                    targetId: null,
                    targetName: null,
                    details: { 
                        role: user.role,
                        ip: userIP,
                        userAgent: req.headers['user-agent']
                    },
                    reason: null,
                    ipAddress: userIP
                });
                console.log(`[AUTH] Audit log created for panel access: ${user.email}`);
            } catch (auditError) {
                console.error(`[AUTH] Failed to create audit log for panel access:`, auditError);
            }

            // Check if user has 2FA enabled
            const requiresTwoFactor = user.two_factor_enabled || false;

            res.status(200).json({
                success: true,
                requiresTwoFactor,
                message: 'Password verified successfully'
            });
        } catch (error) {
            console.error('Error verifying moderation password:', error);
            res.status(500).json({ error: 'Failed to verify password' });
        }
    });
});

// POST /api/auth/request-moderation-2fa-code
// Request a 2FA code be sent to user's email
router.post('/request-moderation-2fa-code', async (req, res, next) => {
    // Inline auth middleware for this route
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        const userId = decoded?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        // Get user from database
        const { User } = require('../database/models');
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // If user doesn't have 2FA enabled, return error
        if (!user.two_factor_enabled) {
            return res.status(400).json({ error: '2FA not enabled for this account' });
        }

        // Generate a 6-digit random code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const crypto = require('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const codeHash = crypto.createHash('sha256').update(code + salt).digest('hex');

        // Save to TwoFactorCode collection
        const { TwoFactorCode } = require('../database/2faModels');
        const twoFACode = new TwoFactorCode({
            user_id: userId,
            username: user.personalName,
            email: user.email,
            code_hash: codeHash,
            salt: salt,
            expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minute expiry
            created_ip: req.ip || 'unknown'
        });
        await twoFACode.save();

        // Send code via email
        const { sendEmail } = require('../utils/emailService');
        const emailBody = `
Your CritterTrack Moderation Mode Authentication Code is:

${code}

This code will expire in 10 minutes. Do not share this code with anyone.

If you did not request this code, please ignore this email.
        `.trim();

        try {
            await sendEmail(user.email, 'CritterTrack Moderation 2FA Code', emailBody);
            console.log(`✓ 2FA code sent to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send 2FA email:', emailError);
            // Still return success - code is saved in DB even if email fails
        }

        res.status(200).json({
            success: true,
            message: '2FA code sent to your email'
        });
    } catch (error) {
        console.error('Error requesting 2FA code:', error);
        res.status(500).json({ error: error.message || 'Failed to send 2FA code' });
    }
});

// POST /api/auth/verify-moderation-2fa
// Verify 2FA code for moderation mode
// REQUIRES: JWT token in Authorization header
router.post('/verify-moderation-2fa', async (req, res, next) => {
    // Inline auth middleware for this route
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        // JWT payload structure: { user: { id: ... } }
        const userId = decoded?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: '2FA code is required' });
        }

        // Get user from database
        const { User } = require('../database/models');
        const user = await User.findById(userId);

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            // If user doesn't have 2FA enabled, return error
            if (!user.two_factor_enabled) {
                return res.status(400).json({ error: '2FA not enabled for this account' });
            }

            // Verify the code from TwoFactorCode collection
            const { TwoFactorCode } = require('../database/2faModels');
            const crypto = require('crypto');

            // Find a valid, unused 2FA code for this user
            const twoFACode = await TwoFactorCode.findOne({
                user_id: userId,
                used: false,
                blocked: false,
                expires_at: { $gt: new Date() }
            }).sort({ created_at: -1 });

            if (!twoFACode) {
                return res.status(401).json({ error: 'No valid 2FA code found. Please request a new code.' });
            }

            // Verify the code against the hash
            const codeHash = crypto.createHash('sha256').update(code + twoFACode.salt).digest('hex');
            
            if (codeHash !== twoFACode.code_hash) {
                // Increment attempts
                twoFACode.attempts += 1;
                twoFACode.last_attempt_at = new Date();
                
                // Block after 5 failed attempts
                if (twoFACode.attempts >= 5) {
                    twoFACode.blocked = true;
                }
                
                await twoFACode.save();
                return res.status(401).json({ error: 'Invalid 2FA code' });
            }

            // Mark code as used
            twoFACode.used = true;
            await twoFACode.save();

            res.status(200).json({
                success: true,
                message: '2FA verified successfully - moderation mode activated'
            });
    } catch (error) {
        console.error('Error verifying 2FA code:', error);
        res.status(500).json({ error: 'Failed to verify 2FA code' });
    }
});

// GET /api/auth/status
// Protected endpoint: Check user's current account status
// Used to detect if user has been suspended or banned while session is active
router.get('/status', protect, async (req, res) => {
    try {
        // User is already attached to req.user by protect middleware
        // Re-fetch to ensure we have the latest status
        const user = await User.findById(req.user._id).select('accountStatus email suspensionReason banReason id_public suspensionLiftedDate');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if suspension was lifted within the last 24 hours
        let suspensionLifted = false;
        if (user.suspensionLiftedDate) {
            const now = new Date();
            const timeSinceLift = now.getTime() - user.suspensionLiftedDate.getTime();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            suspensionLifted = timeSinceLift < TWENTY_FOUR_HOURS;
        }

        res.status(200).json({
            accountStatus: user.accountStatus || 'normal',
            email: user.email,
            id_public: user.id_public,
            suspensionReason: user.suspensionReason,
            banReason: user.banReason,
            suspensionLifted: suspensionLifted
        });
    } catch (error) {
        console.error('Error checking user status:', error);
        res.status(500).json({ message: 'Failed to check user status.' });
    }
});

module.exports = router;