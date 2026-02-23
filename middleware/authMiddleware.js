const jwt = require('jsonwebtoken');
const { User } = require('../database/models');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, missing or invalid token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded._id || decoded.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Not authorized, invalid token payload.' });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found.' });
        }

        // Check if user account is suspended or banned
        if (user.accountStatus === 'suspended' || user.accountStatus === 'banned') {
            return res.status(403).json({ 
                message: user.accountStatus === 'suspended' 
                    ? 'Account suspended. Please log in again for updated status.' 
                    : 'Account banned.',
                accountStatus: user.accountStatus,
                forceLogout: true
            });
        }

        req.user = user;

        // Update lastActive throttled — fire and forget, update at most once every 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (!user.lastActive || user.lastActive < fiveMinutesAgo) {
            User.updateOne({ _id: user._id }, { lastActive: new Date() }).catch(() => {});
        }

        return next();
    } catch (error) {
        console.error('JWT verification failed:', error.message || error);
        return res.status(401).json({ message: 'Not authorized, token verification failed.' });
    }
};

const checkRole = (roles = []) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized. User context missing.' });
    }

    const role = req.user.role || 'user';
    if (!roles.includes(role)) {
        return res.status(403).json({ message: `Forbidden. User role '${role}' is not authorized for this resource.` });
    }

    next();
};

module.exports = { protect, checkRole };
