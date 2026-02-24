/**
 * COI (Coefficient of Inbreeding) Unit Tests
 *
 * All expected values are derived from Wright's formula:
 *   F = Σ (½)^(n1+n2+1) × (1+F_A)
 *   where n1/n2 = number of parent→child links to common ancestor.
 *
 * Tolerance: ±0.01% (0.0001 absolute on the 0-100 scale)
 */

const {
    calculateInbreedingCoefficient,
    calculatePairingInbreeding,
    buildPedigree
} = require('../utils/inbreeding');

// ---------------------------------------------------------------------------
// Pedigree builder helpers
// ---------------------------------------------------------------------------
// Builds an in-memory animal database from a plain object map.
// Each animal: { sire: id | null, dam: id | null }
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

const TOLERANCE = 0.01; // ±0.01%

function expectCOI(actual, expected, label) {
    const diff = Math.abs(actual - expected);
    if (diff > TOLERANCE) {
        throw new Error(
            `${label}: expected ${expected}% but got ${actual}% (diff ${diff.toFixed(4)}%)`
        );
    }
}

// ---------------------------------------------------------------------------
// Test runner (minimal, no external framework dependency)
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

// 1. Unrelated parents → COI = 0%
test('Unrelated parents → 0%', async () => {
    const db = {
        A: { sire: null, dam: null },
        B: { sire: null, dam: null },
        X: { sire: 'A', dam: 'B' }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectCOI(result, 0, 'Unrelated');
});

// 2. Parent × offspring → 25%
// Setup: GP is unrelated founder, O1's parents are GP and unrelated U.
// Mate GP (as sire) back to O1 (as dam) → expected offspring COI = 25%.
test('Parent × offspring → 25%', async () => {
    const db = {
        GP: { sire: null, dam: null },
        U:  { sire: null, dam: null },
        O1: { sire: 'GP', dam: 'U' },
        // X = offspring of GP × O1
        X:  { sire: 'GP', dam: 'O1' }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectCOI(result, 25, 'Parent×offspring');
});

// 3. Full siblings mated → 25%
// S and D are unrelated. A and B are full siblings (parents S, D).
// X = offspring of A × B.
test('Full sibling mating → 25%', async () => {
    const db = {
        S:  { sire: null, dam: null },
        D:  { sire: null, dam: null },
        A:  { sire: 'S',  dam: 'D'  },
        B:  { sire: 'S',  dam: 'D'  },
        X:  { sire: 'A',  dam: 'B'  }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectCOI(result, 25, 'Full siblings');
});

// 4. Half siblings mated → 12.5%
// S is shared. A's dam = D1, B's dam = D2 (unrelated).
// X = offspring of A × B.
test('Half sibling mating → 12.5%', async () => {
    const db = {
        S:  { sire: null, dam: null },
        D1: { sire: null, dam: null },
        D2: { sire: null, dam: null },
        A:  { sire: 'S',  dam: 'D1' },
        B:  { sire: 'S',  dam: 'D2' },
        X:  { sire: 'A',  dam: 'B'  }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectCOI(result, 12.5, 'Half siblings');
});

// 5. Grandparent × grandoffspring → 12.5%
// GP → O1 → O2; mating GP (sire) × O2 (dam).
// Common ancestor GP: n1=0 links from GP(sire), n2=2 links from O2.
// F = (½)^(0+2+1) = 1/8 = 12.5%
test('Grandparent × grandoffspring → 12.5%', async () => {
    const db = {
        GP: { sire: null, dam: null },
        U1: { sire: null, dam: null },
        U2: { sire: null, dam: null },
        O1: { sire: 'GP', dam: 'U1' },
        O2: { sire: 'O1', dam: 'U2' },
        X:  { sire: 'GP', dam: 'O2' }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectCOI(result, 12.5, 'Grandparent×grandoffspring');
});

// 6. First cousins → 6.25%
// GP_S and GP_D → Uncle (sire=GP_S, dam=GP_D) and Aunt (sire=GP_S, dam=GP_D)
// C1's sire = Uncle, C2's sire = Aunt; C1 and C2 mate.
// Two common ancestors (GP_S, GP_D), each contributes (½)^5 = 1/32.
// Total = 2/32 = 6.25%
test('First cousins → 6.25%', async () => {
    const db = {
        GP_S:  { sire: null, dam: null },
        GP_D:  { sire: null, dam: null },
        Uncle: { sire: 'GP_S', dam: 'GP_D' },
        Aunt:  { sire: 'GP_S', dam: 'GP_D' },
        U1:    { sire: null, dam: null },
        U2:    { sire: null, dam: null },
        C1:    { sire: 'Uncle', dam: 'U1' },
        C2:    { sire: 'Aunt',  dam: 'U2' },
        X:     { sire: 'C1',   dam: 'C2'  }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    expectCOI(result, 6.25, 'First cousins');
});

// 7. calculatePairingInbreeding (theoretical offspring) → full siblings test
test('calculatePairingInbreeding: full siblings → 25%', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        A: { sire: 'S', dam: 'D' },
        B: { sire: 'S', dam: 'D' }
    };
    const result = await calculatePairingInbreeding('A', 'B', makeFetchAnimal(db), 50);
    expectCOI(result, 25, 'Pairing full siblings');
});

// 8. calculatePairingInbreeding: unrelated → 0%
test('calculatePairingInbreeding: unrelated → 0%', async () => {
    const db = {
        A: { sire: null, dam: null },
        B: { sire: null, dam: null }
    };
    const result = await calculatePairingInbreeding('A', 'B', makeFetchAnimal(db), 50);
    expectCOI(result, 0, 'Pairing unrelated');
});

// 9. Compound ancestry: both parents are full siblings of EACH OTHER
// (same as #3 — they share both grandparents, two separate contributions)
test('Compound ancestry: two shared grandparents each contribute independently', async () => {
    const db = {
        GS: { sire: null, dam: null },
        GD: { sire: null, dam: null },
        P1: { sire: 'GS', dam: 'GD' },
        P2: { sire: 'GS', dam: 'GD' },
        X:  { sire: 'P1', dam: 'P2' }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db));
    // GS contributes (½)^3 = 12.5%, GD contributes 12.5%, total = 25%
    expectCOI(result, 25, 'Compound two shared grandparents');
});

// 10. Depth truncation reduces COI
// If we truncate at 2 generations, cousins (who share grandparents at gen 3)
// should return 0% because the common ancestors are beyond the cutoff.
test('Depth truncation: first cousins at depth=2 → 0%', async () => {
    const db = {
        GP_S:  { sire: null, dam: null },
        GP_D:  { sire: null, dam: null },
        Uncle: { sire: 'GP_S', dam: 'GP_D' },
        Aunt:  { sire: 'GP_S', dam: 'GP_D' },
        U1:    { sire: null, dam: null },
        U2:    { sire: null, dam: null },
        C1:    { sire: 'Uncle', dam: 'U1' },
        C2:    { sire: 'Aunt',  dam: 'U2' },
        X:     { sire: 'C1',   dam: 'C2'  }
    };
    // depth=2: only sees X→C1,C2→Uncle,Aunt. Grandparents (common ancestors) not reached.
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db), 2);
    expectCOI(result, 0, 'Depth truncation cousins');
});

// 11. Depth truncation: full siblings at depth=1 → 0%
// (parents are seen but their parents/shared ancestors are not)
test('Depth truncation: full siblings at depth=1 → 0%', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        A: { sire: 'S', dam: 'D' },
        B: { sire: 'S', dam: 'D' },
        X: { sire: 'A', dam: 'B' }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db), 1);
    expectCOI(result, 0, 'Depth 1 full siblings');
});

// 12. Full siblings need depth=3 to resolve shared grandparents
// buildPedigree depth=2: X→A,B (depth 1), A→S,D and B→S,D (depth 2), but
// S and D resolve at depth=2 as leaf nodes. Common ancestors ARE visible → 25%.
// With depth=1: A and B have no parents visible → 0% (separate test above).
test('Depth truncation: full siblings at depth=3 → 25%', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        A: { sire: 'S', dam: 'D' },
        B: { sire: 'S', dam: 'D' },
        X: { sire: 'A', dam: 'B' }
    };
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db), 3);
    expectCOI(result, 25, 'Depth 3 full siblings');
});

// 12b. Confirm depth=2 does truncate full siblings (grandparents just out of reach)
test('Depth truncation: full siblings at depth=2 → 0% (truncated)', async () => {
    const db = {
        S: { sire: null, dam: null },
        D: { sire: null, dam: null },
        A: { sire: 'S', dam: 'D' },
        B: { sire: 'S', dam: 'D' },
        X: { sire: 'A', dam: 'B' }
    };
    // depth=2 reaches A and B but their parents are not expanded
    const result = await calculateInbreedingCoefficient('X', makeFetchAnimal(db), 2);
    expectCOI(result, 0, 'Depth 2 full siblings truncated');
});

// 13. Non-existent animal → 0%
test('Non-existent animal → 0%', async () => {
    const db = {};
    const result = await calculateInbreedingCoefficient('GHOST', makeFetchAnimal(db));
    expectCOI(result, 0, 'Non-existent animal');
});

// 14. Animal with no parents → 0%
test('Animal with no parents → 0%', async () => {
    const db = { A: { sire: null, dam: null } };
    const result = await calculateInbreedingCoefficient('A', makeFetchAnimal(db));
    expectCOI(result, 0, 'No parents');
});

// 15. Pedigree loop guard: animal appears in multiple positions (via both parents)
// Selfing = mating an animal with itself: sire=B, dam=B.
// Wright: n1=0 (B is the sire/common ancestor, 0 links), n2=0 → F = (½)^(0+0+1) = 50%.
// Code path.length=1 for each side → exponent = 1+1-1 = 1 → (½)^1 = 50% ✓
test('Pedigree loop: same animal on both sides → 50% (selfing)', async () => {
    const db = {
        B: { sire: null, dam: null },
        A: { sire: 'B', dam: 'B' }
    };
    const result = await calculateInbreedingCoefficient('A', makeFetchAnimal(db));
    expectCOI(result, 50, 'Selfing/loop guard');
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
(async () => {
    // Run all tests sequentially (they are already registered above but only
    // execute when the event loop processes the promise chain)
    await new Promise(r => setTimeout(r, 100));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed);

    console.log('\n==============================');
    console.log(' COI Unit Test Results');
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
