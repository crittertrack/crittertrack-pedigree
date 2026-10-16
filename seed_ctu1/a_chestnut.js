const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.chestnut, name: 'Chestnut', gender: 'Male', born: '2024-03-10', stage: 'Adult', wt: '520', len: '24', tag: 'SHOW-RM-001', reg: 'NARR-2024-001', status: 'Breeder', tags: ['breeder', 'dumbo', 'showcase'], notes: 'Foundation sire. Calm, proven breeder with excellent temperament.', role: 'alpha' }),
    repro({ role: 'sire', mated: '2026-09-18', succ: 4, preg: '2026-09-18', kids: 22, stud: true, fee: 25, fert: 'Proven', fertN: 'Sired 4 litters, 22 healthy pups', recs: [
      { id: 'br-ch-1', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-09-18T12:00:00Z'), mate: 'Willow', mateAnimalId: ids.willow, outcome: 'Successful', notes: 'Autumn pairing, 9 pups born', birthEventDate: new Date('2026-10-10T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 9, litterSizeWeaned: 0, stillbornCount: 0, lossesCount: 0, litterId: refs.litA },
      { id: 'br-ch-2', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-08-20T12:00:00Z'), mate: 'Willow', mateAnimalId: ids.willow, outcome: 'Successful', notes: 'Summer pairing, 7 pups', birthEventDate: new Date('2026-09-12T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 7, litterSizeWeaned: 7, stillbornCount: 0, lossesCount: 0, litterId: refs.litB },
      { id: 'br-ch-3', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-04-02T12:00:00Z'), mate: 'Hazel', mateAnimalId: ids.hazel, outcome: 'Successful', notes: 'Spring pairing with Hazel', birthEventDate: new Date('2026-04-24T12:00:00Z'), birthMethod: 'Natural', litterSizeBorn: 6, litterSizeWeaned: 6, stillbornCount: 0, lossesCount: 0, litterId: refs.litG },
    ], vax: [HR({ id: 'vx-ch-1', name: 'Annual wellness exam', date: '2026-06-01', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Annual checkup, all clear' } })], dew: [], par: [], cond: [], alg: [], med: [], proc: [], lab: [HR({ id: 'lb-ch-1', name: 'Genetic panel', date: '2025-01-15', x: { testName: 'Coat genetics panel', result: 'Normal, no recessives of concern' } })], vet: [HR({ id: 'vv-ch-1', name: 'Wellness visit', date: '2026-06-01', x: { vetName: 'Dr. Alvarez', reason: 'Annual checkup' } })], parSched: [], clear: [{ clearanceType: 'Temperament assessment', result: 'Pass', dateIssued: '2026-05-01', certificateId: 'TEMP-001', notes: 'Excellent with handling' }], sale: true, price: 60 }),
    care({ pub: true, enc: refs.encMain, dietR: null, temp: 'Confident and calm', growth: [
      { id: 'gr-ch-1', date: '2024-06-10', weight: '300', length: '19', height: '', chestGirth: '12', bcs: '3/5', notes: 'Juvenile weigh-in' },
      { id: 'gr-ch-2', date: '2025-01-10', weight: '480', length: '23', height: '', chestGirth: '14', bcs: '3/5', notes: 'Adult weight steady' },
      { id: 'gr-ch-3', date: '2026-10-01', weight: '520', length: '24', height: '', chestGirth: '15', bcs: '3/5', notes: 'Pre-breeding check' },
    ], tnotes: [{ id: 'tn-ch-1', eventId: 'birth', noteText: 'Born in spring litter of 8', dateAdded: '2024-03-10' }], shows: [{ date: new Date('2026-05-18T12:00:00Z'), showName: 'Spring Small Pets Show', titleEarned: 'Best Dumbo Buck', judgeName: 'J. Miller', score: '1st Place', judgeComments: 'Superb temperament and type' }], showT: 'Best Dumbo Buck 2026', purchD: '2024-05-01', purchL: 'Maple Rattery, Portland OR', purchP: 40, seller: 'Maple Rattery', breedRights: 'Full breeding rights included', studAllow: 'Available to approved does' })
  );
}
module.exports = { build };
