const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.hazel, name: 'Hazel', gender: 'Female', born: '2024-09-05', stage: 'Adult', wt: '330', len: '21', tag: 'SHOW-RF-002', reg: 'NARR-2024-030', status: 'Breeder', tags: ['breeder', 'pregnant'], notes: 'Second dam. Confirmed pregnant, due early November.', role: 'beta' }),
    repro({ role: 'dam', mated: '2026-10-14', succ: 2, preg: '2026-10-14', kids: 12, due: '2026-11-05', litters: '2', bornN: 6, weanedN: 6, stillN: 0, heat: 'Pregnant', heatDate: null, fert: 'Proven', fertN: 'Easy pregnancies, natural deliveries', deliv: 'Natural', reproOk: 'Clear, vet checked 2026-10-01', recs: [
      { id: 'br-ha-1', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-10-14T12:00:00Z'), mate: 'Oakley', mateAnimalId: ids.oakley, outcome: 'Unknown', notes: 'Pregnancy confirmed by weight gain and nesting', birthEventDate: null, birthMethod: null, litterSizeBorn: null, litterSizeWeaned: null, stillbornCount: null, lossesCount: null, litterId: refs.litD },
      { id: 'br-ha-2', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-04-02T12:00:00Z'), mate: 'Chestnut', mateAnimalId: ids.chestnut, outcome: 'Successful', notes: 'Spring litter of 6', birthEventDate: new Date('2026-04-24T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 6, litterSizeWeaned: 6, stillbornCount: 0, lossesCount: 0, litterId: refs.litG },
    ], vax: [HR({ id: 'vx-ha-1', name: 'Annual wellness exam', date: '2026-07-10', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Annual checkup' } })], dew: [], par: [], cond: [], alg: [], med: [], proc: [], lab: [HR({ id: 'lb-ha-1', name: 'Pregnancy check', date: '2026-10-01', x: { testName: 'Palpation + weight trend', result: 'Pregnant, due early November' } })], vet: [HR({ id: 'vv-ha-1', name: 'Pregnancy confirm', date: '2026-10-01', x: { vetName: 'Dr. Alvarez', reason: 'Confirmed pregnant' } })], parSched: [], clear: [], sale: false }),
    care({ pub: true, enc: refs.encNursery, dietR: null, special: 'Pregnant - extra protein from day 14', temp: 'Sweet, starting to nest', growth: [
      { id: 'gr-ha-1', date: '2025-01-05', weight: '280', length: '20', height: '', chestGirth: '12', bcs: '3/5', notes: 'Adult baseline' },
      { id: 'gr-ha-2', date: '2026-10-10', weight: '330', length: '21', height: '', chestGirth: '13', bcs: '3/5', notes: 'Mid-pregnancy gain' },
    ], tnotes: [], shows: [] })
  );
}
module.exports = { build };
