// This middleware verifies the JWT token present in the request header.

const jwt = require('jsonwebtoken');

// NOTE: Uses environment variable for secret, or a default for development.
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';

/**
 * Middleware function to verify JWT token.
 * It expects the token in the 'Authorization' header as 'Bearer [token]'.
 * If valid, it adds the decoded user payload (user: { id, email }) to req.user and proceeds.
 */
const authMiddleware = (req, res, next) => {
    // 1. Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        // 401: Unauthorized - No token provided
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    
    // Authorization header format: "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    try {
        // 2. Verify token
        // We use the same structure as in routes/auth.js: decoded.user contains { id: user._id, email: user.email }
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. Attach user payload to the request
        req.user = decoded.user;
        
        // 4. Proceed to the next middleware/route handler
        next();
    } catch (error) {
        // 401: Unauthorized - Token is invalid or expired
        console.error("JWT verification failed:", error.message);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = authMiddleware;