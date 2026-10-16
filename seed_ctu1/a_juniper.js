const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.juniper, name: 'Juniper', gender: 'Female', born: '2025-01-20', stage: 'Adult', wt: '310', len: '20', tag: 'SHOW-RF-003', reg: 'NARR-2025-011', status: 'Available', tags: ['for-sale', 'planned-mating'], notes: 'Planned winter pairing with Chestnut. Health-tested, ready for first litter.' }),
    repro({ role: 'dam', mated: null, succ: 0, preg: null, kids: 0, heat: 'Cycling normally', heatDate: '2026-10-12', fert: 'Untested', fertN: 'Young doe, first breeding planned', reproOk: 'Clear, vet checked 2026-09-20', recs: [
      { id: 'br-ju-1', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: null, mate: 'Chestnut (planned)', mateAnimalId: ids.chestnut, outcome: 'Unknown', notes: 'Planned winter pairing, not yet mated', birthEventDate: null, birthMethod: null, litterSizeBorn: null, litterSizeWeaned: null, stillbornCount: null, lossesCount: null, litterId: refs.litF },
    ], vax: [HR({ id: 'vx-ju-1', name: 'Annual wellness exam', date: '2026-08-01', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Pre-breeding check' } })], dew: [], par: [], cond: [], alg: [], med: [], proc: [], lab: [], vet: [HR({ id: 'vv-ju-1', name: 'Pre-breeding exam', date: '2026-09-20', x: { vetName: 'Dr. Alvarez', reason: 'Cleared for first breeding' } })], parSched: [], clear: [], sale: true, price: 45 }),
    care({ pub: true, enc: refs.encMain, dietR: null, temp: 'Playful and bold', growth: [
      { id: 'gr-ju-1', date: '2025-06-20', weight: '260', length: '19', height: '', chestGirth: '12', bcs: '3/5', notes: 'Juvenile' },
      { id: 'gr-ju-2', date: '2026-10-01', weight: '310', length: '20', height: '', chestGirth: '13', bcs: '3/5', notes: 'Breeding condition' },
    ], tnotes: [], shows: [{ date: new Date('2026-09-12T12:00:00Z'), showName: 'Fall Small Pets Show', titleEarned: 'Reserve Best Doe', judgeName: 'A. Chen', score: '2nd Place', judgeComments: 'Lovely type, slightly shy on table' }] })
  );
}
module.exports = { build };
