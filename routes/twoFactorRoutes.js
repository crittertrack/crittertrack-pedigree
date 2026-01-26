const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { User } = require('../database/models');
const { TwoFactorCode, LoginAuditLog } = require('../database/2faModels');
const { createAuditLog } = require('../utils/auditLogger');

// Initialize Resend email service (same as registration)
const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = 'CritterTrack <noreply@crittertrack.net>';

// Verify email configuration
if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not configured - 2FA emails will fail');
} else {
    console.log('✓ Resend email service ready for 2FA');
    console.log('✓ Using email from:', fromEmail);
}

// Helper: Get client IP address from request
function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        '0.0.0.0'
    );
}

// Helper: Generate 6-digit code
function generateSixDigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Hash code using SHA-256 + random salt
function hashCode(code) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(code + salt).digest('hex');
    return { hash, salt };
}

// Helper: Verify code against hash
function verifyCode(code, storedHash, storedSalt) {
    const hash = crypto.createHash('sha256').update(code + storedSalt).digest('hex');
    return hash === storedHash;
}

// Helper: Parse User-Agent to extract device info
function parseDeviceName(userAgent) {
    if (!userAgent) return 'Unknown Device';
    
    // Extract browser and OS
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Android')) os = 'Android';
    
    return `${browser} on ${os}`;
}

// Helper: Detect suspicious login
async function detectSuspiciousLogin(userId, ipAddress, location) {
    try {
        // Check for login from new IP
        const lastLogin = await LoginAuditLog.findOne({ 
            user_id: userId, 
            status: 'success' 
        }).sort({ created_at: -1 });
        
        if (lastLogin && lastLogin.ip_address !== ipAddress) {
            return {
                isSuspicious: true,
                reason: 'Login from new IP address',
                lastIP: lastLogin.ip_address
            };
        }
        
        // Check for multiple failed attempts from same IP in last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentFailures = await LoginAuditLog.countDocuments({
            ip_address: ipAddress,
            status: 'failed',
            created_at: { $gte: oneHourAgo }
        });
        
        if (recentFailures >= 5) {
            return {
                isSuspicious: true,
                reason: 'Multiple failed login attempts from this IP',
                failureCount: recentFailures
            };
        }
        
        return { isSuspicious: false };
    } catch (error) {
        console.error('Error detecting suspicious login:', error);
        return { isSuspicious: false };
    }
}

// Helper: Send 2FA code via email using Resend (same service as registration)
async function send2FAEmail(email, code, username) {
    try {
        console.log('Sending 2FA verification code to:', email);
        
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is not configured');
        }

        const result = await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: 'CritterTrack Admin Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #ec4899;">CritterTrack Admin Verification</h1>
                    <p>Hello <strong>${username}</strong>,</p>
                    <p>Your admin access verification code is:</p>
                    <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #ec4899; letter-spacing: 5px; margin: 0; font-size: 32px;">${code}</h1>
                        <p style="color: #e74c3c; font-weight: bold; margin-top: 10px;">⏱️ Expires in 5 minutes</p>
                    </div>
                    <p>Enter this code in your admin panel to complete verification.</p>
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0;">
                        <strong>⚠️ Security Notice:</strong> If you did not request this code, please ignore this email and contact support immediately.
                    </div>
                    <p>Do not share this code with anyone.</p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">CritterTrack Security Team<br>This is an automated message. Please do not reply.</p>
                </div>
            `
        });
        
        console.log('✓ 2FA verification code email sent successfully to:', email, 'Result:', result);
        return result;
    } catch (error) {
        console.error('❌ Error sending 2FA email via Resend:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * POST /api/admin/send-2fa-code
 * Generate and send 2FA code to admin/moderator email
 */
router.post('/send-2fa-code', async (req, res) => {
    try {
        const { email, userId } = req.body;
        const authUserId = req.user?.id; // Get from auth middleware

        // Use userId from body if provided, otherwise use auth token user ID
        const targetUserId = userId || authUserId;

        if (!email || !targetUserId) {
            return res.status(400).json({ 
                error: 'Email required and user must be authenticated' 
            });
        }

        // Verify user is admin or moderator
        const user = await User.findById(targetUserId);
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }

        // Check user has role (assuming role field exists)
        const userRole = user.role || 'user';
        if (!['admin', 'moderator'].includes(userRole)) {
            return res.status(403).json({ 
                error: 'Only admins and moderators can access 2FA' 
            });
        }

        // Rate limit: Check for recent code requests (max 1 per minute)
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const recentCode = await TwoFactorCode.findOne({
            user_id: targetUserId,
            created_at: { $gte: oneMinuteAgo }
        });

        if (recentCode) {
            return res.status(429).json({
                error: 'Please wait before requesting a new code',
                retryAfter: 60
            });
        }

        // Generate new code
        const code = generateSixDigitCode();
        const { hash, salt } = hashCode(code);

        // Store code in database (5 minute expiry)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const twoFACode = new TwoFactorCode({
            user_id: targetUserId,
            username: user.personalName || 'Admin',
            email: email,
            code_hash: hash,
            salt: salt, // Store salt for later verification
            expires_at: expiresAt,
            created_ip: getClientIP(req)
        });

        await twoFACode.save();

        // Send code via email
        try {
            await send2FAEmail(email, code, user.personalName || 'Admin');
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
            // Still return success but note that email failed
            return res.status(500).json({
                error: 'Failed to send verification code email',
                details: emailError.message
            });
        }

        res.status(200).json({
            success: true,
            message: `Verification code sent to ${email}`,
            expiresIn: 300,
            codeId: twoFACode._id.toString()
        });

    } catch (error) {
        console.error('Error in send-2fa-code:', error);
        res.status(500).json({
            error: 'Failed to send 2FA code',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/verify-2fa
 * Verify the 6-digit code
 */
router.post('/verify-2fa', async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user?.id; // Get from auth middleware

        if (!code || !userId) {
            return res.status(400).json({
                error: 'Code required and user must be authenticated'
            });
        }

        // Verify code format (6 digits)
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({
                error: 'Invalid code format. Must be 6 digits.'
            });
        }

        // Find the most recent code for this user that hasn't been used
        const twoFARecord = await TwoFactorCode.findOne({
            user_id: userId,
            used: false,
            blocked: false,
            expires_at: { $gt: new Date() }
        }).sort({ created_at: -1 });

        if (!twoFARecord) {
            return res.status(400).json({
                error: 'No valid verification code found. Please request a new one.'
            });
        }

        // Check expiry
        if (new Date() > twoFARecord.expires_at) {
            return res.status(400).json({
                error: 'Verification code has expired'
            });
        }

        // Check attempt limit
        if (twoFARecord.attempts >= 5) {
            twoFARecord.blocked = true;
            await twoFARecord.save();
            return res.status(429).json({
                error: 'Too many failed attempts. Please request a new code.'
            });
        }

        // Verify code
        const isValid = verifyCode(code, twoFARecord.code_hash, twoFARecord.salt);

        if (!isValid) {
            twoFARecord.attempts += 1;
            twoFARecord.last_attempt_at = new Date();
            await twoFARecord.save();

            return res.status(400).json({
                error: 'Invalid verification code',
                attemptsRemaining: 5 - twoFARecord.attempts,
                message: twoFARecord.attempts >= 5 ? 'Too many attempts. Code blocked.' : null
            });
        }

        // Mark code as used
        twoFARecord.used = true;
        twoFARecord.last_attempt_at = new Date();
        await twoFARecord.save();

        // Get user info for audit log
        const user = await User.findById(userId).select('email role');
        const userIP = getClientIP(req);

        // Log admin panel access to audit log
        if (user) {
            await createAuditLog({
                moderatorId: userId,
                moderatorEmail: user.email,
                action: user.role === 'admin' ? 'admin_panel_access' : 'moderator_panel_access',
                targetType: 'system',
                targetId: null,
                targetName: 'Moderation Panel',
                details: {
                    role: user.role,
                    ip: userIP,
                    userAgent: req.headers['user-agent'],
                    method: '2FA'
                },
                reason: null,
                ipAddress: userIP
            });
        }

        // Generate session token (extended expiry for admin session)
        const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';
        const jwt = require('jsonwebtoken');
        const sessionToken = jwt.sign(
            { 
                userId: userId, 
                twoFactorVerified: true,
                type: 'admin_session'
            },
            JWT_SECRET,
            { expiresIn: '4h' } // Extended 4-hour session for admin
        );

        res.status(200).json({
            authenticated: true,
            message: '2FA verification successful',
            sessionToken: sessionToken,
            expiresIn: 14400 // 4 hours in seconds
        });

    } catch (error) {
        console.error('Error in verify-2fa:', error);
        res.status(500).json({
            error: 'Failed to verify 2FA code',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/resend-2fa-code
 * Resend 2FA code (rate limited to after 4:59)
 */
router.post('/resend-2fa-code', async (req, res) => {
    try {
        const { email, userId } = req.body;

        if (!email || !userId) {
            return res.status(400).json({
                error: 'Email and userId required'
            });
        }

        // Find the most recent code for this user
        const lastCode = await TwoFactorCode.findOne({
            user_id: userId
        }).sort({ created_at: -1 });

        if (!lastCode) {
            return res.status(400).json({
                error: 'No code to resend. Please request a new code.'
            });
        }

        // Check if enough time has passed (4 minutes 59 seconds)
        const timeSinceCreation = Date.now() - lastCode.created_at.getTime();
        const fourMinutesInMs = 4 * 60 * 1000 + 59 * 1000;

        if (timeSinceCreation < fourMinutesInMs) {
            const retryAfter = Math.ceil((fourMinutesInMs - timeSinceCreation) / 1000);
            return res.status(429).json({
                error: 'Code resend not available yet',
                message: `Please wait ${retryAfter} more seconds before resending`,
                retryAfter: retryAfter
            });
        }

        // Check resend count (max 3 per session)
        const resendCount = await TwoFactorCode.countDocuments({
            user_id: userId,
            created_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // 30 minute window
        });

        if (resendCount >= 3) {
            return res.status(429).json({
                error: 'Too many resend attempts',
                message: 'Maximum resend attempts exceeded. Please try again later.'
            });
        }

        // Invalidate old code
        lastCode.blocked = true;
        await lastCode.save();

        // Generate new code
        const newCode = generateSixDigitCode();
        const { hash, salt } = hashCode(newCode);

        // Store new code
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const newTwoFACode = new TwoFactorCode({
            user_id: userId,
            username: lastCode.username,
            email: email,
            code_hash: hash,
            salt: salt,
            expires_at: expiresAt,
            created_ip: getClientIP(req)
        });

        await newTwoFACode.save();

        // Send new code via email
        const user = await User.findById(userId);
        await send2FAEmail(email, newCode, user?.personalName || 'Admin');

        res.status(200).json({
            success: true,
            message: `New verification code sent to ${email}`,
            expiresIn: 300
        });

    } catch (error) {
        console.error('Error in resend-2fa-code:', error);
        res.status(500).json({
            error: 'Failed to resend 2FA code',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/track-login
 * Record admin/moderator login attempt with device information
 */
router.post('/track-login', async (req, res) => {
    try {
        const {
            username,
            userAgent,
            deviceInfo = {},
            timestamp
        } = req.body;

        // Get userId from auth middleware (req.user.id is the MongoDB _id)
        const userId = req.user?.id;
        
        if (!userId) {
            console.warn('track-login: Missing authenticated user (req.user.id)');
            return res.status(400).json({
                error: 'User must be authenticated'
            });
        }

        if (!username) {
            console.warn('track-login: Missing username in request body');
            return res.status(400).json({
                error: 'username required'
            });
        }

        // Get IP address from server
        const ipAddress = getClientIP(req);

        // Get user email - handle missing user gracefully
        let email = 'unknown@example.com';
        try {
            const user = await User.findById(userId);
            if (user?.email) {
                email = user.email;
            }
        } catch (userError) {
            console.warn('track-login: Error looking up user email:', userError.message);
        }

        // Parse device name from User-Agent
        const deviceName = userAgent ? parseDeviceName(userAgent) : 'Unknown Device';

        // Extract platform, language, etc. from deviceInfo
        const platform = deviceInfo.platform || null;
        const language = deviceInfo.language || null;
        const screenResolution = deviceInfo.screenResolution || null;
        const timezone = deviceInfo.timezone || null;

        // Detect if suspicious - wrap in try-catch since it's not critical
        let suspiciousCheck = { isSuspicious: false };
        try {
            suspiciousCheck = await detectSuspiciousLogin(userId, ipAddress, null);
        } catch (checkError) {
            console.warn('track-login: Error checking suspicious login:', checkError.message);
        }

        // Map frontend status values to valid enum values
        // Frontend sends: 'password_verified_awaiting_code', 'password_verified_2fa_code_sent', 'success_2fa_verified'
        // Valid enum: 'success', 'failed', 'suspicious'
        let logStatus = 'success';
        if (req.body.status?.includes('failed') || req.body.status?.includes('incorrect')) {
            logStatus = 'failed';
        } else if (suspiciousCheck.isSuspicious) {
            logStatus = 'suspicious';
        }

        // Create login audit log
        const loginLog = new LoginAuditLog({
            user_id: userId,
            username: username,
            email: email,
            ip_address: ipAddress,
            user_agent: userAgent || 'Unknown',
            platform: platform,
            language: language,
            screen_resolution: screenResolution,
            timezone: timezone,
            device_name: deviceName,
            status: logStatus,
            two_factor_verified: !req.body.twoFactorPending,
            failure_reason: null,
            is_suspicious: suspiciousCheck.isSuspicious,
            suspicious_reason: suspiciousCheck.reason || null
        });

        await loginLog.save();

        // Update user's last login info - handle errors gracefully
        if (logStatus === 'success') {
            try {
                await User.findByIdAndUpdate(userId, {
                    last_login: new Date(),
                    last_login_ip: ipAddress
                });
            } catch (updateError) {
                console.warn('track-login: Error updating user last login:', updateError.message);
            }
        }

        res.status(200).json({
            logged: true,
            logId: loginLog._id.toString(),
            message: 'Login attempt recorded',
            isSuspicious: suspiciousCheck.isSuspicious,
            suspiciousReason: suspiciousCheck.reason
        });

    } catch (error) {
        console.error('Error in track-login:', error);
        res.status(500).json({
            error: 'Failed to track login',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/login-history
 * Get current user's login history
 */
router.get('/login-history', async (req, res) => {
    try {
        const userId = req.user?.id || req.body?.userId;
        const { limit = 50, offset = 0, days = 30, status } = req.query;

        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        // Build query
        const query = {
            user_id: userId,
            created_at: {
                $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
        };

        if (status && ['success', 'failed', 'suspicious'].includes(status)) {
            query.status = status;
        }

        // Get total count
        const total = await LoginAuditLog.countDocuments(query);

        // Get paginated results
        const logs = await LoginAuditLog.find(query)
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        res.status(200).json({
            success: true,
            total: total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            data: logs
        });

    } catch (error) {
        console.error('Error in login-history:', error);
        res.status(500).json({
            error: 'Failed to retrieve login history',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/login-history/:userId
 * Get specific user's login history (admin only)
 */
router.get('/login-history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0, days = 30, status } = req.query;

        // Verify requesting user is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                error: 'Admin access required'
            });
        }

        // Build query
        const query = {
            user_id: userId,
            created_at: {
                $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
        };

        if (status && ['success', 'failed', 'suspicious'].includes(status)) {
            query.status = status;
        }

        // Get total count
        const total = await LoginAuditLog.countDocuments(query);

        // Get paginated results
        const logs = await LoginAuditLog.find(query)
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        res.status(200).json({
            success: true,
            total: total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            data: logs
        });

    } catch (error) {
        console.error('Error in login-history/:userId:', error);
        res.status(500).json({
            error: 'Failed to retrieve login history',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/suspicious-logins
 * Get suspicious login attempts across all admins
 */
router.get('/suspicious-logins', async (req, res) => {
    try {
        // Verify requesting user is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                error: 'Admin access required'
            });
        }

        const { limit = 50, offset = 0, days = 7 } = req.query;

        // Query suspicious logins
        const query = {
            is_suspicious: true,
            created_at: {
                $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
        };

        // Get total count
        const total = await LoginAuditLog.countDocuments(query);

        // Get paginated results
        const logs = await LoginAuditLog.find(query)
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        res.status(200).json({
            success: true,
            total: total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            data: logs
        });

    } catch (error) {
        console.error('Error in suspicious-logins:', error);
        res.status(500).json({
            error: 'Failed to retrieve suspicious logins',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/users/:userId/set-role
 * Assign admin/moderator/user role to a user (admin-only)
 * If promoting to moderator/admin, generates and emails a secure password
 */
router.post('/users/:userId/set-role', async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        const requestingUserId = req.user?.id;

        // Verify requesting user is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                error: 'Admin access required to manage roles'
            });
        }

        // Validate role
        if (!['user', 'moderator', 'admin'].includes(role)) {
            return res.status(400).json({
                error: 'Invalid role. Must be: user, moderator, or admin'
            });
        }

        // Prevent self-demotion
        if (requestingUserId === userId && role === 'user') {
            return res.status(400).json({
                error: 'Cannot demote yourself from admin'
            });
        }

        // Fetch user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const previousRole = user.role;

        // Generate secure admin password if promoting to moderator/admin
        let adminPassword = null;
        let generatedPassword = null;
        if (['moderator', 'admin'].includes(role)) {
            // Generate a secure random password: 12 characters with mixed case, numbers, symbols
            generatedPassword = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, '').slice(0, 12);
            
            // Hash the password with bcryptjs
            const bcrypt = require('bcryptjs');
            adminPassword = await bcrypt.hash(generatedPassword, 10);
            user.adminPassword = adminPassword;
        } else {
            // If demoting away from moderator/admin, clear the password
            user.adminPassword = null;
        }

        // Update role
        user.role = role;
        await user.save();

        // If promoted to moderator/admin, send them the password via email
        if (['moderator', 'admin'].includes(role) && generatedPassword) {
            try {
                await resend.emails.send({
                    from: fromEmail,
                    to: user.email,
                    subject: `Your CritterTrack ${role.charAt(0).toUpperCase() + role.slice(1)} Access Credentials`,
                    html: `
                        <h2>Welcome to the CritterTrack Admin Panel</h2>
                        <p>Hi ${user.personalName || 'there'},</p>
                        <p>You have been promoted to <strong>${role}</strong> on CritterTrack.</p>
                        
                        <h3>Your Admin Panel Access</h3>
                        <p>To access the admin panel, use the following credentials:</p>
                        <ul>
                            <li><strong>Email:</strong> ${user.email}</li>
                            <li><strong>Admin Password:</strong> <code style="background: #f0f0f0; padding: 5px;">${generatedPassword}</code></li>
                        </ul>
                        
                        <p><strong>⚠️ Important:</strong></p>
                        <ul>
                            <li>Save this password in a secure location</li>
                            <li>This password is specific to admin panel access (different from your login password)</li>
                            <li>Only admins can regenerate this password if lost</li>
                            <li>Do not share this password with anyone</li>
                        </ul>
                        
                        <h3>How to Access</h3>
                        <ol>
                            <li>Log in to CritterTrack with your normal email and password</li>
                            <li>Click "Admin Panel" button</li>
                            <li>Enter the admin password above</li>
                            <li>Complete the 2FA verification</li>
                            <li>You'll have full admin access</li>
                        </ol>
                        
                        <p>Questions? Contact support@crittertrack.net</p>
                    `
                });
                console.log(`✓ Admin credentials emailed to ${user.email}`);
            } catch (emailError) {
                console.error('Failed to send admin credentials email:', emailError);
                // Don't fail the whole operation, but log it
            }
        }

        // Log role change
        console.log(`✓ Role changed for user ${user.email}: ${previousRole} → ${role}`);

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}${generatedPassword ? ' - admin credentials sent to their email' : ''}`,
            user: {
                id: user._id,
                email: user.email,
                name: user.personalName,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            error: 'Failed to update user role',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/users/with-roles
 * Get all users and their current roles (admin-only)
 */
router.get('/users/with-roles', async (req, res) => {
    try {
        // Verify requesting user is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                error: 'Admin access required'
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const users = await User.find()
            .select('email personalName role creationDate last_login')
            .sort({ creationDate: -1 })
            .limit(limit)
            .skip(offset)
            .lean();

        const total = await User.countDocuments();

        res.status(200).json({
            success: true,
            total: total,
            limit: limit,
            offset: offset,
            data: users
        });

    } catch (error) {
        console.error('Error fetching users with roles:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            details: error.message
        });
    }
});

// ========================================
// ADMIN PASSWORD MANAGEMENT
// ========================================

/**
 * POST /api/admin/setup-admin-password
 * One-time setup endpoint for initial admin password creation
 * Only works if user is admin AND doesn't have a password yet
 * Generates secure password and emails it
 */
router.post('/setup-admin-password', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Fetch user with adminPassword field
        const user = await User.findById(userId).select('+adminPassword');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only admins can use this endpoint
        if (user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Only admins can set up admin password' 
            });
        }

        // Check if password already exists
        if (user.adminPassword) {
            return res.status(400).json({ 
                error: 'Admin password already set. Only admins can regenerate it via the regenerate endpoint.',
                alreadySet: true
            });
        }

        // Generate secure password: 12 characters with mixed case, numbers, symbols
        const generatedPassword = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, '').slice(0, 12);
        
        // Hash it
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        
        // Save it
        user.adminPassword = hashedPassword;
        await user.save();

        // Send email with password
        try {
            await resend.emails.send({
                from: fromEmail,
                to: user.email,
                subject: `Your CritterTrack Admin Password - Initial Setup`,
                html: `
                    <h2>Welcome to CritterTrack Administration</h2>
                    <p>Hi ${user.personalName || 'there'},</p>
                    <p>Your administrator account has been set up successfully.</p>
                    
                    <h3>Your Admin Panel Access</h3>
                    <p>Use this password to access the moderation panel:</p>
                    <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <code style="font-size: 16px; font-weight: bold;">${generatedPassword}</code>
                    </div>
                    
                    <p><strong>⚠️ Important:</strong></p>
                    <ul>
                        <li>Save this password in a secure location</li>
                        <li>This is your admin-only password (different from your login password)</li>
                        <li>Do not share this password with anyone</li>
                        <li>Only you or another admin can regenerate this password if lost</li>
                    </ul>
                    
                    <h3>How to Access</h3>
                    <ol>
                        <li>Log in to CritterTrack with your normal email and password</li>
                        <li>Click "Moderation Panel" button</li>
                        <li>Enter the admin password above</li>
                        <li>Complete the 2FA verification</li>
                        <li>You'll have full admin access</li>
                    </ol>
                    
                    <h3>Admin Responsibilities</h3>
                    <ul>
                        <li>Manage moderator accounts</li>
                        <li>Oversee all moderation activities</li>
                        <li>Configure system settings</li>
                        <li>Review audit logs and data integrity</li>
                        <li>Handle escalated issues</li>
                    </ul>
                    
                    <p>Questions? Contact support@crittertrack.net</p>
                `
            });
            console.log(`✓ Admin password setup email sent to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send setup email:', emailError);
        }

        res.json({
            success: true,
            message: `Admin password generated and sent to ${user.email}`
        });

    } catch (error) {
        console.error('Error setting up admin password:', error);
        res.status(500).json({
            error: 'Failed to set up admin password',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/verify-password
 * Verify the admin password
 * Body: { password: "string" }
 */
router.post('/verify-password', async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        // Fetch user with adminPassword field
        const user = await User.findById(userId).select('+adminPassword');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is admin or moderator
        if (!['admin', 'moderator'].includes(user.role)) {
            return res.status(403).json({ 
                error: 'Only admins and moderators can access this' 
            });
        }

        // Check if admin password is set
        if (!user.adminPassword) {
            return res.status(403).json({ 
                error: 'Admin password not set. Please contact an admin.',
                needsSetup: true
            });
        }

        // Verify password
        const bcrypt = require('bcryptjs');
        const passwordMatch = await bcrypt.compare(password, user.adminPassword);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Incorrect admin password' });
        }

        // Password is correct - return success
        res.json({ 
            success: true,
            message: 'Admin password verified' 
        });

    } catch (error) {
        console.error('Error verifying admin password:', error);
        res.status(500).json({
            error: 'Failed to verify password',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/regenerate-admin-password/:userId
 * Regenerate admin password for a user (admin-only)
 * Generates new password and emails it to the user
 */
router.post('/regenerate-admin-password/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUserId = req.user?.id;

        // Verify requesting user is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                error: 'Admin access required'
            });
        }

        // Fetch user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Can only regenerate for admins/moderators
        if (!['admin', 'moderator'].includes(user.role)) {
            return res.status(400).json({
                error: 'Can only regenerate passwords for admins and moderators'
            });
        }

        // Generate new secure password
        const generatedPassword = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, '').slice(0, 12);
        
        // Hash it
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        
        // Save it
        user.adminPassword = hashedPassword;
        await user.save();

        // Send email with new password
        try {
            await resend.emails.send({
                from: fromEmail,
                to: user.email,
                subject: `Your CritterTrack Admin Panel Password Has Been Regenerated`,
                html: `
                    <h2>Admin Panel Password Regenerated</h2>
                    <p>Hi ${user.personalName || 'there'},</p>
                    <p>Your admin panel password has been regenerated by an administrator.</p>
                    
                    <h3>Your New Admin Panel Password</h3>
                    <p>Use this password to access the admin panel:</p>
                    <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <code style="font-size: 16px; font-weight: bold;">${generatedPassword}</code>
                    </div>
                    
                    <p><strong>⚠️ Important:</strong></p>
                    <ul>
                        <li>Save this password in a secure location</li>
                        <li>Do not share this password with anyone</li>
                        <li>This replaces your previous admin panel password</li>
                    </ul>
                    
                    <h3>How to Access</h3>
                    <ol>
                        <li>Log in to CritterTrack with your normal email and password</li>
                        <li>Click "Admin Panel" button</li>
                        <li>Enter the new admin password above</li>
                        <li>Complete the 2FA verification</li>
                    </ol>
                    
                    <p>Questions? Contact support@crittertrack.net</p>
                `
            });
            console.log(`✓ New admin credentials emailed to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send password regeneration email:', emailError);
        }

        res.json({
            success: true,
            message: `Admin password regenerated and sent to ${user.email}`
        });

    } catch (error) {
        console.error('Error regenerating admin password:', error);
        res.status(500).json({
            error: 'Failed to regenerate password',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/dashboard-stats
 * Get dashboard statistics for the admin panel
 * Protected by authMiddleware
 */
router.get('/dashboard-stats', async (req, res) => {
    try {
        const { User, Animal } = require('../database/models');
        
        // Get total users
        const totalUsers = await User.countDocuments({});
        
        // Get active users (logged in within last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeUsers = await User.countDocuments({
            last_login: { $gte: thirtyDaysAgo }
        });
        
        // Get total animals
        const totalAnimals = await Animal.countDocuments({});
        
        // Get pending reports (placeholder - adjust based on your report model)
        const pendingReports = 0; // Update if you have a Reports model
        
        res.json({
            totalUsers,
            activeUsers,
            totalAnimals,
            pendingReports,
            systemHealth: 'good',
            lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Mock last backup
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            error: 'Failed to fetch dashboard stats',
            details: error.message
        });
    }
});

module.exports = router;
