const express = require('express');
const router = express.Router();
const { BetaSurvey } = require('../database/models');
const { checkRole, protect } = require('../middleware/authMiddleware');

const requireAuth = protect;
const requireAdmin = checkRole(['admin']);

/**
 * POST /api/surveys/beta-survey
 * Submit a beta survey response
 */
router.post('/beta-survey', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userIdPublic = req.user.id_public;
        const userEmail = req.user.email;
        const userName = req.user.personalName || req.user.breederName || 'Anonymous';

        const {
            q1_overall_satisfaction,
            q2_visual_design,
            q3_primary_use,
            q4_features_used,
            q5_find_animals,
            q6_litter_family_tree,
            q7_genetics_tools,
            q8_animal_profile_clarity,
            q9_litter_tracking,
            q10_ownership_management,
            q11_profile_settings,
            q12_breeder_directory,
            q13_visibility_comfort,
            q14_marketplace_utility,
            q15_improvements
        } = req.body;

        // Validate required fields
        if (
            !q1_overall_satisfaction ||
            !q2_visual_design ||
            !q3_primary_use ||
            !q4_features_used ||
            !q5_find_animals ||
            !q6_litter_family_tree ||
            !q7_genetics_tools ||
            !q8_animal_profile_clarity ||
            !q9_litter_tracking ||
            !q10_ownership_management ||
            !q11_profile_settings ||
            !q12_breeder_directory ||
            !q13_visibility_comfort ||
            !q14_marketplace_utility
        ) {
            return res.status(400).json({ error: 'All required survey questions must be answered' });
        }

        // Validate scale values are 1-5
        const scaleQuestions = [
            q1_overall_satisfaction,
            q2_visual_design,
            q5_find_animals,
            q6_litter_family_tree,
            q7_genetics_tools,
            q8_animal_profile_clarity,
            q9_litter_tracking,
            q10_ownership_management,
            q11_profile_settings,
            q12_breeder_directory,
            q13_visibility_comfort,
            q14_marketplace_utility
        ];

        for (const value of scaleQuestions) {
            if (typeof value !== 'number' || value < 1 || value > 5) {
                return res.status(400).json({ error: 'Scale questions must have values between 1 and 5' });
            }
        }

        // Validate multiple choice arrays
        if (!Array.isArray(q3_primary_use) || q3_primary_use.length === 0) {
            return res.status(400).json({ error: 'Question 3 (primary use) must have at least one selection' });
        }
        if (!Array.isArray(q4_features_used) || q4_features_used.length === 0) {
            return res.status(400).json({ error: 'Question 4 (features used) must have at least one selection' });
        }

        // Create survey response
        const surveyResponse = new BetaSurvey({
            userId,
            userIdPublic,
            userEmail,
            userName,
            q1_overall_satisfaction,
            q2_visual_design,
            q3_primary_use,
            q4_features_used,
            q5_find_animals,
            q6_litter_family_tree,
            q7_genetics_tools,
            q8_animal_profile_clarity,
            q9_litter_tracking,
            q10_ownership_management,
            q11_profile_settings,
            q12_breeder_directory,
            q13_visibility_comfort,
            q14_marketplace_utility,
            q15_improvements: q15_improvements || null
        });

        await surveyResponse.save();

        res.status(201).json({
            message: 'Survey submitted successfully',
            surveyId: surveyResponse._id
        });
    } catch (error) {
        console.error('Error submitting beta survey:', error);
        res.status(500).json({ error: 'Failed to submit survey' });
    }
});

/**
 * GET /api/surveys/beta-survey/stats
 * Get aggregated statistics for beta survey (admin only)
 */
router.get('/beta-survey/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const totalResponses = await BetaSurvey.countDocuments();

        if (totalResponses === 0) {
            return res.json({
                totalResponses: 0,
                stats: {}
            });
        }

        // Get average scores for scale questions
        const scaleStats = await BetaSurvey.aggregate([
            {
                $group: {
                    _id: null,
                    avg_q1: { $avg: '$q1_overall_satisfaction' },
                    avg_q2: { $avg: '$q2_visual_design' },
                    avg_q5: { $avg: '$q5_find_animals' },
                    avg_q6: { $avg: '$q6_litter_family_tree' },
                    avg_q7: { $avg: '$q7_genetics_tools' },
                    avg_q8: { $avg: '$q8_animal_profile_clarity' },
                    avg_q9: { $avg: '$q9_litter_tracking' },
                    avg_q10: { $avg: '$q10_ownership_management' },
                    avg_q11: { $avg: '$q11_profile_settings' },
                    avg_q12: { $avg: '$q12_breeder_directory' },
                    avg_q13: { $avg: '$q13_visibility_comfort' },
                    avg_q14: { $avg: '$q14_marketplace_utility' }
                }
            }
        ]);

        // Get percentage breakdowns for scale questions (1-5 distributions)
        const q1Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q1_overall_satisfaction', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q2Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q2_visual_design', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q5Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q5_find_animals', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q6Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q6_litter_family_tree', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q7Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q7_genetics_tools', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q8Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q8_animal_profile_clarity', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q9Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q9_litter_tracking', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q10Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q10_ownership_management', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q11Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q11_profile_settings', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q12Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q12_breeder_directory', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q13Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q13_visibility_comfort', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const q14Dist = await BetaSurvey.aggregate([
            { $group: { _id: '$q14_marketplace_utility', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Get distribution for multiple choice questions
        const q3Options = await BetaSurvey.aggregate([
            { $unwind: '$q3_primary_use' },
            { $group: { _id: '$q3_primary_use', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const q4Options = await BetaSurvey.aggregate([
            { $unwind: '$q4_features_used' },
            { $group: { _id: '$q4_features_used', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Convert distributions to percentages
        const convertToPercentage = (distribution) => {
            return distribution.map(item => ({
                value: item._id,
                count: item.count,
                percentage: ((item.count / totalResponses) * 100).toFixed(2)
            }));
        };

        const stats = {
            scaleAverages: scaleStats[0] || {},
            q1_distribution: convertToPercentage(q1Dist),
            q2_distribution: convertToPercentage(q2Dist),
            q5_distribution: convertToPercentage(q5Dist),
            q6_distribution: convertToPercentage(q6Dist),
            q7_distribution: convertToPercentage(q7Dist),
            q8_distribution: convertToPercentage(q8Dist),
            q9_distribution: convertToPercentage(q9Dist),
            q10_distribution: convertToPercentage(q10Dist),
            q11_distribution: convertToPercentage(q11Dist),
            q12_distribution: convertToPercentage(q12Dist),
            q13_distribution: convertToPercentage(q13Dist),
            q14_distribution: convertToPercentage(q14Dist),
            q3_choices: q3Options.map(opt => ({
                choice: opt._id,
                count: opt.count,
                percentage: ((opt.count / totalResponses) * 100).toFixed(2)
            })),
            q4_choices: q4Options.map(opt => ({
                choice: opt._id,
                count: opt.count,
                percentage: ((opt.count / totalResponses) * 100).toFixed(2)
            }))
        };

        res.json({
            totalResponses,
            stats
        });
    } catch (error) {
        console.error('Error fetching beta survey stats:', error);
        res.status(500).json({ error: 'Failed to fetch survey statistics' });
    }
});

/**
 * GET /api/surveys/beta-survey/all
 * Get all survey responses with user details (admin only)
 */
router.get('/beta-survey/all', requireAuth, requireAdmin, async (req, res) => {
    try {
        const surveys = await BetaSurvey.find()
            .sort({ createdAt: -1 })
            .lean();

        res.json(surveys);
    } catch (error) {
        console.error('Error fetching beta surveys:', error);
        res.status(500).json({ error: 'Failed to fetch surveys' });
    }
});

/**
 * GET /api/surveys/beta-survey/:id
 * Get a specific survey response (admin only or own response)
 */
router.get('/beta-survey/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await BetaSurvey.findById(id).lean();

        if (!survey) {
            return res.status(404).json({ error: 'Survey not found' });
        }

        // Check if user is admin or survey owner
        if (req.user.role !== 'admin' && survey.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ error: 'You do not have permission to view this survey' });
        }

        res.json(survey);
    } catch (error) {
        console.error('Error fetching beta survey:', error);
        res.status(500).json({ error: 'Failed to fetch survey' });
    }
});

/**
 * DELETE /api/surveys/beta-survey/:id
 * Delete a survey response (admin only)
 */
router.delete('/beta-survey/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await BetaSurvey.findByIdAndDelete(id);

        if (!survey) {
            return res.status(404).json({ error: 'Survey not found' });
        }

        res.json({ message: 'Survey deleted successfully' });
    } catch (error) {
        console.error('Error deleting beta survey:', error);
        res.status(500).json({ error: 'Failed to delete survey' });
    }
});

module.exports = router;
