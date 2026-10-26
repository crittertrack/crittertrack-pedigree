const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isAutoWeaningUser,
    weaningAgeDaysForSpecies,
    computeWeaningDate,
    applyAutoWeaningOnCreate,
    applyAutoWeaningOnUpdate,
    gestationDaysForSpecies,
    computeExpectedDueDate,
    applyAutoDueDateOnCreate,
    applyAutoDueDateOnUpdate,
} = require('../utils/autoWeaningDate');

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
const CTU2 = 'CTU2';
const MOUSE = async () => 'Fancy Mouse'; // stub species lookup for litters with no species of their own

test('the auto-calculation is open to every user (only a missing id is excluded)', () => {
    for (const id of ['CTU2', 'CTU5', 'CTU107', 'CTU80', 'CTU1', 'CTU10', 'CTU8', 'ctu999']) {
        assert.equal(isAutoWeaningUser(id), true, id);
    }
    assert.equal(isAutoWeaningUser(null), false);
    assert.equal(isAutoWeaningUser(undefined), false);
    assert.equal(isAutoWeaningUser(''), false);
});

test('auto-calc switches: both default ON, each can be turned off independently', () => {
    const { resolveAutoCalcPrefs } = require('../utils/autoWeaningDate');
    assert.deepEqual(resolveAutoCalcPrefs(undefined), { dueDate: true, weaning: true });
    assert.deepEqual(resolveAutoCalcPrefs({}), { dueDate: true, weaning: true });
    assert.deepEqual(resolveAutoCalcPrefs({ autoCalcDueDate: false }), { dueDate: false, weaning: true });
    assert.deepEqual(resolveAutoCalcPrefs({ autoCalcWeaningDate: false }), { dueDate: true, weaning: false });
    assert.deepEqual(resolveAutoCalcPrefs({ autoCalcDueDate: false, autoCalcWeaningDate: false }), { dueDate: false, weaning: false });
    assert.deepEqual(resolveAutoCalcPrefs({ autoCalcDueDate: true, autoCalcWeaningDate: true }), { dueDate: true, weaning: true });
});

test('maps each species to its weaning age', () => {
    assert.equal(weaningAgeDaysForSpecies('Fancy Mouse'), 31);
    assert.equal(weaningAgeDaysForSpecies('Mouse'), 31);            // back-compat alias
    assert.equal(weaningAgeDaysForSpecies('Fancy Rat'), 40);
    assert.equal(weaningAgeDaysForSpecies('Rat'), 40);              // back-compat alias
    assert.equal(weaningAgeDaysForSpecies('Syrian Hamster'), 28);
    assert.equal(weaningAgeDaysForSpecies('Russian Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Campbells Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Chinese Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Roborovski Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Sugar Glider'), null);   // no rule -> no auto-fill
    assert.equal(weaningAgeDaysForSpecies('Whitetail Antsangy'), null);
    assert.equal(weaningAgeDaysForSpecies(null), null);
    assert.equal(weaningAgeDaysForSpecies(''), null);
});

test('guinea pig: weaning 21 days, gestation 63 days (low end of range)', async () => {
    assert.equal(weaningAgeDaysForSpecies('Guinea Pig'), 21);
    assert.equal(weaningAgeDaysForSpecies('guinea-pigs'), 21);
    assert.equal(gestationDaysForSpecies('Guinea Pig'), 63);
    assert.equal(gestationDaysForSpecies('guinea-pigs'), 63);
    const w = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Guinea Pig' }, CTU2);
    assert.equal(day(w.weaningDate), '2026-03-22');
    const d = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Guinea Pig' }, CTU2);
    assert.equal(day(d.expectedDueDate), '2026-12-04');
});

test('other mammals: gestation/weaning at the low end of range', () => {
    const expected = {
        'Rabbit': [28, 28], 'Rabbit (Domesticated)': [28, 28],
        'Gerbil': [24, 21], 'Fat-tailed Gerbil': [19, 21], 'Ferret': [41, 42], 'Natal Rats': [23, 21],
        'Cat': [63, 42], 'Dog': [58, 42], 'Hedgehog': [34, 28], 'Degu': [87, 28],
        'Chinchilla': [105, 42], 'Prairie Dog': [34, 42], 'Deer mouse': [22, 21], 'African Pygmy Mouse': [18, 21],
        'African Pygmy Dormouse': [24, 35],
    };
    for (const [name, [gest, wean]] of Object.entries(expected)) {
        assert.equal(gestationDaysForSpecies(name), gest, `${name} gestation`);
        assert.equal(weaningAgeDaysForSpecies(name), wean, `${name} weaning`);
    }
});

test('mouse rule only matches Fancy Mouse / Mouse (not other mouse species)', () => {
    assert.equal(gestationDaysForSpecies('Fancy Mouse'), 19);
    assert.equal(gestationDaysForSpecies('Mouse'), 19);
    assert.equal(gestationDaysForSpecies('African Pygmy Dormouse'), 24); // own rule, not the mouse one
    assert.equal(gestationDaysForSpecies('African Pygmy Mouse'), 18);
    assert.equal(gestationDaysForSpecies('Deer mouse'), 22);
    assert.equal(gestationDaysForSpecies('Sugar Glider'), null);   // deliberately left out
    assert.equal(gestationDaysForSpecies('Whitetail Antsangy'), null); // deliberately left out
});

test('computes weaning dates per species (UTC-safe calendar days)', () => {
    assert.equal(day(computeWeaningDate('2026-01-01', 31)), '2026-02-01');   // mouse 31
    assert.equal(computeWeaningDate('2026-01-01'), null);                    // no age -> no date
    assert.equal(computeWeaningDate('2026-01-01', null), null);
    assert.equal(day(computeWeaningDate('2026-01-01', 40)), '2026-02-10');   // rat
    assert.equal(day(computeWeaningDate('2026-01-01', 28)), '2026-01-29');   // syrian
    assert.equal(day(computeWeaningDate('2026-01-01', 24)), '2026-01-25');   // dwarf
    assert.equal(day(computeWeaningDate('2024-02-10', 31)), '2024-03-12');   // leap-year birth
    assert.equal(computeWeaningDate(null, 31), null);
    assert.equal(computeWeaningDate('not-a-date', 31), null);
});

// ── CREATE (POST /api/litters, imports) ────────────────────────────────────

test('create: an unresolvable species gets NO auto weaningDate (no fallback)', async () => {
    const none = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01' }, CTU2);
    assert.equal('weaningDate' in none, false);
    const glider = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Sugar Glider' }, CTU2);
    assert.equal('weaningDate' in glider, false);
    const mouse = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Fancy Mouse' }, CTU2);
    assert.equal(day(mouse.weaningDate), '2026-04-01');
});

test('create: an explicit payload species drives the age', async () => {
    const rat = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Fancy Rat' }, CTU2);
    assert.equal(day(rat.weaningDate), '2026-04-10');
    const syrian = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Syrian Hamster' }, CTU2);
    assert.equal(day(syrian.weaningDate), '2026-03-29');
    const dwarf = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Campbells Dwarf Hamster' }, CTU2);
    assert.equal(day(dwarf.weaningDate), '2026-03-25');
});

test('create: species resolved from the parents when the payload has none (stub lookup)', async () => {
    const stub = async (sire, dam) => {
        assert.equal(sire, 'CTC1');
        assert.equal(dam, 'CTC2');
        return 'Fancy Rat';
    };
    const p = await applyAutoWeaningOnCreate(
        { birthDate: '2026-03-01', sireId_public: 'CTC1', damId_public: 'CTC2' },
        CTU2, stub
    );
    assert.equal(day(p.weaningDate), '2026-04-10');
});

test('create: works for any user, but not when there is no user id', async () => {
    const p = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Fancy Rat' }, 'CTU1');
    assert.equal(day(p.weaningDate), '2026-04-10');
    const none = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Fancy Rat' }, null);
    assert.equal('weaningDate' in none, false);
});

test('create: respects an explicit weaningDate; does nothing without a birthDate', async () => {
    const a = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', weaningDate: '2026-04-10' }, CTU2);
    assert.equal(day(a.weaningDate), '2026-04-10');
    const b = await applyAutoWeaningOnCreate({ matingDate: '2026-02-01' }, CTU2);
    assert.equal('weaningDate' in b, false);
});

// ── UPDATE (PUT /api/litters/:id) ──────────────────────────────────────────

test('update: auto-fills a blank weaningDate from the stored birthDate', async () => {
    const p = await applyAutoWeaningOnUpdate({ weaningDate: null }, { birthDate: '2026-03-01' }, CTU2, MOUSE);
    assert.equal(day(p.weaningDate), '2026-04-01');
});

test('update: an unresolvable species leaves the weaningDate blank (no fallback)', async () => {
    const none = async () => null;
    const p = await applyAutoWeaningOnUpdate({ weaningDate: null }, { birthDate: '2026-03-01' }, CTU2, none);
    assert.equal(p.weaningDate, null);
});

test('update: re-derives an auto value when the birthDate is corrected', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-05', weaningDate: '2026-04-01' }, // form echoes the stored value
        { birthDate: '2026-03-01', weaningDate: '2026-04-01' }, // stored was auto-derived
        CTU2, MOUSE
    );
    assert.equal(day(p.weaningDate), '2026-04-05');
});

test('update: re-derives when the species changes (mouse 31 -> rat 40)', async () => {
    const stub = async () => 'Fancy Rat';
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: '2026-04-01' }, // echo of the old auto value
        { birthDate: '2026-03-01', weaningDate: '2026-04-01', sireId_public: 'CTC1', damId_public: 'CTC2' },
        CTU2, stub
    );
    assert.equal(day(p.weaningDate), '2026-04-10');
});

test('update: a rat date auto-filled at the old 35 days is re-derived to 40, not treated as manual', async () => {
    const stub = async () => 'Fancy Rat';
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: '2026-04-05' }, // echo of the legacy 35-day value
        { birthDate: '2026-03-01', weaningDate: '2026-04-05', sireId_public: 'CTC1', damId_public: 'CTC2' },
        CTU2, stub
    );
    assert.equal(day(p.weaningDate), '2026-04-10');
});

test('update: never overwrites a hand-entered weaningDate', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: '2026-04-10' },
        { birthDate: '2026-03-01', weaningDate: '2026-04-10' },
        CTU2
    );
    assert.equal(day(p.weaningDate), '2026-04-10');
});

test('update: "Wean Today" confirmation is never rewritten', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { weaningDate: '2026-04-03', weaningConfirmed: true },
        { birthDate: '2026-03-01', weaningDate: '2026-04-01', weaningConfirmed: false },
        CTU2
    );
    assert.equal(day(p.weaningDate), '2026-04-03');
});

test('update: later edits on a confirmed litter leave the weaning date alone', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { notes: 'x' },
        { birthDate: '2026-03-01', weaningDate: '2026-04-03', weaningConfirmed: true },
        CTU2
    );
    assert.equal('weaningDate' in p, false);
});

test('update: patch-style payload without weaningDate fills a missing one (Born Today)', async () => {
    const p = await applyAutoWeaningOnUpdate({ birthDate: '2026-03-01' }, { weaningDate: null }, CTU2, MOUSE);
    assert.equal(day(p.weaningDate), '2026-04-01');
});

test('update: patch-style payload leaves a stored manual weaningDate alone', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { matingDate: '2026-02-01' },
        { birthDate: '2026-03-01', weaningDate: '2026-04-10' },
        CTU2
    );
    assert.equal('weaningDate' in p, false);
});

test('update: clearing the field re-applies the rule', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: null },
        { birthDate: '2026-03-01', weaningDate: '2026-04-10' },
        CTU2, MOUSE
    );
    assert.equal(day(p.weaningDate), '2026-04-01');
});

test('update: works for any user, but not when there is no user id', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: null },
        { birthDate: '2026-03-01' },
        'CTU1', MOUSE
    );
    assert.equal(day(p.weaningDate), '2026-04-01');
    const none = await applyAutoWeaningOnUpdate({ birthDate: '2026-03-01', weaningDate: null }, { birthDate: '2026-03-01' }, null, MOUSE);
    assert.equal(none.weaningDate, null);
});

test('update: no birthDate anywhere means untouched', async () => {
    const p = await applyAutoWeaningOnUpdate({ matingDate: '2026-02-01' }, {}, CTU2);
    assert.equal('weaningDate' in p, false);
});

// ── EXPECTED DUE DATES (matingDate + gestation) ──────────────────────────────

test('maps each species to its gestation', () => {
    assert.equal(gestationDaysForSpecies('Fancy Mouse'), 19);
    assert.equal(gestationDaysForSpecies('Mouse'), 19);
    assert.equal(gestationDaysForSpecies('Fancy Rat'), 21);
    assert.equal(gestationDaysForSpecies('Rat'), 21);
    assert.equal(gestationDaysForSpecies('Syrian Hamster'), 16);
    assert.equal(gestationDaysForSpecies('Russian Dwarf Hamster'), 18);
    assert.equal(gestationDaysForSpecies('Campbells Dwarf Hamster'), 18);
    assert.equal(gestationDaysForSpecies('Chinese Dwarf Hamster'), 18);
    assert.equal(gestationDaysForSpecies('Roborovski Dwarf Hamster'), 18);
    assert.equal(gestationDaysForSpecies('Sugar Glider'), null); // unknown -> no auto-fill
    assert.equal(gestationDaysForSpecies(null), null);
});

test('computes expected due dates per species', () => {
    assert.equal(day(computeExpectedDueDate('2026-01-01', 19)), '2026-01-20');
    assert.equal(day(computeExpectedDueDate('2026-01-01', 21)), '2026-01-22');
    assert.equal(day(computeExpectedDueDate('2026-01-01', 16)), '2026-01-17');
    assert.equal(day(computeExpectedDueDate('2026-01-01', 18)), '2026-01-19');
    assert.equal(computeExpectedDueDate(null, 19), null);
    assert.equal(computeExpectedDueDate('2026-01-01', 0), null);
});

test('due create: fills from matingDate using the species gestation', async () => {
    const mouse = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Mouse' }, CTU2);
    assert.equal(day(mouse.expectedDueDate), '2026-10-21');
    const rat = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Rat' }, CTU2);
    assert.equal(day(rat.expectedDueDate), '2026-10-23');
    const syrian = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Syrian Hamster' }, CTU2);
    assert.equal(day(syrian.expectedDueDate), '2026-10-18');
    const dwarf = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Campbells Dwarf Hamster' }, CTU2);
    assert.equal(day(dwarf.expectedDueDate), '2026-10-20');
});

test('due create: species resolved from parents when the payload has none (stub)', async () => {
    const stub = async () => 'Fancy Rat';
    const p = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', sireId_public: 'CTC1', damId_public: 'CTC2' }, CTU2, stub);
    assert.equal(day(p.expectedDueDate), '2026-10-23');
});

test('due create: manual value, missing mating, unknown species, lost pregnancy, other users untouched', async () => {
    const manual = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', expectedDueDate: '2026-10-30', species: 'Fancy Mouse' }, CTU2);
    assert.equal(day(manual.expectedDueDate), '2026-10-30');
    const noMating = await applyAutoDueDateOnCreate({ species: 'Fancy Mouse' }, CTU2);
    assert.equal('expectedDueDate' in noMating, false);
    const unknown = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Sugar Glider' }, CTU2);
    assert.equal('expectedDueDate' in unknown, false);
    const lost = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Mouse', pregnancyLost: true }, CTU2);
    assert.equal('expectedDueDate' in lost, false);
    const anyUser = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Mouse' }, 'CTU1');
    assert.equal(day(anyUser.expectedDueDate), '2026-10-21');
    const noUser = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Mouse' }, null);
    assert.equal('expectedDueDate' in noUser, false);
});

test('due update: "Mated Today" moves an auto due date from the scheduled to the actual mating', async () => {
    const stub = async () => 'Fancy Mouse';
    const p = await applyAutoDueDateOnUpdate(
        { matingDate: '2026-10-05', isPlanned: false }, // Mated Today patch no due key
        { matingDate: '2026-11-02', expectedDueDate: '2026-11-21', isPlanned: true, sireId_public: 'CTC1', damId_public: 'CTC2' }, // auto due from the scheduled date
        CTU2, stub
    );
    assert.equal(day(p.expectedDueDate), '2026-10-24'); // 2026-10-05 + 19
});

test('due update: re-derives when the mating date changes (echo of auto value)', async () => {
    const stub = async () => 'Fancy Mouse';
    const p = await applyAutoDueDateOnUpdate(
        { matingDate: '2026-10-05', expectedDueDate: '2026-11-21' }, // form echoes the stored value
        { matingDate: '2026-11-02', expectedDueDate: '2026-11-21', sireId_public: 'CTC1', damId_public: 'CTC2' },
        CTU2, stub
    );
    assert.equal(day(p.expectedDueDate), '2026-10-24');
});

test('due update: never overwrites a hand-entered due date', async () => {
    const stub = async () => 'Fancy Mouse';
    const p = await applyAutoDueDateOnUpdate(
        { matingDate: '2026-10-05', expectedDueDate: '2026-10-30' }, // user changed it by hand
        { matingDate: '2026-10-05', expectedDueDate: '2026-10-24', sireId_public: 'CTC1', damId_public: 'CTC2' },
        CTU2, stub
    );
    assert.equal(day(p.expectedDueDate), '2026-10-30');
});

test('due update: clearing the field re-fills; lost pregnancy and other users untouched', async () => {
    const stub = async () => 'Fancy Mouse';
    const cleared = await applyAutoDueDateOnUpdate(
        { matingDate: '2026-10-05', expectedDueDate: null },
        { matingDate: '2026-10-05', expectedDueDate: '2026-10-30' },
        CTU2, stub
    );
    assert.equal(day(cleared.expectedDueDate), '2026-10-24');
    const lost = await applyAutoDueDateOnUpdate({ matingDate: '2026-10-05' }, { matingDate: '2026-10-05', pregnancyLost: true }, CTU2, stub);
    assert.equal('expectedDueDate' in lost, false);
    const anyUser = await applyAutoDueDateOnUpdate({ matingDate: '2026-10-05' }, { matingDate: '2026-10-05' }, 'CTU1', stub);
    assert.equal(day(anyUser.expectedDueDate), '2026-10-24');
    const noUser = await applyAutoDueDateOnUpdate({ matingDate: '2026-10-05' }, { matingDate: '2026-10-05' }, null, stub);
    assert.equal('expectedDueDate' in noUser, false);
});
