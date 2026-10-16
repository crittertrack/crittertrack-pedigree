const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.poppy, name: 'Poppy', gender: 'Female', born: '2026-10-10', stage: 'Newborn', wt: '11', len: '6', sire: ids.chestnut, dam: ids.willow, tag: 'SHOW-NF-202', status: 'Growout', tags: ['newborn', 'nursing', 'autumn-litter'], notes: 'Autumn litter pup. Smallest of the litter but catching up fast.' }),
    repro({ role: null, mated: null, succ: null, preg: null, kids: null, fert: 'Too young', vax: [], dew: [], par: [], cond: [], alg: [], med: [], proc: [], lab: [], vet: [], parSched: [], clear: [], sale: false }),
    care({ pub: false, enc: refs.encNursery, dietR: null, special: 'Nursing - supplemental weigh-ins daily', temp: 'Too young to assess', milestones: [{ label: 'Eyes open', startDate: new Date('2026-10-24T12:00:00Z'), interval: null, intervalUnit: null }], growth: [
      { id: 'gr-po-1', date: '2026-10-10', weight: '6', length: '5', height: '', chestGirth: '', bcs: '', notes: 'Birth, smallest' },
      { id: 'gr-po-2', date: '2026-10-14', weight: '11', length: '6', height: '', chestGirth: '', bcs: '', notes: 'Catching up' },
    ], tnotes: [], shows: [] })
  );
}
module.exports = { build };
