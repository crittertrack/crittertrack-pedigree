const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.birch, name: 'Birch', gender: 'Female', born: '2023-05-15', died: '2026-07-20', stage: 'Adult', wt: '320', len: '21', tag: 'SHOW-RF-000', reg: 'NARR-2023-005', status: 'Deceased', tags: ['foundation', 'retired'], notes: 'Retired foundation dam. Produced 3 beautiful litters before peaceful retirement.' }),
    repro({ role: 'dam', mated: '2025-11-10', succ: 3, preg: '2025-11-10', kids: 21, litters: '3', bornN: 7, weanedN: 7, stillN: 0, heat: 'Retired', heatDate: null, fert: 'Retired', fertN: 'Retired from breeding 2026-01', reproC: null, recs: [
      { id: 'br-bi-1', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2025-11-10T12:00:00Z'), mate: 'Chestnut', mateAnimalId: ids.chestnut, outcome: 'Successful', notes: 'Final litter before retirement', birthEventDate: new Date('2025-12-02T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 7, litterSizeWeaned: 7, stillbornCount: 0, lossesCount: 0, litterId: refs.litE },
    ], vax: [HR({ id: 'vx-bi-1', name: 'Senior wellness', date: '2026-06-20', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Senior check, slowing down but comfortable' } })], dew: [], par: [], cond: [HR({ id: 'cd-bi-1', name: 'Hind leg weakness', date: '2026-07-01', status: 'resolved', severity: 'moderate', x: { condition: 'Age-related hind leg degeneration', notes: 'Kept comfortable, passed peacefully 2026-07-20' } })], alg: [], med: [], proc: [], lab: [], vet: [HR({ id: 'vv-bi-1', name: 'Senior comfort visit', date: '2026-07-15', x: { vetName: 'Dr. Alvarez', reason: 'Palliative comfort check' } })], parSched: [], dent: 'Worn but functional', chron: 'Hind leg degeneration (age-related)', clear: [], sale: false }),
    care({ pub: false, enc: null, dietR: null, special: null, temp: 'Gentle old soul', cod: 'Old age, passed peacefully in sleep', eol: 'Kept comfortable with soft bedding and favorite foods in final weeks', growth: [
      { id: 'gr-bi-1', date: '2026-06-20', weight: '320', length: '21', height: '', chestGirth: '13', bcs: '3/5', notes: 'Senior baseline' },
    ], tnotes: [{ id: 'tn-bi-1', eventId: 'passing', noteText: 'Passed peacefully overnight, buried under the apple tree', dateAdded: '2026-07-20' }], shows: [{ date: new Date('2024-06-15T12:00:00Z'), showName: 'Summer Small Pets Show', titleEarned: 'Best Veteran Doe', judgeName: 'R. Patel', score: '1st Place', judgeComments: 'Wonderful condition for her age' }], showT: 'Best Veteran Doe 2024' })
  );
}
module.exports = { build };
