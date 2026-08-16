/**
 * AVK (Average Kinship / Mean Kinship) Unit Tests
 *
 * AVK_i = (1/N) x sum_{j=1}^{N} f(i,j)   over the reference population (N animals),
 * where f(i,j) is Wright's pedigree kinship (coancestry) coefficient, computed via
 * calculateAverageKinship() in utils/inbreeding.js (reuses buildPedigreeDAG/computePathSums,
 * the SAME machinery calculatePairingInbreeding()/COI already use — nothing about the
 * existing COI calculation is modified by these tests or by the AVK code itself).
 *
 * Self-kinship f(i,i) = (1 + F_i) / 2 falls out of the same summation automatically
 * (no special-cased formula), so an animal that is a member of its own reference
 * population always contributes at least 0.5/N to its own AVK — this is why an
 * unrelated founder with no pedigree still gets a small nonzero AVK rather than a
 * misleading 0%.
 *
 * Tolerance: +/-0.01 percentage points (0.0001 absolute on the 0-100 scale), except
 * where noted for compounded floating point sums.
 */

const {
    calculateAverageKinship,
    calculateInbreedingCoefficient,
    calculatePairingInbreeding,
    buildPedigreeDAG,
    computePathSums
} = require('../utils/inbreeding');

// ---------------------------------------------------------------------------
// Pedigree builder helpers (same convention as tests/inbreeding.test.js)
// ---------------------------------------------------------------------------
function makeFetchAnimal(db) {
    return async (id) => {
        const entry = db[id];
        if (!entry) return null;
        return {
            id_public: id,
            name: String(id),
            sireId_public: entry.sire || null,
            damId_public: entry.dam || null
        };
    };
}

const TOLERANCE = 0.01;

function expectPct(actual, expected, label) {
    const diff = Math.abs(actual - expected);
    if (diff > TOLERANCE) {
        throw new Error(`${label}: expected ${expected}% but got ${actual}% (diff ${diff.toFixed(4)}%)`);
    }
}

// ---------------------------------------------------------------------------
// Minimal test runner (no external framework dependency, matches inbreeding.test.js)
// ---------------------------------------------------------------------------
const results = [];

async function test(name, fn) {
    try {
        await fn();
        results.push({ name, passed: true });
    } catch (e) {
        results.push({ name, passed: false, error: e.message });
    }
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

// 1. Animal with no known pedigree, alone in the population → only self-kinship counts.
// F_A = 0 (no parents) → f(A,A) = (1+0)/2 = 50% → AVK = 50% (NOT a misleading 0%).
test('No known pedigree, population of self only → AVK = 50%', async () => {
    const db = { A: { sire: null, dam: null } };
    const { avgKinship, populationSize } = await calculateAverageKinship('A', ['A'], makeFetchAnimal(db));
    expectPct(avgKinship, 50, 'No pedigree self-only AVK');
    if (populationSize !== 1) throw new Error(`Expected populationSize 1, got ${populationSize}`);
});

// 2. Animal with no known pedigree, in a population of totally unrelated founders.
// Self-kinship 50% + (N-1) unrelated pairs at 0% each, averaged over N.
test('No known pedigree, population of unrelated founders → AVK = 50%/N', async () => {
    const db = {
        A: { sire: null, dam: null },
        B: { sire: null, dam: null },
        C: { sire: null, dam: null }
    };
    const { avgKinship } = await calculateAverageKinship('A', ['A', 'B', 'C'], makeFetchAnimal(db));
    expectPct(avgKinship, 50 / 3, 'Unrelated founders AVK');
});

// 3. Simple pedigree: one animal (X) with known unrelated parents, in a population where
// everyone else is unrelated to X → AVK = self-kinship / N (X's own COI is 0%, so f(X,X)=50%).
test('Simple pedigree, unrelated population → AVK = 50%/N', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        X: { sire: 'S', dam: 'D' },
        Y: { sire: null, dam: null },
        Z: { sire: null, dam: null }
    };
    const { avgKinship } = await calculateAverageKinship('X', ['X', 'Y', 'Z'], makeFetchAnimal(db));
    expectPct(avgKinship, 50 / 3, 'Simple pedigree AVK');
});

// 4. Shared ancestors: X and Y are full siblings (share both parents). Kinship f(X,Y) for
// full siblings = 25% (same value as the COI of their mated offspring — a well-known
// pedigree identity). Population = {X, Y}: AVK(X) = (f(X,X) + f(X,Y)) / 2 = (50 + 25)/2 = 37.5%
test('Shared ancestors (full siblings) → AVK reflects sibling kinship', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        X: { sire: 'S', dam: 'D' },
        Y: { sire: 'S', dam: 'D' }
    };
    // Sanity-check the underlying kinship value matches the known full-sibling COI identity.
    const siblingKinship = await calculatePairingInbreeding('X', 'Y', makeFetchAnimal(db), 50);
    expectPct(siblingKinship, 25, 'Full-sibling kinship sanity check');

    const { avgKinship } = await calculateAverageKinship('X', ['X', 'Y'], makeFetchAnimal(db));
    expectPct(avgKinship, 37.5, 'Full-sibling AVK');
});

// 5. Heavily represented lineage: X's genes are duplicated across most of a large
// population (many descendants of X), so X's AVK should be markedly higher than an
// unrelated outsider's AVK against that same population.
test('Heavily represented lineage → high AVK relative to an unrelated outsider', async () => {
    const db = {
        X: { sire: null, dam: null },
        U1: { sire: null, dam: null }, U2: { sire: null, dam: null }, U3: { sire: null, dam: null },
        U4: { sire: null, dam: null }, U5: { sire: null, dam: null },
        // Five of X's offspring, each out of an unrelated mate — X's lineage saturates the group.
        C1: { sire: 'X', dam: 'U1' }, C2: { sire: 'X', dam: 'U2' }, C3: { sire: 'X', dam: 'U3' },
        C4: { sire: 'X', dam: 'U4' }, C5: { sire: 'X', dam: 'U5' },
        // A totally unrelated outsider founder, for comparison.
        OUT: { sire: null, dam: null }
    };
    const population = ['C1', 'C2', 'C3', 'C4', 'C5', 'OUT'];
    const fetchAnimal = makeFetchAnimal(db);

    const { avgKinship: xAvk } = await calculateAverageKinship('X', population, fetchAnimal);
    const { avgKinship: outAvk } = await calculateAverageKinship('OUT', population, fetchAnimal);

    if (!(xAvk > outAvk)) {
        throw new Error(`Expected heavily-represented X's AVK (${xAvk}%) > unrelated OUT's AVK (${outAvk}%)`);
    }
});

// 6. Multiple unrelated lineages: two separate founder lines with no crossover — every
// cross-line kinship is 0%, so AVK for a member of line A against a population drawn from
// BOTH lines should be lower than against a population drawn ONLY from its own line.
test('Multiple unrelated lineages → cross-line kinship is 0, lowering AVK', async () => {
    const db = {
        A1: { sire: null, dam: null }, A2: { sire: null, dam: null },
        B1: { sire: null, dam: null }, B2: { sire: null, dam: null },
        // AX is A1 x A2's offspring (some inbreeding-free relation within line A)
        AX: { sire: 'A1', dam: 'A2' },
        AY: { sire: 'A1', dam: 'A2' } // full sibling of AX, still line A
    };
    const fetchAnimal = makeFetchAnimal(db);

    const { avgKinship: withinLine } = await calculateAverageKinship('AX', ['AX', 'AY'], fetchAnimal);
    const { avgKinship: crossLine } = await calculateAverageKinship('AX', ['AX', 'B1', 'B2'], fetchAnimal);

    if (!(crossLine < withinLine)) {
        throw new Error(`Expected cross-line AVK (${crossLine}%) < within-line AVK (${withinLine}%)`);
    }
});

// 7. Incomplete pedigree: only one parent known (dam unknown). Should compute without
// error/NaN and should not fabricate the missing dam side.
test('Incomplete pedigree (one known parent) → computes without error', async () => {
    const db = {
        S: { sire: null, dam: null },
        X: { sire: 'S', dam: null },
        Y: { sire: 'S', dam: null } // half-sibling of X via the known sire only
    };
    const { avgKinship, populationSize } = await calculateAverageKinship('X', ['X', 'Y'], makeFetchAnimal(db));
    if (avgKinship == null || Number.isNaN(avgKinship)) throw new Error('AVK should be a number, not null/NaN');
    if (populationSize !== 2) throw new Error(`Expected populationSize 2, got ${populationSize}`);
    // Half-siblings via one shared parent share SOME kinship, so AVK must exceed the
    // "no relation at all" self-only floor of 50%/N... i.e. it should be > 25% here.
    if (!(avgKinship > 25)) throw new Error(`Expected AVK > 25% for half-sibling pairing, got ${avgKinship}%`);
});

// 8. Empty reference population → null (not 0%, not an error) — cannot be computed.
test('Empty reference population → avgKinship is null', async () => {
    const db = { A: { sire: null, dam: null } };
    const { avgKinship, populationSize } = await calculateAverageKinship('A', [], makeFetchAnimal(db));
    if (avgKinship !== null) throw new Error(`Expected null avgKinship for empty population, got ${avgKinship}`);
    if (populationSize !== 0) throw new Error(`Expected populationSize 0, got ${populationSize}`);
});

// 9. Malformed/cyclic pedigree data must not cause infinite recursion/stack overflow.
// buildPedigreeDAG is BFS-based with a `queued` visited-set guard (not naive recursion),
// so a data error where an animal is its own ancestor must terminate, not hang/crash.
test('Malformed cyclic pedigree does not cause infinite recursion', async () => {
    const db = {
        // A's sire is B, B's sire is A — a data-entry cycle.
        A: { sire: 'B', dam: null },
        B: { sire: 'A', dam: null },
        C: { sire: null, dam: null }
    };
    const fetchAnimal = makeFetchAnimal(db);
    const dag = await buildPedigreeDAG('A', fetchAnimal, 50);
    const dp = computePathSums('A', dag);
    if (!(dp.size > 0)) throw new Error('Expected a non-empty path-sum map for cyclic pedigree');

    const { avgKinship } = await calculateAverageKinship('A', ['A', 'C'], fetchAnimal, 50);
    if (avgKinship == null || Number.isNaN(avgKinship)) throw new Error('AVK should resolve to a number for cyclic pedigree, not hang/NaN');
});

// 10. Deep pedigree with duplicated ancestors (linebreeding several generations back)
// must still terminate promptly and produce a sane (finite, non-negative) result.
test('Deep pedigree with duplicated ancestors resolves correctly', async () => {
    const db = {
        F: { sire: null, dam: null }, // founder, reused many times below
        G1: { sire: 'F', dam: null }, G2: { sire: 'F', dam: null },
        H1: { sire: 'G1', dam: 'G2' }, H2: { sire: 'G1', dam: 'G2' },
        I1: { sire: 'H1', dam: 'H2' }, I2: { sire: 'H1', dam: 'H2' },
        J1: { sire: 'I1', dam: 'I2' }
    };
    const fetchAnimal = makeFetchAnimal(db);
    const { avgKinship, populationSize } = await calculateAverageKinship('J1', ['J1', 'I1', 'I2'], fetchAnimal, 50);
    if (avgKinship == null || Number.isNaN(avgKinship) || avgKinship < 0) {
        throw new Error(`Expected a sane non-negative AVK, got ${avgKinship}`);
    }
    if (populationSize !== 3) throw new Error(`Expected populationSize 3, got ${populationSize}`);
});

// 11. Existing COI calculation must remain byte-for-byte identical after adding AVK code
// (calculateAverageKinship/kinshipFromPathSums are additive-only in utils/inbreeding.js).
test('Existing COI calculation is unchanged by AVK addition (regression check)', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        A: { sire: 'S', dam: 'D' },
        B: { sire: 'S', dam: 'D' },
        X: { sire: 'A', dam: 'B' }
    };
    const coi = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectPct(coi, 25, 'COI regression: full-sibling mating');

    const pairing = await calculatePairingInbreeding('A', 'B', makeFetchAnimal(db), 50);
    expectPct(pairing, 25, 'COI regression: pairing full siblings');
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
(async () => {
    await new Promise(r => setTimeout(r, 100));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed);

    console.log('\n==============================');
    console.log(' AVK Unit Test Results');
    console.log('==============================');
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
})();
