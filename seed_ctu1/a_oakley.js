const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.oakley, quar: true, fed: '2026-10-13', name: 'Oakley', gender: 'Male', born: '2025-02-14', stage: 'Adult', wt: '470', len: '23', tag: 'SHOW-RM-002', reg: 'NARR-2025-008', status: 'Breeder', tags: ['breeder', 'quarantine', 'new-arrival'], notes: 'Young buck in 14-day new-arrival quarantine. Friendly so far, paired for winter breeding plan.' }),
    repro({ role: 'sire', mated: '2026-10-14', succ: 1, preg: '2026-10-14', kids: 0, stud: true, fee: 20, fert: 'Unproven', fertN: 'First pairing with Hazel, awaiting outcome', recs: [
      { id: 'br-oa-1', breedingMethod: 'Natural', breedingConditionAtTime: 'Good', matingDate: new Date('2026-10-14T12:00:00Z'), mate: 'Hazel', mateAnimalId: ids.hazel, outcome: 'Unknown', notes: 'First pairing, pregnancy confirmed in dam', birthEventDate: null, birthMethod: null, litterSizeBorn: null, litterSizeWeaned: null, stillbornCount: null, lossesCount: null, litterId: refs.litD },
    ], vax: [HR({ id: 'vx-oa-1', name: 'Intake exam', date: '2026-10-10', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'New arrival check, healthy' } })], dew: [HR({ id: 'dw-oa-1', name: 'Preventive deworm', date: '2026-10-10', status: 'completed', x: { medication: 'Fenbendazole', dosage: 'Single dose per protocol' } })], par: [], cond: [], alg: [], med: [], proc: [], lab: [], vet: [HR({ id: 'vv-oa-1', name: 'Intake exam', date: '2026-10-10', x: { vetName: 'Dr. Alvarez', reason: 'Quarantine intake' } })], parSched: [], clear: [], sale: false }),
    care({ pub: true, enc: refs.encQuar, dietR: null, temp: 'Curious, settling in well', fears: 'Startled by loud noises first two days', growth: [
      { id: 'gr-oa-1', date: '2026-10-10', weight: '465', length: '23', height: '', chestGirth: '14', bcs: '3/5', notes: 'Intake weight' },
      { id: 'gr-oa-2', date: '2026-10-14', weight: '470', length: '23', height: '', chestGirth: '14', bcs: '3/5', notes: 'Eating well' },
    ], tnotes: [{ id: 'tn-oa-1', eventId: 'quarantine', noteText: 'Day 4: eating well, active at dusk', dateAdded: '2026-10-14' }], shows: [], purchD: '2026-10-08', purchL: 'Cedar Creek Rattery, Seattle WA', purchP: 35, seller: 'Cedar Creek Rattery', sellerC: 'cedarcreek@example.com', breedRights: 'Full breeding rights' })
  );
}
module.exports = { build };
