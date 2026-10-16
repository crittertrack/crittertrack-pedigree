const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.willow, name: 'Willow', gender: 'Female', born: '2024-06-22', stage: 'Adult', wt: '340', len: '21', tag: 'SHOW-RF-001', reg: 'NARR-2024-014', status: 'Breeder', tags: ['breeder', 'dumbo', 'nursing', 'showcase'], notes: 'Foundation dam. Attentive mother, currently nursing autumn litter.', role: 'alpha' }),
    repro({ role: 'dam', mated: '2026-09-18', succ: 3, preg: '2026-09-18', kids: 18, due: '2026-10-10', litters: '3', bornN: 9, weanedN: 0, stillN: 0, nurse: '2026-10-10', heat: 'Nursing - not cycling', heatDate: null, fert: 'Proven', fertN: 'Excellent maternal instincts', deliv: 'Natural', reproOk: 'Clear, vet checked 2026-09-01', recs: [
      { id: 'br-wi-1', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-09-18T12:00:00Z'), mate: 'Chestnut', mateAnimalId: ids.chestnut, outcome: 'Successful', notes: 'Autumn litter nursing now', birthEventDate: new Date('2026-10-10T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 9, litterSizeWeaned: 0, stillbornCount: 0, lossesCount: 0, litterId: refs.litA },
      { id: 'br-wi-2', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-08-20T12:00:00Z'), mate: 'Chestnut', mateAnimalId: ids.chestnut, outcome: 'Successful', notes: 'Summer litter weaned', birthEventDate: new Date('2026-09-12T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 7, litterSizeWeaned: 7, stillbornCount: 0, lossesCount: 0, litterId: refs.litB },
    ], vax: [HR({ id: 'vx-wi-1', name: 'Annual wellness exam', date: '2026-06-05', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Pre-breeding check, all clear' } })], dew: [], par: [], cond: [], alg: [], med: [], proc: [], lab: [], vet: [HR({ id: 'vv-wi-1', name: 'Pre-breeding exam', date: '2026-09-01', x: { vetName: 'Dr. Alvarez', reason: 'Cleared for autumn breeding' } })], parSched: [], clear: [], sale: false }),
    care({ pub: true, enc: refs.encNursery, dietR: null, special: 'Nursing dam - extra protein, unlimited food', specSched: '2026-10-10', specFreq: 1, temp: 'Gentle, protective of pups', behav: 'None', growth: [
      { id: 'gr-wi-1', date: '2024-09-22', weight: '220', length: '18', height: '', chestGirth: '11', bcs: '3/5', notes: 'Juvenile' },
      { id: 'gr-wi-2', date: '2026-10-01', weight: '335', length: '21', height: '', chestGirth: '13', bcs: '3/5', notes: 'Late pregnancy' },
      { id: 'gr-wi-3', date: '2026-10-14', weight: '340', length: '21', height: '', chestGirth: '13', bcs: '3/5', notes: 'Nursing well' },
    ], tnotes: [], shows: [], purchD: '2024-08-15', purchL: 'Maple Rattery, Portland OR', purchP: 40, seller: 'Maple Rattery', breedRights: 'Full breeding rights' })
  );
}
module.exports = { build };
