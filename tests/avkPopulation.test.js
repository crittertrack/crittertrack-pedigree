/**
 * AVK Reference-Population Selection Unit Tests
 *
 * Verifies the query shape produced by buildAvkPopulationQuery() in database/db_service.js —
 * the isolated function that decides WHICH animals count toward an animal's AVK reference
 * population. Kept separate from the kinship math tests (tests/avk.test.js).
 *
 * No live MongoDB connection is used/required: these tests only assert on the shape of the
 * Mongoose query object itself, so they can run in any environment. That query object is the
 * exact one passed to Animal.find(...) in getAvkReferencePopulation(), so asserting its shape
 * is equivalent to asserting the filtering behavior.
 *
 * Covers the spec's required exclusions:
 *   - archived animals excluded
 *   - deceased animals excluded (living only)
 *   - other species excluded
 *   - transferred animals handled correctly (via creatorId = the CURRENT owner, which the
 *     transfer-accept flow already updates — see /memories/repo/admin-ownership-transfer-system.md)
 */

const { buildAvkPopulationQuery } = require('../database/db_service');

const results = [];

function test(name, fn) {
    try {
        fn();
        results.push({ name, passed: true });
    } catch (e) {
        results.push({ name, passed: false, error: e.message });
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

// 1. Basic shape: scoped to the given owner + species.
test('Query is scoped to the given creatorId and species', () => {
    const q = buildAvkPopulationQuery('user123', 'Fancy Mouse');
    assert(q.creatorId === 'user123', 'creatorId should match the animal\'s current owner');
    assert(q.species === 'Fancy Mouse', 'species should match the animal being scored');
});

// 2. Archived animals excluded.
test('Archived animals are excluded ($ne: true)', () => {
    const q = buildAvkPopulationQuery('user123', 'Fancy Mouse');
    assert(q.archived && q.archived['$ne'] === true, 'archived filter should exclude archived: true');
});

// 3. Deceased animals excluded (living only) — must not require the field to exist,
// since legacy docs may simply not have deceasedDate set at all.
test('Deceased animals are excluded, but missing-field docs are treated as living', () => {
    const q = buildAvkPopulationQuery('user123', 'Fancy Mouse');
    assert(Array.isArray(q['$or']), 'expected an $or clause for the living/deceased check');
    const hasNullClause = q['$or'].some(c => c.deceasedDate === null);
    const hasMissingClause = q['$or'].some(c => c.deceasedDate && c.deceasedDate['$exists'] === false);
    assert(hasNullClause, 'expected a clause matching deceasedDate: null');
    assert(hasMissingClause, 'expected a clause matching missing deceasedDate field');
});

// 4. Only currently-owned (isOwned) and non-stub records count.
test('Only currently-owned, non-stub records are included', () => {
    const q = buildAvkPopulationQuery('user123', 'Fancy Mouse');
    assert(q.isOwned === true, 'expected isOwned: true');
    assert(q.isStub && q.isStub['$ne'] === true, 'expected isStub: { $ne: true }');
});

// 5. Other species excluded — different species value produces a different query.
test('Different species produces a query scoped to that species only', () => {
    const q1 = buildAvkPopulationQuery('user123', 'Fancy Mouse');
    const q2 = buildAvkPopulationQuery('user123', 'Fancy Rat');
    assert(q1.species !== q2.species, 'species filters should differ per-species');
});

// 6. Transferred animals: population is scoped by CURRENT creatorId, so an animal
// transferred away (creatorId now belongs to the new owner) is naturally excluded from the
// original owner's population, while an animal transferred in (creatorId updated to the new
// owner) is naturally included — no special-case logic needed beyond the creatorId filter.
test('Population scoping by current creatorId naturally follows transfers', () => {
    const originalOwnerQuery = buildAvkPopulationQuery('originalOwner', 'Fancy Mouse');
    const newOwnerQuery = buildAvkPopulationQuery('newOwner', 'Fancy Mouse');
    assert(originalOwnerQuery.creatorId === 'originalOwner', 'original owner query should filter by their own id');
    assert(newOwnerQuery.creatorId === 'newOwner', 'new owner query should filter by their own id');
    assert(originalOwnerQuery.creatorId !== newOwnerQuery.creatorId, 'the two owners\' populations should not overlap by construction');
});

console.log('\n==============================');
console.log(' AVK Reference Population Test Results');
console.log('==============================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed);
results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (!r.passed) console.log(`   → ${r.error}`);
});
console.log('------------------------------');
console.log(`Passed: ${passed}/${results.length}`);
if (failed.length > 0) {
    console.log(`Failed: ${failed.length}`);
    process.exit(1);
} else {
    console.log('All tests passed.');
}
