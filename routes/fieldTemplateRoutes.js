const express = require('express');
const router = express.Router();
const { FieldTemplate, Species } = require('../database/models');
const { protect, checkRole } = require('../middleware/authMiddleware');

// Feature flags for safe rollout - PHASE 1-3: Only safe templates enabled
const FEATURE_FLAGS = {
    FIELD_TEMPLATES_UI_ENABLED: {
        'Small Mammal Template': false,  // DISABLED - 950+ animals at risk
        'Full Mammal Template': false,   // DISABLED - 5 animals at risk
        'Reptile Template': false,       // DISABLED - 1 animal at risk
        'Bird Template': true,           // ENABLED - 0 animals, safe to test
        'Fish Template': true,           // ENABLED - 0 animals, safe to test
        'Amphibian Template': true,      // ENABLED - 0 animals, safe to test
        'Invertebrate Template': true,   // ENABLED - 0 animals, safe to test
        'Other Template': false          // DISABLED - used as fallback
    }
};

/**
 * GET /api/field-templates
 * Get all field templates (admin only)
 */
router.get('/', protect, checkRole(['admin']), async (req, res) => {
    try {
        const templates = await FieldTemplate.find().sort({ isDefault: -1, name: 1 });
        res.json(templates);
    } catch (error) {
        console.error('Error fetching field templates:', error);
        res.status(500).json({ error: 'Failed to fetch field templates' });
    }
});

/**
 * GET /api/field-templates/:id
 * Get a single field template by ID
 */
router.get('/:id', protect, async (req, res) => {
    try {
        const template = await FieldTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Field template not found' });
        }
        res.json(template);
    } catch (error) {
        console.error('Error fetching field template:', error);
        res.status(500).json({ error: 'Failed to fetch field template' });
    }
});

/**
 * GET /api/field-templates/species/:speciesId
 * Get the field template for a specific species WITH feature flag support
 * Falls back to category-based template mapping if species has no template assigned
 */
router.get('/species/:speciesId', async (req, res) => {
    try {
        const species = await Species.findOne({ 
            $or: [
                { _id: req.params.speciesId },
                { name: req.params.speciesId }
            ]
        }).populate('fieldTemplateId');
        
        if (!species) {
            return res.status(404).json({ error: 'Species not found' });
        }
        
        let template = species.fieldTemplateId;
        let templateName = null;
        
        // If no template assigned, map by category
        if (!template) {
            // Category to template mapping (use Other as default for any edge cases)
            const categoryTemplateMap = {
                'Small Mammal': 'Small Mammal Template',
                'Mammal': 'Full Mammal Template',
                'Reptile': 'Reptile Template',
                'Bird': 'Bird Template',
                'Fish': 'Fish Template',
                'Amphibian': 'Amphibian Template',
                'Invertebrate': 'Invertebrate Template',
                'Other': 'Other Template'
            };
            
            // Default to 'Other Template' if category is missing or unknown (shouldn't happen, but safety first)
            templateName = categoryTemplateMap[species.category] || 'Other Template';
            
            // Fetch the template by name - GRACEFULLY handle if not seeded yet
            try {
                template = await FieldTemplate.findOne({ name: templateName });
                
                if (!template) {
                    // Final fallback: try to get 'Other Template' directly
                    template = await FieldTemplate.findOne({ name: 'Other Template' });
                }
            } catch (templateError) {
                console.warn('Field templates not yet seeded:', templateError.message);
                // Return gracefully with null template - legacy UI will be used
                return res.json({
                    fields: {},
                    name: 'Legacy Form',
                    uiEnabled: false,
                    fallbackToLegacy: true,
                    mappedByCategory: false,
                    _note: 'Field templates not yet available - using legacy UI'
                });
            }
            
            // If still no template found after both attempts
            if (!template) {
                console.warn(`No template found for category: ${species.category}, expected: ${templateName}`);
                return res.json({
                    fields: {},
                    name: 'Legacy Form',
                    uiEnabled: false,
                    fallbackToLegacy: true,
                    mappedByCategory: false,
                    _note: 'Template not found - using legacy UI'
                });
            }
        } else {
            templateName = template.name;
        }
        
        // Check feature flag
        const uiEnabled = FEATURE_FLAGS.FIELD_TEMPLATES_UI_ENABLED[templateName] || false;
        
        res.json({
            ...template.toObject(),
            uiEnabled,  // Flag indicating if new UI should be used
            fallbackToLegacy: !uiEnabled,  // Flag to use legacy UI
            mappedByCategory: !species.fieldTemplateId  // Indicates if template was mapped by category
        });
    } catch (error) {
        console.error('Error fetching species field template:', error);
        // Graceful degradation - return safe fallback
        res.json({
            fields: {},
            name: 'Legacy Form',
            uiEnabled: false,
            fallbackToLegacy: true,
            mappedByCategory: false,
            _note: 'Error loading template - using legacy UI'
        });
    }
});

/**
 * POST /api/field-templates
 * Create a new field template (admin only)
 */
router.post('/', protect, checkRole(['admin']), async (req, res) => {
    try {
        const { name, description, fields } = req.body;
        
        // Validate required fields
        if (!name || !fields) {
            return res.status(400).json({ error: 'Name and fields are required' });
        }
        
        // Check if template with same name exists
        const existing = await FieldTemplate.findOne({ name });
        if (existing) {
            return res.status(409).json({ error: 'A field template with this name already exists' });
        }
        
        const template = new FieldTemplate({
            name,
            description,
            fields,
            createdBy: req.user._id,
            isDefault: false
        });
        
        await template.save();
        res.status(201).json(template);
    } catch (error) {
        console.error('Error creating field template:', error);
        res.status(500).json({ error: 'Failed to create field template' });
    }
});

/**
 * PUT /api/field-templates/:id
 * Update an existing field template (admin only)
 */
router.put('/:id', protect, checkRole(['admin']), async (req, res) => {
    try {
        const { name, description, fields } = req.body;
        
        const template = await FieldTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Field template not found' });
        }
        
        // Prevent editing default templates (optional - remove if you want admins to edit defaults)
        if (template.isDefault) {
            return res.status(403).json({ error: 'Cannot edit default field templates. Create a copy instead.' });
        }
        
        // Update fields
        if (name) template.name = name;
        if (description !== undefined) template.description = description;
        if (fields) template.fields = fields;
        
        template.version += 1; // Increment version
        template.updatedAt = new Date();
        
        await template.save();
        res.json(template);
    } catch (error) {
        console.error('Error updating field template:', error);
        res.status(500).json({ error: 'Failed to update field template' });
    }
});

/**
 * POST /api/field-templates/:id/clone
 * Clone an existing field template (admin only)
 */
router.post('/:id/clone', protect, checkRole(['admin']), async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'New template name is required' });
        }
        
        const original = await FieldTemplate.findById(req.params.id);
        if (!original) {
            return res.status(404).json({ error: 'Original field template not found' });
        }
        
        // Check if name already exists
        const existing = await FieldTemplate.findOne({ name });
        if (existing) {
            return res.status(409).json({ error: 'A field template with this name already exists' });
        }
        
        const cloned = new FieldTemplate({
            name,
            description: original.description ? `${original.description} (Copy)` : null,
            fields: original.fields,
            createdBy: req.user._id,
            isDefault: false,
            version: 1
        });
        
        await cloned.save();
        res.status(201).json(cloned);
    } catch (error) {
        console.error('Error cloning field template:', error);
        res.status(500).json({ error: 'Failed to clone field template' });
    }
});

/**
 * DELETE /api/field-templates/:id
 * Delete a field template (admin only)
 */
router.delete('/:id', protect, checkRole(['admin']), async (req, res) => {
    try {
        const template = await FieldTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Field template not found' });
        }
        
        // Prevent deleting default templates
        if (template.isDefault) {
            return res.status(403).json({ error: 'Cannot delete default field templates' });
        }
        
        // Check if any species are using this template
        const speciesUsingTemplate = await Species.countDocuments({ fieldTemplateId: req.params.id });
        if (speciesUsingTemplate > 0) {
            return res.status(409).json({ 
                error: `Cannot delete template. ${speciesUsingTemplate} species are currently using it.`,
                speciesCount: speciesUsingTemplate
            });
        }
        
        await FieldTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Field template deleted successfully' });
    } catch (error) {
        console.error('Error deleting field template:', error);
        res.status(500).json({ error: 'Failed to delete field template' });
    }
});

/**
 * PUT /api/field-templates/species/:speciesId/assign
 * Assign a field template to a species (admin only)
 */
router.put('/species/:speciesId/assign', protect, checkRole(['admin']), async (req, res) => {
    try {
        const { templateId } = req.body;
        
        if (!templateId) {
            return res.status(400).json({ error: 'Template ID is required' });
        }
        
        // Verify template exists
        const template = await FieldTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Field template not found' });
        }
        
        // Update species
        const species = await Species.findById(req.params.speciesId);
        if (!species) {
            return res.status(404).json({ error: 'Species not found' });
        }
        
        species.fieldTemplateId = templateId;
        await species.save();
        
        res.json({ 
            message: 'Field template assigned successfully',
            species: species.name,
            template: template.name
        });
    } catch (error) {
        console.error('Error assigning field template:', error);
        res.status(500).json({ error: 'Failed to assign field template' });
    }
});

module.exports = router;
