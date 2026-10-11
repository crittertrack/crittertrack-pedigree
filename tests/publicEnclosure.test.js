const test = require('node:test');
const assert = require('node:assert/strict');
const { formatPublicEnclosure, formatPublicEnclosureSummary } = require('../utils/publicEnclosure');
const { buildPublicAnimalFields } = require('../utils/syncPublicAnimals');

test('mirrors current enclosure assignments to public animals', () => {
    assert.equal(buildPublicAnimalFields({ enclosureId: 'enclosure-123' }).enclosureId, 'enclosure-123');
    assert.equal(buildPublicAnimalFields({ enclosureId: null }).enclosureId, null);
});

test('formats public enclosure details and tasks without exposing private identifiers', () => {
    const result = formatPublicEnclosure({
        _id: 'private-enclosure-id',
        creatorId: 'private-user-id',
        name: 'Terrarium A',
        notes: 'Bioactive substrate',
        cleaningTasks: [{
            taskName: 'Replace water',
            type: 'Maintenance',
            assignedSupplies: [{ supplyId: 'private-supply-id', supplyName: 'Water conditioner', quantity: 1.5, unit: 'ml' }],
        }],
    }, [
        { type: 'building', name: 'Reptile Room' },
        { type: 'room', name: 'North Wall' },
    ]);

    assert.equal(result.name, 'Terrarium A');
    assert.equal(result.buildingName, 'Reptile Room');
    assert.equal(result.roomName, 'North Wall');
    assert.deepEqual(result.cleaningTasks[0].assignedSupplies, [{ supplyName: 'Water conditioner', quantity: 1.5, unit: 'ml' }]);
    assert.equal('creatorId' in result, false);
    assert.equal('buildingId' in result, false);
    assert.equal('supplyId' in result.cleaningTasks[0].assignedSupplies[0], false);
});

test('formats the default public enclosure card without exposing full details or tasks', () => {
    const result = formatPublicEnclosureSummary({
        name: 'Group 1 - Tricolor',
        enclosureType: 'Terrarium',
        purpose: 'general',
        dimensions: { length: 80, width: 50, height: 40, unit: 'cm' },
        tempMin: 22,
        tempMax: 26,
        temperatureUnit: 'C',
        bedding: "Kil'n Dried Pine Shavings",
        notes: 'Private notes',
        cleaningTasks: [{ taskName: 'Deep clean' }],
    });

    assert.equal(result.name, 'Group 1 - Tricolor');
    assert.equal(result.detailsShared, false);
    assert.deepEqual(result.dimensions, { length: 80, width: 50, height: 40, unit: 'cm' });
    assert.equal(result.bedding, "Kil'n Dried Pine Shavings");
    assert.equal('notes' in result, false);
    assert.equal('cleaningTasks' in result, false);
});
