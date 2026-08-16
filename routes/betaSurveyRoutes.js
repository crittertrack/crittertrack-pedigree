const express = require('express');
const router = express.Router();
const { PublicProfile, BetaSurveyResponse } = require('../database/models');

// Skip for now — stays re-promptable, throttled to once per calendar day
router.post('/skip', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        if (profile.betaSurveyStatus === 'dismissed' || profile.betaSurveyStatus === 'completed') {
            return res.json({ betaSurveyStatus: profile.betaSurveyStatus, betaSurveyLastPromptedAt: profile.betaSurveyLastPromptedAt });
        }

        profile.betaSurveyStatus = 'skipped';
        profile.betaSurveyLastPromptedAt = new Date();
        await profile.save();

        res.json({ betaSurveyStatus: profile.betaSurveyStatus, betaSurveyLastPromptedAt: profile.betaSurveyLastPromptedAt });
    } catch (error) {
        console.error('Error skipping beta survey:', error);
        res.status(500).json({ message: 'Failed to skip survey' });
    }
});

// Do not show again — permanently dismissed, no answers saved
router.post('/dismiss', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        profile.betaSurveyStatus = 'dismissed';
        await profile.save();

        res.json({ betaSurveyStatus: profile.betaSurveyStatus });
    } catch (error) {
        console.error('Error dismissing beta survey:', error);
        res.status(500).json({ message: 'Failed to dismiss survey' });
    }
});

// Finished — submit answers, mark completed, never shown again
router.post('/submit', async (req, res) => {
    try {
        const profile = await PublicProfile.findOne({ userId_backend: req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        const {
            q1_overallSatisfaction, q2_mostUsedFeature, q3_mostConfusingFeature,
            q4_appSpeed, q5_easeOfNavigation, q6_visualDesign, q7_primarySpecies,
            q8_primaryDevice, q9_priorSolution, q9_priorSolutionOther, q10_howHeard,
            q11_likelihoodToRecommend, q12_likelyToKeepUsing, q13_bugsIssues,
            q14_magicWandFeature, q15_anythingElse
        } = req.body || {};

        const starFields = {
            q1_overallSatisfaction, q4_appSpeed, q5_easeOfNavigation,
            q6_visualDesign, q11_likelihoodToRecommend, q12_likelyToKeepUsing
        };
        for (const [key, value] of Object.entries(starFields)) {
            if (value !== undefined && value !== null && (typeof value !== 'number' || value < 1 || value > 5)) {
                return res.status(400).json({ message: `${key} must be a number between 1 and 5` });
            }
        }

        const response = new BetaSurveyResponse({
            userId_backend: req.user.id,
            id_public: profile.id_public,
            q1_overallSatisfaction, q2_mostUsedFeature, q3_mostConfusingFeature,
            q4_appSpeed, q5_easeOfNavigation, q6_visualDesign, q7_primarySpecies,
            q8_primaryDevice, q9_priorSolution, q9_priorSolutionOther, q10_howHeard,
            q11_likelihoodToRecommend, q12_likelyToKeepUsing, q13_bugsIssues,
            q14_magicWandFeature, q15_anythingElse
        });
        await response.save();

        profile.betaSurveyStatus = 'completed';
        await profile.save();

        res.status(201).json({ message: 'Survey submitted successfully', betaSurveyStatus: 'completed' });
    } catch (error) {
        console.error('Error submitting beta survey:', error);
        res.status(500).json({ message: 'Failed to submit survey' });
    }
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
        // Multi-select fields are stored as arrays — unwind so each chosen option is counted once per respondent
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

module.exports = router;
