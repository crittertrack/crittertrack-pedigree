const express = require('express');
const router = express.Router();
const { User } = require('../database/models');
const { protect } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/emailService');

const OWNER_NOTIFICATION_EMAIL = 'crittertrackowner@gmail.com';

// POST /api/android-beta/opt-in
// Records the Google account email a signed-in user wants added to the Play Store closed
// testing tester list for the crittertrack-frontend Android app (com.crittertrack.app). There's
// no Google Play Developer API integration here — the developer adds submitted emails to the
// Play Console's tester list by hand, which is why the frontend banner warns it can take up to
// 24 hours to take effect.
router.post('/opt-in', protect, async (req, res) => {
    try {
        const { googleEmail } = req.body;

        if (!googleEmail || typeof googleEmail !== 'string') {
            return res.status(400).json({ message: 'Google account email is required.' });
        }

        const trimmedEmail = googleEmail.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return res.status(400).json({ message: 'Invalid email format.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                androidBetaOptIn: {
                    googleEmail: trimmedEmail,
                    submittedAt: new Date(),
                },
            },
            { new: true }
        ).select('androidBetaOptIn id_public');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log(`[Android Beta] Opt-in submitted by ${updatedUser.id_public}: ${trimmedEmail}`);

        // Notify the developer so the email can be manually added to the Play Console's closed
        // testing tester list — fire-and-forget, a failed notification shouldn't block the
        // opt-in submission itself (the email is already saved on the user's account either way).
        sendEmail(
            OWNER_NOTIFICATION_EMAIL,
            '[CritterTrack] New Android beta opt-in',
            `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ec4899;">New Android Beta Opt-In</h2>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Google account email to add as a tester:</strong> ${trimmedEmail}</p>
                        <p><strong>CritterTrack user:</strong> ${req.user.id_public || updatedUser.id_public}</p>
                        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <p>Add this email to the Play Console's closed testing tester list for com.crittertrack.app.</p>
                </div>
            `
        ).catch((err) => console.error('[Android Beta] Failed to send owner notification email:', err.message));

        res.status(200).json({
            message: 'Thanks! Your Google account email has been submitted for the Android beta.',
            androidBetaOptIn: updatedUser.androidBetaOptIn,
        });
    } catch (error) {
        console.error('Error submitting Android beta opt-in:', error.message);
        res.status(500).json({ message: 'Failed to submit opt-in. Please try again later.' });
    }
});

// GET /api/android-beta/opt-ins — admin-only list of submitted emails, so the developer can
// copy them into the Play Console's closed testing tester list.
router.get('/opt-ins', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only.' });
        }

        const users = await User.find({ 'androidBetaOptIn.googleEmail': { $ne: null } })
            .select('id_public personalName breederName email androidBetaOptIn')
            .sort({ 'androidBetaOptIn.submittedAt': -1 })
            .lean();

        res.json(users.map(u => ({
            id_public: u.id_public,
            personalName: u.personalName,
            breederName: u.breederName,
            accountEmail: u.email,
            googleEmail: u.androidBetaOptIn?.googleEmail || null,
            submittedAt: u.androidBetaOptIn?.submittedAt || null,
        })));
    } catch (error) {
        console.error('Error fetching Android beta opt-ins:', error.message);
        res.status(500).json({ message: 'Failed to load opt-ins.' });
    }
});

module.exports = router;
