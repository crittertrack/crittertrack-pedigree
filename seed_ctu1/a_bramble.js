const { core } = require('./base_core');
const { HR, repro } = require('./base_repro');
const { care } = require('./base_care');
function build(userId, ids, refs) {
  return Object.assign(
    core({ userId, idp: ids.bramble, fed: '2026-10-09', name: 'Bramble', gender: 'Male', born: '2025-04-02', stage: 'Adult', wt: '490', len: '23', tag: 'SHOW-RM-003', reg: 'NARR-2025-020', status: 'Pet', tags: ['treatment', 'showcase'], notes: 'Recovering from mild sniffles. Finished meds, one recheck left.' }),
    repro({ role: null, mated: null, succ: null, preg: null, kids: null, fert: 'Unknown', reproC: null, vax: [HR({ id: 'vx-br-1', name: 'Wellness exam', date: '2026-09-15', status: 'completed', x: { vetName: 'Dr. Alvarez', reason: 'Sniffles workup' } })], dew: [], par: [], cond: [HR({ id: 'cd-br-1', name: 'Mild URI', date: '2026-10-08', status: 'resolved', severity: 'mild', x: { condition: 'Upper respiratory sniffles', notes: 'Course finished Oct 15, recheck Oct 23' } })], alg: [], med: [HR({ id: 'md-br-1', name: 'Doxycycline', date: '2026-10-08', status: 'completed', x: { medication: 'Doxycycline', dosage: '5 mg/kg', frequency: 'Twice daily', dose: '5 mg/kg PO BID', startDate: new Date('2026-10-01T12:00:00Z'), stopDate: new Date('2026-10-15T12:00:00Z'), intervalValue: 12, intervalUnit: 'hours', administrations: [{ date: new Date('2026-10-15T08:00:00Z') }] } })], proc: [], lab: [], vet: [HR({ id: 'vv-br-1', name: 'URI recheck', date: '2026-10-08', x: { vetName: 'Dr. Alvarez', reason: 'Sneezing, prescribed doxycycline' } }), HR({ id: 'vv-br-2', name: 'Recheck', date: '2026-10-16', x: { vetName: 'Dr. Alvarez', reason: 'Much improved, one more recheck Oct 23' } })], parSched: [], dent: 'Incisors normal', chron: 'None', clear: [], sale: false }),
    care({ pub: false, enc: refs.encMed, dietR: null, temp: 'Calm, good patient', growth: [
      { id: 'gr-br-1', date: '2026-10-08', weight: '488', length: '23', height: '', chestGirth: '14', bcs: '3/5', notes: 'Treatment start' },
      { id: 'gr-br-2', date: '2026-10-14', weight: '490', length: '23', height: '', chestGirth: '14', bcs: '3/5', notes: 'Holding steady' },
    ], tnotes: [{ id: 'tn-br-1', eventId: 'treatment', noteText: 'Day 6: sneezing much less frequent', dateAdded: '2026-10-14' }], shows: [] })
  );
}
module.exports = { build };
