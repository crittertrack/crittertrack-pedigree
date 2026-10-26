#!/usr/bin/env node
/**
 * Test harness for the lifeStage backfill migration logic.
 * Verifies the calculateLifeStageFromBirthDate function works correctly
 * without needing a database connection.
 */

const assert = require('node:assert/strict');

// Import directly
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');

function makeBirthDate(daysAgo) {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function testSpecies(name, species, ageDays, expectedStage) {
    const birthDate = makeBirthDate(ageDays);
    const result = calculateLifeStageFromBirthDate(birthDate, species);
    assert.equal(result, expectedStage, `${name}: ${ageDays}d -> ${result}, expected ${expectedStage}`);
    console.log(`  ✓ ${name}: ${ageDays}d -> ${result}`);
}

async function main() {
    console.log('Testing lifeStage calculation logic...\n');

    // Fancy Mouse
    console.log('Fancy Mouse (2yr lifespan, senior at 548d):');
    testSpecies('  Newborn', 'Fancy Mouse', 0, 'Newborn');
    testSpecies('  Juvenile', 'Fancy Mouse', 30, 'Juvenile');
    testSpecies('  Sub-adult', 'Fancy Mouse', 60, 'Sub-adult');
    testSpecies('  Adult', 'Fancy Mouse', 300, 'Adult');
    testSpecies('  Senior', 'Fancy Mouse', 600, 'Senior');

    // Rat
    console.log('\nRat (3yr lifespan, senior at 700d):');
    testSpecies('  Newborn', 'Rat', 0, 'Newborn');
    testSpecies('  Juvenile', 'Rat', 30, 'Juvenile');
    testSpecies('  Sub-adult', 'Rat', 100, 'Sub-adult');
    testSpecies('  Adult', 'Rat', 400, 'Adult');
    testSpecies('  Senior', 'Rat', 900, 'Senior');

    // Hamster
    console.log('\nHamster (2yr lifespan, senior at 600d):');
    testSpecies('  Newborn', 'Hamster', 0, 'Newborn');
    testSpecies('  Sub-adult', 'Hamster', 100, 'Sub-adult');
    testSpecies('  Adult', 'Hamster', 300, 'Adult');
    testSpecies('  Senior', 'Hamster', 650, 'Senior');

    // Guinea Pig
    console.log('\nGuinea Pig (6yr lifespan, senior at 1400d):');
    testSpecies('  Newborn', 'Guinea Pig', 0, 'Newborn');
    testSpecies('  Juvenile', 'Guinea Pig', 30, 'Juvenile');
    testSpecies('  Sub-adult', 'Guinea Pig', 100, 'Sub-adult');
    testSpecies('  Adult', 'Guinea Pig', 800, 'Adult');
    testSpecies('  Senior', 'Guinea Pig', 1700, 'Senior');

    // Unknown species fallback
    console.log('\nUnknown species (fallback 2yr = 730d, senior at 548d):');
    testSpecies('  Newborn', 'Unknown Species', 0, 'Newborn');
    testSpecies('  Adult', 'Unknown Species', 300, 'Adult');
    testSpecies('  Senior', 'Unknown Species', 600, 'Senior');

    // Invalid dates
    console.log('\nInvalid dates return Unknown:');
    assert.equal(calculateLifeStageFromBirthDate(null), 'Unknown');
    assert.equal(calculateLifeStageFromBirthDate(undefined), 'Unknown');
    assert.equal(calculateLifeStageFromBirthDate(''), 'Unknown');
    assert.equal(calculateLifeStageFromBirthDate('not-a-date'), 'Unknown');
    console.log('  ✓ All invalid dates return Unknown');

    console.log('\n✅ All tests passed!');
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
