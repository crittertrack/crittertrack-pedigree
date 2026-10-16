const test = require('node:test');
const assert = require('node:assert/strict');
const {
    DEFAULT_WEANING_AGE_DAYS,
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

test('scopes the rule to CTU2, CTU5, CTU107 and CTU80 only', () => {
    assert.equal(isAutoWeaningUser('CTU2'), true);
    assert.equal(isAutoWeaningUser('ctu2'), true);
    assert.equal(isAutoWeaningUser('CTU5'), true);
    assert.equal(isAutoWeaningUser('CTU107'), true);
    assert.equal(isAutoWeaningUser('CTU80'), true);
    assert.equal(isAutoWeaningUser('CTU1'), false);
    assert.equal(isAutoWeaningUser('CTU10'), false);
    assert.equal(isAutoWeaningUser('CTU8'), false);
    assert.equal(isAutoWeaningUser(null), false);
});

test('maps each species to its weaning age', () => {
    assert.equal(DEFAULT_WEANING_AGE_DAYS, 31);
    assert.equal(weaningAgeDaysForSpecies('Fancy Mouse'), 31);
    assert.equal(weaningAgeDaysForSpecies('Mouse'), 31);            // back-compat alias
    assert.equal(weaningAgeDaysForSpecies('Fancy Rat'), 35);
    assert.equal(weaningAgeDaysForSpecies('Rat'), 35);              // back-compat alias
    assert.equal(weaningAgeDaysForSpecies('Syrian Hamster'), 28);
    assert.equal(weaningAgeDaysForSpecies('Russian Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Campbells Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Chinese Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Roborovski Dwarf Hamster'), 24);
    assert.equal(weaningAgeDaysForSpecies('Gerbil'), 31);           // unspecified -> default
    assert.equal(weaningAgeDaysForSpecies(null), 31);
    assert.equal(weaningAgeDaysForSpecies(''), 31);
});

test('computes weaning dates per species (UTC-safe calendar days)', () => {
    assert.equal(day(computeWeaningDate('2026-01-01')), '2026-02-01');       // mouse default 31
    assert.equal(day(computeWeaningDate('2026-01-01', 35)), '2026-02-05');   // rat
    assert.equal(day(computeWeaningDate('2026-01-01', 28)), '2026-01-29');   // syrian
    assert.equal(day(computeWeaningDate('2026-01-01', 24)), '2026-01-25');   // dwarf
    assert.equal(day(computeWeaningDate('2024-02-10')), '2024-03-12');       // leap-year birth
    assert.equal(computeWeaningDate(null), null);
    assert.equal(computeWeaningDate('not-a-date'), null);
});

// ── CREATE (POST /api/litters, imports) ────────────────────────────────────

test('create: fills weaningDate = birthDate + 31 for an unresolvable species', async () => {
    const p = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01' }, CTU2);
    assert.equal(day(p.weaningDate), '2026-04-01');
});

test('create: an explicit payload species drives the age', async () => {
    const rat = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Fancy Rat' }, CTU2);
    assert.equal(day(rat.weaningDate), '2026-04-05');
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
    assert.equal(day(p.weaningDate), '2026-04-05');
});

test('create: leaves every other user untouched', async () => {
    const p = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', species: 'Fancy Rat' }, 'CTU1');
    assert.equal('weaningDate' in p, false);
});

test('create: respects an explicit weaningDate; does nothing without a birthDate', async () => {
    const a = await applyAutoWeaningOnCreate({ birthDate: '2026-03-01', weaningDate: '2026-04-10' }, CTU2);
    assert.equal(day(a.weaningDate), '2026-04-10');
    const b = await applyAutoWeaningOnCreate({ matingDate: '2026-02-01' }, CTU2);
    assert.equal('weaningDate' in b, false);
});

// ── UPDATE (PUT /api/litters/:id) ──────────────────────────────────────────

test('update: auto-fills a blank weaningDate from the stored birthDate', async () => {
    const p = await applyAutoWeaningOnUpdate({ weaningDate: null }, { birthDate: '2026-03-01' }, CTU2);
    assert.equal(day(p.weaningDate), '2026-04-01');
});

test('update: re-derives an auto value when the birthDate is corrected', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-05', weaningDate: '2026-04-01' }, // form echoes the stored value
        { birthDate: '2026-03-01', weaningDate: '2026-04-01' }, // stored was auto-derived
        CTU2
    );
    assert.equal(day(p.weaningDate), '2026-04-05');
});

test('update: re-derives when the species changes (mouse 31 -> rat 35)', async () => {
    const stub = async () => 'Fancy Rat';
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: '2026-04-01' }, // echo of the old auto value
        { birthDate: '2026-03-01', weaningDate: '2026-04-01', sireId_public: 'CTC1', damId_public: 'CTC2' },
        CTU2, stub
    );
    assert.equal(day(p.weaningDate), '2026-04-05');
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
    const p = await applyAutoWeaningOnUpdate({ birthDate: '2026-03-01' }, { weaningDate: null }, CTU2);
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
        CTU2
    );
    assert.equal(day(p.weaningDate), '2026-04-01');
});

test('update: other users are never touched', async () => {
    const p = await applyAutoWeaningOnUpdate(
        { birthDate: '2026-03-01', weaningDate: null },
        { birthDate: '2026-03-01' },
        'CTU1'
    );
    assert.equal(p.weaningDate, null);
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
    assert.equal(gestationDaysForSpecies('Gerbil'), null); // unknown -> no auto-fill
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
    const unknown = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Gerbil' }, CTU2);
    assert.equal('expectedDueDate' in unknown, false);
    const lost = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Mouse', pregnancyLost: true }, CTU2);
    assert.equal('expectedDueDate' in lost, false);
    const other = await applyAutoDueDateOnCreate({ matingDate: '2026-10-02', species: 'Fancy Mouse' }, 'CTU1');
    assert.equal('expectedDueDate' in other, false);
});

test('due update: "Mated Today" moves an auto due date from the scheduled to the actual mating', async () => {
    const stub = async () => 'Fancy Mouse';
    const p = await applyAutoDueDateOnUpdate(
        { matingDate: '2026-10-05', isPlanned: false }, // Mated Today patch — no due key
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
    const other = await applyAutoDueDateOnUpdate({ matingDate: '2026-10-05' }, { matingDate: '2026-10-05' }, 'CTU1', stub);
    assert.equal('expectedDueDate' in other, false);
});
