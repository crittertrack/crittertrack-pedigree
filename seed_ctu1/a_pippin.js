const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.pippin, name: 'Pippin', gender: 'Male', born: '2026-10-10', stage: 'Newborn', wt: '12', len: '6', sire: ids.chestnut, dam: ids.willow, tag: 'SHOW-NM-201', status: 'Growout', tags: ['newborn', 'nursing', 'autumn-litter'], notes: 'Autumn litter pup, 6 days old. Nursing strongly, eyes still closed.' }),
    repro({ role: null, mated: null, succ: null, preg: null, kids: null, fert: 'Too young', vax: [], dew: [], par: [], cond: [], alg: [], med: [], proc: [], lab: [], vet: [], parSched: [], clear: [], sale: false }),
    care({ pub: false, enc: refs.encNursery, dietR: null, special: 'Nursing - dam fed, no handling yet except health checks', temp: 'Too young to assess', milestones: [{ label: 'Eyes open', startDate: new Date('2026-10-24T12:00:00Z'), interval: null, intervalUnit: null }, { label: 'Weaning expected', startDate: new Date('2026-11-14T12:00:00Z'), interval: null, intervalUnit: null }], growth: [
      { id: 'gr-pi-1', date: '2026-10-10', weight: '7', length: '5', height: '', chestGirth: '', bcs: '', notes: 'Birth' },
      { id: 'gr-pi-2', date: '2026-10-14', weight: '12', length: '6', height: '', chestGirth: '', bcs: '', notes: 'Gaining well' },
    ], tnotes: [], shows: [] })
  );
}
module.exports = { build };
