'use strict';
/** care checklist templates: same planner as POST /api/care-templates/admin/seed-defaults (never overwrites existing). */
module.exports = async (L, ctx) => {
    const { Species, CareChecklistTemplate } = L.models;
    const species = (await Species.collection.find({}, { projection: { name: 1 } }).toArray()).map(s => s.name);
    // In a dry run species have not been written yet, so also plan from the names animals use.
    const defaults = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data-species-defaults.json'), 'utf8')).map(s => s.name);
    const names = [...new Set([...species, ...defaults, ...ctx.animals.map(a => String(a.species || '').trim()).filter(Boolean)])];
    const existing = (await CareChecklistTemplate.collection.find({}, { projection: { species: 1 } }).toArray()).map(t => t.species);
    const { create, noDefault } = L.planDefaultTemplates(names, existing);
    L.log(`  templates to create: ${create.length}; species with no sensible default (left for an admin): ${noDefault.length}`);
    L.log('  no default: ' + noDefault.join(', '));
    const docs = create.map(c => ({ species: c.species, tasks: c.tasks, updatedBy: null, createdAt: new Date(), updatedAt: new Date(), __v: 0 }));
    await L.insertMissing(CareChecklistTemplate, docs, (d) => ({ species: d.species }), 'carechecklisttemplates');
};
