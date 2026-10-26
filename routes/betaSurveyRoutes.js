const express = require('express');
const router = express.Router();
const {
    PublicProfile,
    BetaSurveyResponse,
    BetaSurveyFollowupResponse,
    User,
    Notification,
} = require('../database/models');

const FOLLOWUP_AREAS = [
    'My Animals (main list)', 'Collections', 'Enclosures',
    'Animal Care (Reproduction, Health, Feeding & Care)', 'Litter Management',
    'Budget Tracker', 'Marketplace', 'Community', 'Calendar',
    'Tools (calculators and family trees)', 'Other', 'Nothing was difficult'
];
const FOLLOWUP_DIFFICULTIES = [
    'Finding where to start', 'Understanding a term or label',
    'Understanding how sections connect', 'Entering or editing information',
    'Understanding a result', 'Something else'
];
const FOLLOWUP_SUPPORT = [
    'A short guided checklist', 'Step-by-step examples',
    'Clearer explanations in the app', 'Something else', 'No extra help needed'
];

router.get('/followup/context', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id })
            .select('betaSurveyFollowupStatus betaSurveyFollowupLastPromptedAt id_public');
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        const previousResponse = await BetaSurveyResponse.findOne({ id_public: profile.id_public })
            .sort({ createdAt: -1 })
            .select('q3_mostConfusingFeature q13_bugsIssues q14_magicWandFeature q15_anythingElse createdAt')
            .lean();

        res.json({
            status: profile.betaSurveyFollowupStatus || 'pending',
            lastPromptedAt: profile.betaSurveyFollowupLastPromptedAt || null,
            previousSummary: previousResponse ? {
                confusingFeatures: previousResponse.q3_mostConfusingFeature || [],
                bugsIssues: previousResponse.q13_bugsIssues || null,
                featureSuggestion: previousResponse.q14_magicWandFeature || null,
                additionalComment: previousResponse.q15_anythingElse || null,
            } : null,
        });
    } catch (error) {
        console.error('Error loading beta survey follow-up context:', error);
        res.status(500).json({ message: 'Failed to load follow-up survey' });
    }
});

router.post('/followup/skip', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        if (['dismissed', 'completed'].includes(profile.betaSurveyFollowupStatus)) {
            return res.json({ status: profile.betaSurveyFollowupStatus });
        }
        profile.betaSurveyFollowupStatus = 'skipped';
        profile.betaSurveyFollowupLastPromptedAt = new Date();
        await profile.save();
        res.json({ status: profile.betaSurveyFollowupStatus });
    } catch (error) {
        console.error('Error skipping beta survey follow-up:', error);
        res.status(500).json({ message: 'Failed to skip follow-up survey' });
    }
});

router.post('/followup/dismiss', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        if (profile.betaSurveyFollowupStatus !== 'completed') {
            profile.betaSurveyFollowupStatus = 'dismissed';
            await profile.save();
        }
        res.json({ status: profile.betaSurveyFollowupStatus });
    } catch (error) {
        console.error('Error dismissing beta survey follow-up:', error);
        res.status(500).json({ message: 'Failed to dismiss follow-up survey' });
    }
});

router.post('/followup/submit', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        if (profile.betaSurveyFollowupStatus === 'completed') {
            return res.status(409).json({ message: 'You have already completed this survey.' });
        }

        const { difficultArea, difficultyType, expectedVsActual, helpfulSupport, stillHappening, additionalDetail } = req.body || {};
        if (!FOLLOWUP_AREAS.includes(difficultArea)) {
            return res.status(400).json({ message: 'Choose the area that was hardest to understand.' });
        }
        if (difficultyType != null && !FOLLOWUP_DIFFICULTIES.includes(difficultyType)) {
            return res.status(400).json({ message: 'Choose a valid description of the difficulty.' });
        }
        if (helpfulSupport != null && !FOLLOWUP_SUPPORT.includes(helpfulSupport)) {
            return res.status(400).json({ message: 'Choose a valid type of support.' });
        }
        if (stillHappening != null && !['Yes', 'No', 'Not sure'].includes(stillHappening)) {
            return res.status(400).json({ message: 'Choose whether the issue is still happening.' });
        }
        if ([expectedVsActual, additionalDetail].some(value => value != null &&
            (typeof value !== 'string' || value.length > 2000))) {
            return res.status(400).json({ message: 'Written answers must be 2000 characters or fewer.' });
        }

        await BetaSurveyFollowupResponse.create({
            userId_backend: req.user.id,
            id_public: profile.id_public,
            difficultArea,
            difficultyType: difficultArea === 'Nothing was difficult' ? null : (difficultyType || null),
            expectedVsActual: expectedVsActual?.trim() || null,
            helpfulSupport: helpfulSupport || null,
            stillHappening: stillHappening || null,
            additionalDetail: additionalDetail?.trim() || null,
        });

        profile.betaSurveyFollowupStatus = 'completed';
        await profile.save();

        try {
            const ownerProfile = await PublicProfile.findOne({ id_public: 'CTU2' }).select('userId_backend');
            if (ownerProfile) {
                await Notification.create({
                    userId: ownerProfile.userId_backend,
                    userId_public: 'CTU2',
                    type: 'beta_survey_completed',
                    message: `New beta survey follow-up submitted by ${profile.id_public}.`
                });
            }
        } catch (notifyError) {
            console.error('Failed to create beta survey follow-up notification:', notifyError);
        }

        res.status(201).json({ message: 'Follow-up survey submitted successfully', status: 'completed' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'You have already completed this survey.' });
        }
        console.error('Error submitting beta survey follow-up:', error);
        res.status(500).json({ message: 'Failed to submit follow-up survey' });
    }
});

// The original survey is closed. Its stored responses remain available to admins below,
// but stale clients can no longer change its status or submit additional answers.
router.post(['/skip', '/dismiss', '/submit'], (req, res) => {
    res.status(410).json({ message: 'The previous beta survey is closed. Please use the current follow-up survey.' });
});

// --- Admin ---

router.get('/admin/stats', async (req, res) => {
    try {
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required' });
        }

        // aggregate() bypasses Mongoose schema defaults, so profiles predating this field
        // (no betaSurveyStatus stored in Mongo) must be treated as 'pending' explicitly
        const funnelCounts = await PublicProfile.aggregate([
            { $group: { _id: { $ifNull: ['$betaSurveyStatus', 'pending'] }, count: { $sum: 1 } } }
        ]);
        const funnel = { pending: 0, skipped: 0, dismissed: 0, completed: 0 };
        funnelCounts.forEach(({ _id, count }) => {
            if (_id && funnel.hasOwnProperty(_id)) funnel[_id] = count;
        });

        const totalResponses = await BetaSurveyResponse.countDocuments();
        // "Engaged" users are anyone who has resolved the prompt one way or another, as opposed to still pending
        const totalEngaged = funnel.skipped + funnel.dismissed + funnel.completed;

        const starQuestions = [
            'q1_overallSatisfaction', 'q4_appSpeed', 'q5_easeOfNavigation',
            'q6_visualDesign', 'q11_likelihoodToRecommend', 'q12_likelyToKeepUsing'
        ];
        const avgGroup = {};
        starQuestions.forEach(q => { avgGroup[q] = { $avg: `$${q}` }; });
        const averagesResult = totalResponses > 0
            ? await BetaSurveyResponse.aggregate([{ $group: { _id: null, ...avgGroup } }])
            : [];
        const starAverages = averagesResult[0] || {};
        delete starAverages._id;

        const singleChoiceQuestions = ['q8_primaryDevice', 'q10_howHeard'];
        const multiChoiceQuestions = [
            'q2_mostUsedFeature', 'q3_mostConfusingFeature', 'q7_primarySpecies',
            'q9_priorSolution'
        ];
        const choiceBreakdowns = {};
        for (const q of singleChoiceQuestions) {
            const dist = await BetaSurveyResponse.aggregate([
                { $match: { [q]: { $ne: null } } },
                { $group: { _id: `$${q}`, count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);
            choiceBreakdowns[q] = dist.map(d => ({
                choice: d._id,
                count: d.count,
                percentage: totalResponses > 0 ? Number(((d.count / totalResponses) * 100).toFixed(1)) : 0
            }));
        }
        // Multi-select fields are stored as arrays  unwind so each chosen option is counted once per respondent
        for (const q of multiChoiceQuestions) {
            const dist = await BetaSurveyResponse.aggregate([
                { $match: { [q]: { $ne: null } } },
                { $unwind: `$${q}` },
                { $group: { _id: `$${q}`, count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);
            choiceBreakdowns[q] = dist.map(d => ({
                choice: d._id,
                count: d.count,
                percentage: totalResponses > 0 ? Number(((d.count / totalResponses) * 100).toFixed(1)) : 0
            }));
        }

        const freeTextAnswers = await BetaSurveyResponse.find({
            $or: [
                { q13_bugsIssues: { $ne: null } },
                { q14_magicWandFeature: { $ne: null } },
                { q15_anythingElse: { $ne: null } }
            ]
        })
            .select('id_public q13_bugsIssues q14_magicWandFeature q15_anythingElse createdAt')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            funnel,
            totalResponses,
            totalEngaged,
            starAverages,
            choiceBreakdowns,
            freeTextAnswers
        });
    } catch (error) {
        console.error('Error fetching beta survey stats:', error);
        res.status(500).json({ message: 'Failed to fetch survey stats' });
    }
});

router.get('/admin/users', async (req, res) => {
    try {
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required' });
        }

        const profiles = await PublicProfile.find()
            .select('id_public personalName breederName betaSurveyStatus betaSurveyLastPromptedAt')
            .lean();

        // .lean() also bypasses schema defaults, so normalize missing status the same way
        profiles.forEach(p => { if (!p.betaSurveyStatus) p.betaSurveyStatus = 'pending'; });

        res.json(profiles);
    } catch (error) {
        console.error('Error fetching beta survey users:', error);
        res.status(500).json({ message: 'Failed to fetch survey users' });
    }
});

router.get('/admin/response/:id_public', async (req, res) => {
    try {
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required' });
        }

        const response = await BetaSurveyResponse.findOne({ id_public: req.params.id_public })
            .sort({ createdAt: -1 })
            .lean();

        if (!response) return res.status(404).json({ message: 'No response found for this user' });

        res.json(response);
    } catch (error) {
        console.error('Error fetching beta survey response:', error);
        res.status(500).json({ message: 'Failed to fetch survey response' });
    }
});

router.get('/admin/followup/stats', async (req, res) => {
    try {
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required' });
        }
        const counts = await PublicProfile.aggregate([
            { $group: { _id: { $ifNull: ['$betaSurveyFollowupStatus', 'pending'] }, count: { $sum: 1 } } }
        ]);
        const funnel = { pending: 0, skipped: 0, dismissed: 0, completed: 0 };
        counts.forEach(({ _id, count }) => {
            if (Object.prototype.hasOwnProperty.call(funnel, _id)) funnel[_id] = count;
        });
        const responses = await BetaSurveyFollowupResponse.find()
            .select('id_public difficultArea difficultyType expectedVsActual helpfulSupport stillHappening additionalDetail createdAt')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ funnel, totalResponses: responses.length, responses });
    } catch (error) {
        console.error('Error fetching beta survey follow-up stats:', error);
        res.status(500).json({ message: 'Failed to fetch follow-up survey stats' });
    }
});

router.get('/admin/followup/users', async (req, res) => {
    try {
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required' });
        }
        const profiles = await PublicProfile.find()
            .select('id_public personalName breederName betaSurveyFollowupStatus betaSurveyFollowupLastPromptedAt')
            .lean();
        profiles.forEach(profile => {
            if (!profile.betaSurveyFollowupStatus) profile.betaSurveyFollowupStatus = 'pending';
        });
        res.json(profiles);
    } catch (error) {
        console.error('Error fetching beta survey follow-up users:', error);
        res.status(500).json({ message: 'Failed to fetch follow-up survey users' });
    }
});

router.get('/admin/followup/response/:id_public', async (req, res) => {
    try {
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required' });
        }
        const response = await BetaSurveyFollowupResponse.findOne({ id_public: req.params.id_public })
            .sort({ createdAt: -1 })
            .lean();
        if (!response) return res.status(404).json({ message: 'No follow-up response found for this user' });
        res.json(response);
    } catch (error) {
        console.error('Error fetching beta survey follow-up response:', error);
        res.status(500).json({ message: 'Failed to fetch follow-up survey response' });
    }
});

module.exports = router;
