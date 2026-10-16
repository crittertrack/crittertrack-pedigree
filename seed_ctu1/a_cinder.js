const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.cinder, name: 'Cinder', gender: 'Male', born: '2026-09-12', stage: 'Juvenile', wt: '180', len: '17', sire: ids.chestnut, dam: ids.willow, tag: 'SHOW-SM-101', status: 'Available', tags: ['for-sale', 'juvenile', 'summer-litter'], notes: 'Summer litter pup, weaned and thriving. Confident, first to the food bowl.' }),
    repro({ role: null, mated: null, succ: null, preg: null, kids: null, fert: 'Too young', vax: [HR({ id: 'vx-ci-1', name: 'First wellness check', date: '2026-10-05', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Pre-sale check, healthy' } })], dew: [], par: [], cond: [], alg: [HR({ id: 'al-ci-1', name: 'Bedding sensitivity', date: '2026-10-01', status: 'active', severity: 'mild', x: { allergen: 'Pine shavings', reaction: 'Mild sneezing, resolved on aspen' } })], med: [], proc: [], lab: [], vet: [HR({ id: 'vv-ci-1', name: 'Pre-sale check', date: '2026-10-05', x: { vetName: 'Dr. Alvarez', reason: 'Cleared for sale' } })], parSched: [], clear: [], sale: true, price: 35 }),
    care({ pub: true, enc: refs.encSale, dietR: 'No pine bedding - aspen only', temp: 'Bold and curious', growth: [
      { id: 'gr-ci-1', date: '2026-09-12', weight: '8', length: '5', height: '', chestGirth: '', bcs: '', notes: 'Birth weight' },
      { id: 'gr-ci-2', date: '2026-09-26', weight: '65', length: '11', height: '', chestGirth: '', bcs: '', notes: 'Two weeks' },
      { id: 'gr-ci-3', date: '2026-10-10', weight: '180', length: '17', height: '', chestGirth: '10', bcs: '3/5', notes: 'Weaned, eating solids' },
    ], tnotes: [], shows: [] })
  );
}
module.exports = { build };
