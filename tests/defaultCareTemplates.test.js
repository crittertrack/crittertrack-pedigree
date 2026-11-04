const test = require('node:test');
const assert = require('node:assert/strict');
const { TEMPLATES, SPECIES_RULES, defaultTemplateFor, planDefaultTemplates } = require('../utils/defaultCareTemplates');
const { sanitizeTemplateTasks } = require('../utils/careTemplates');

test('every built-in template passes the same validation admins are held to', () => {
    for (const [key, tasks] of Object.entries(TEMPLATES)) {
        const result = sanitizeTemplateTasks(tasks);
        assert.equal(result.error, undefined, `${key}: ${result.error}`);
        assert.ok(tasks.length >= 5, `${key} should have a useful number of tasks`);
    }
});

test('every species rule points at a real template', () => {
    for (const rule of SPECIES_RULES) assert.ok(TEMPLATES[rule.key], `missing template ${rule.key}`);
});

test('common species names map to the right template', () => {
    const cases = {
        'Fancy Mouse': 'MOUSE', 'Fancy Rat': 'RAT', 'Natal Rats': 'RAT', 'Syrian Hamster': 'HAMSTER',
        'Fat-tailed Gerbil': 'GERBIL', 'Guinea Pig': 'GUINEA_PIG', 'Rabbit (Domesticated)': 'RABBIT',
        'Budgie': 'BIRD', 'Leopard Gecko': 'ARID_GECKO', 'Giant Day Gecko': 'DAY_GECKO',
        'Ball Python': 'SNAKE', 'Corn Snake': 'SNAKE', 'Bearded Dragon': 'BEARDED_DRAGON',
        'Green iguana': 'IGUANA', 'Curlyhair Tarantula': 'TARANTULA', 'Plum isopod': 'ISOPOD', 'Cat': 'CAT',
    };
    for (const [name, key] of Object.entries(cases)) {
        assert.deepEqual(defaultTemplateFor(name), TEMPLATES[key], name);
    }
});

test('unknown species get no default instead of a guess', () => {
    assert.equal(defaultTemplateFor('Thai purple zebra'), null);
    assert.equal(defaultTemplateFor(''), null);
    assert.equal(defaultTemplateFor(null), null);
});

test('"cat" only matches whole words (no false positives)', () => {
    assert.equal(defaultTemplateFor('Catfish'), null);
    assert.equal(defaultTemplateFor('Concatenated'), null);
});

test('defaultTemplateFor returns a copy so callers cannot corrupt the built-ins', () => {
    const copy = defaultTemplateFor('Fancy Rat');
    copy[0].taskName = 'CHANGED';
    copy.pop();
    assert.notEqual(defaultTemplateFor('Fancy Rat')[0].taskName, 'CHANGED');
    assert.equal(defaultTemplateFor('Fancy Rat').length, TEMPLATES.RAT.length);
});

test('planDefaultTemplates creates only missing templates and never overwrites existing ones', () => {
    const plan = planDefaultTemplates(
        ['Fancy Rat', 'fancy mouse', 'Corn Snake', 'Thai purple zebra', 'Fancy Rat', '  '],
        ['Fancy Mouse']
    );
    assert.deepEqual(plan.create.map((c) => c.species), ['Fancy Rat', 'Corn Snake']);
    assert.deepEqual(plan.noDefault, ['Thai purple zebra']);
});

test('planDefaultTemplates is idempotent once everything has been created', () => {
    const species = ['Fancy Rat', 'Corn Snake'];
    const first = planDefaultTemplates(species, []);
    const second = planDefaultTemplates(species, first.create.map((c) => c.species));
    assert.equal(first.create.length, 2);
    assert.deepEqual(second.create, []);
});

test('planDefaultTemplates handles missing inputs', () => {
    assert.deepEqual(planDefaultTemplates(undefined, undefined), { create: [], noDefault: [] });
});
