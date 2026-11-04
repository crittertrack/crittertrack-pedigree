const express = require('express');
const router = express.Router();
const { CareChecklistTemplate, Animal, User, Species } = require('../database/models');
const { mergeTemplateTasks, sanitizeTemplateTasks } = require('../utils/careTemplates');
const { planDefaultTemplates } = require('../utils/defaultCareTemplates');

// Mounted at /api/care-templates behind authMiddleware in index.js. Templates are admin-curated;
// owners only read them and APPLY them (a copy into their animals' care tasks).

const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('role').lean();
        if (!user || !['admin', 'moderator'].includes(user.role)) {
            return res.status(403).json({ message: 'Admin or moderator access required.' });
        }
        next();
    } catch (err) {
        console.error('[care-templates] admin check failed:', err);
        res.status(500).json({ message: 'Authorization check failed.' });
    }
};

const toClient = (t) => ({
    species: t.species,
    tasks: (t.tasks || []).map((x) => ({ taskName: x.taskName, frequencyDays: x.frequencyDays ?? null, notes: x.notes ?? null })),
    updatedAt: t.updatedAt,
});

// GET /api/care-templates/admin/all (admin) every template
router.get('/admin/all', requireAdmin, async (req, res) => {
    try {
        const templates = await CareChecklistTemplate.find({}).sort({ species: 1 }).lean();
        res.json({ templates: templates.map(toClient) });
    } catch (err) {
        console.error('[care-templates] list failed:', err);
        res.status(500).json({ message: 'Failed to load templates.' });
    }
});

// POST /api/care-templates/admin/seed-defaults (admin)
// Creates the built-in default checklist for every species that has one and does NOT already have a
// template. Existing templates are never touched, so admin edits are safe and this can be re-run
// whenever new species are added. Species with no sensible default are reported, not guessed.
router.post('/admin/seed-defaults', requireAdmin, async (req, res) => {
    try {
        const [speciesDocs, existing] = await Promise.all([
            Species.find({}).select('name').lean(),
            CareChecklistTemplate.find({}).select('species').lean(),
        ]);
        const { create, noDefault } = planDefaultTemplates(
            speciesDocs.map((s) => s.name),
            existing.map((t) => t.species)
        );
        if (create.length) {
            await CareChecklistTemplate.bulkWrite(create.map(({ species, tasks }) => ({
                updateOne: {
                    filter: { species },
                    update: { $setOnInsert: { species, tasks, updatedBy: req.user.id } },
                    upsert: true,
                },
            })));
        }
        res.json({
            created: create.map((c) => c.species),
            skippedExisting: existing.length,
            noDefault,
        });
    } catch (err) {
        console.error('[care-templates] seed failed:', err);
        res.status(500).json({ message: 'Failed to add default templates.' });
    }
});

// PUT /api/care-templates/admin/:species (admin) create or replace a species' template
router.put('/admin/:species', requireAdmin, async (req, res) => {
    try {
        const species = String(req.params.species || '').trim();
        if (!species) return res.status(400).json({ message: 'Species is required.' });
        const { tasks, error } = sanitizeTemplateTasks(req.body?.tasks);
        if (error) return res.status(400).json({ message: error });
        const template = await CareChecklistTemplate.findOneAndUpdate(
            { species },
            { $set: { tasks, updatedBy: req.user.id } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();
        res.json(toClient(template));
    } catch (err) {
        console.error('[care-templates] save failed:', err);
        res.status(500).json({ message: 'Failed to save template.' });
    }
});

// DELETE /api/care-templates/admin/:species (admin)
router.delete('/admin/:species', requireAdmin, async (req, res) => {
    try {
        const result = await CareChecklistTemplate.deleteOne({ species: String(req.params.species || '').trim() });
        if (!result.deletedCount) return res.status(404).json({ message: 'Template not found.' });
        res.json({ message: 'Template deleted.' });
    } catch (err) {
        console.error('[care-templates] delete failed:', err);
        res.status(500).json({ message: 'Failed to delete template.' });
    }
});

// GET /api/care-templates/species/:species the template for one species (empty tasks if none)
router.get('/species/:species', async (req, res) => {
    try {
        const species = String(req.params.species || '').trim();
        const template = await CareChecklistTemplate.findOne({ species }).lean();
        res.json(template ? toClient(template) : { species, tasks: [], updatedAt: null });
    } catch (err) {
        console.error('[care-templates] read failed:', err);
        res.status(500).json({ message: 'Failed to load template.' });
    }
});

// POST /api/care-templates/apply { animalIds: [id_public, ...] }
// Copies each animal's species template into its animalCareTasks, skipping tasks it already has
// (matched by name, case-insensitive). Never touches animals the caller doesn't own.
router.post('/apply', async (req, res) => {
    try {
        const animalIds = Array.isArray(req.body?.animalIds) ? [...new Set(req.body.animalIds.map(String))].slice(0, 500) : [];
        if (!animalIds.length) return res.status(400).json({ message: 'animalIds is required.' });
        const animals = await Animal.find({ creatorId: req.user.id, id_public: { $in: animalIds } })
            .select('id_public species animalCareTasks').lean();
        const templates = await CareChecklistTemplate.find({ species: { $in: [...new Set(animals.map((a) => a.species))] } }).lean();
        const bySpecies = new Map(templates.map((t) => [t.species, t]));

        const results = [];
        for (const animal of animals) {
            const template = bySpecies.get(animal.species);
            if (!template || !template.tasks?.length) {
                results.push({ id_public: animal.id_public, added: 0, skipped: 0, reason: 'no_template' });
                continue;
            }
            const { toAdd, skipped } = mergeTemplateTasks(animal.animalCareTasks, template.tasks);
            if (toAdd.length) {
                await Animal.updateOne({ _id: animal._id, creatorId: req.user.id }, { $push: { animalCareTasks: { $each: toAdd } } });
            }
            results.push({ id_public: animal.id_public, added: toAdd.length, skipped });
        }
        const foundIds = new Set(animals.map((a) => a.id_public));
        animalIds.filter((id) => !foundIds.has(id)).forEach((id) => results.push({ id_public: id, added: 0, skipped: 0, reason: 'not_found' }));
        res.json({ results, totalAdded: results.reduce((n, r) => n + r.added, 0) });
    } catch (err) {
        console.error('[care-templates] apply failed:', err);
        res.status(500).json({ message: 'Failed to apply template.' });
    }
});

module.exports = router;
