const { D } = require('./base_core');
function carePatches() {
  return [
    { name: 'Chestnut', animalCareTasks: [
      { id: 'ct-ch-1', taskName: 'Weekly weigh-in', notes: 'Track stud condition', lastDoneDate: D('2026-10-12'), frequencyDays: 7, lastSkipped: false },
      { id: 'ct-ch-2', taskName: 'Nail check', notes: 'Hind nails', lastDoneDate: D('2026-09-28'), frequencyDays: 30, lastSkipped: false } ] },
    { name: 'Willow', animalCareTasks: [
      { id: 'ct-wi-1', taskName: 'Nursing dam check', notes: 'Food, water, nest, pup count', lastDoneDate: D('2026-10-16'), frequencyDays: 1, lastSkipped: false } ] },
    { name: 'Bramble', animalCareTasks: [
      { id: 'ct-br-1', taskName: 'Give evening dose', notes: 'Doxycycline with pea puree', lastDoneDate: D('2026-10-16'), frequencyDays: 1, lastSkipped: false } ] },
    { name: 'Oakley', animalCareTasks: [
      { id: 'ct-oa-1', taskName: 'Quarantine observation', notes: 'Appetite, droppings, sneezes', lastDoneDate: D('2026-10-15'), frequencyDays: 1, lastSkipped: false } ] },
  ];
}
module.exports = { carePatches };
