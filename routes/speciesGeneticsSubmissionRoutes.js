const express = require('express');
const router = express.Router();
const { SpeciesGeneticsSubmission } = require('../database/models');

/**
 * POST /species-genetics-feedback
 * Community submission of genetics info for a species without a built-in gene builder.
 * Requires authentication.
 */
router.post('/', async (req, res) => {
    try {
        const { species, genes, alleles, phenotypeInfo, references, contactEmail } = req.body;
        const userId = req.user?._id || req.user?.id;

        if (!species || !genes || !alleles) {
            return res.status(400).json({
                message: 'Missing required fields: species, genes, and alleles are required'
            });
        }

        const submission = await SpeciesGeneticsSubmission.create({
            userId: userId || null,
            species,
            genes,
            alleles,
            phenotypeInfo: phenotypeInfo || null,
            references: references || null,
            contactEmail: contactEmail || null,
            status: 'pending'
        });

        return res.status(201).json({
            message: 'Feedback submitted successfully',
            submissionId: submission.id
        });
    } catch (error) {
        console.error('Error submitting species genetics info:', error);
        return res.status(500).json({
            message: 'Failed to submit feedback',
            error: error.message
        });
    }
});

module.exports = router;
