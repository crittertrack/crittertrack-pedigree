const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.dandelion, name: 'Dandelion', gender: 'Female', born: '2026-09-12', stage: 'Juvenile', wt: '165', len: '16', sire: ids.chestnut, dam: ids.willow, tag: 'SHOW-SF-102', status: 'Available', tags: ['for-sale', 'juvenile', 'summer-litter'], notes: 'Summer litter pup. Gentle, loves shoulder rides.' }),
    repro({ role: null, mated: null, succ: null, preg: null, kids: null, fert: 'Too young', vax: [HR({ id: 'vx-da-1', name: 'First wellness check', date: '2026-10-05', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Pre-sale check, healthy' } })], dew: [HR({ id: 'dw-da-1', name: 'Routine deworm', date: '2026-10-05', status: 'completed', x: { medication: 'Fenbendazole', dosage: 'Single dose' } })], par: [HR({ id: 'pc-da-1', name: 'Mite check', date: '2026-10-05', status: 'completed', x: { procedure: 'Skin scrape', result: 'Negative' } })], cond: [], alg: [], med: [], proc: [], lab: [], vet: [HR({ id: 'vv-da-1', name: 'Pre-sale check', date: '2026-10-05', x: { vetName: 'Dr. Alvarez', reason: 'Cleared for sale' } })], parSched: [{ treatment: 'Mite prevention check', startDate: '2026-10-05', interval: 3, intervalUnit: 'months' }], clear: [], sale: true, price: 35 }),
    care({ pub: true, enc: refs.encSale, dietR: null, temp: 'Sweet and mellow', growth: [
      { id: 'gr-da-1', date: '2026-09-12', weight: '7', length: '5', height: '', chestGirth: '', bcs: '', notes: 'Birth weight' },
      { id: 'gr-da-2', date: '2026-10-10', weight: '165', length: '16', height: '', chestGirth: '10', bcs: '3/5', notes: 'Weaned' },
    ], tnotes: [], shows: [] })
  );
}
module.exports = { build };
