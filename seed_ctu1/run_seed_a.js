const { littersA } = require('./b_litters_a');
const { littersB } = require('./b_litters_b');
const { locations, rooms } = require('./c_locations');
const { enclosures } = require('./c_enclosures');
const { supplies } = require('./d_supplies');
const { transactions } = require('./d_budget');
const { contacts } = require('./d_contacts');
const { collections, generalTasks, breederInfo } = require('./e_extras');
const { computeIsInTreatment, computeHealthStatus } = require('../utils/healthStatusSync');
const { resyncAnimalToPublic } = require('../utils/syncPublicAnimals');
const builders = {
  chestnut: require('./a_chestnut'), willow: require('./a_willow'), hazel: require('./a_hazel'),
  oakley: require('./a_oakley'), juniper: require('./a_juniper'), bramble: require('./a_bramble'),
  cinder: require('./a_cinder'), dandelion: require('./a_dandelion'), pippin: require('./a_pippin'),
  poppy: require('./a_poppy'), birch: require('./a_birch'),
};
const NAMES = ['chestnut', 'willow', 'hazel', 'oakley', 'juniper', 'bramble', 'cinder', 'dandelion', 'pippin', 'poppy', 'birch'];
async function nextIds(M, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = await M.Counter.findByIdAndUpdate({ _id: 'animalId' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    out.push('CTC' + c.seq);
  }
  return out;
}
async function nextLits(M, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = await M.Counter.findByIdAndUpdate({ _id: 'litterId' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    out.push('CTL' + c.seq);
  }
  return out;
}
module.exports = { builders, NAMES, nextIds, nextLits, littersA, littersB, locations, rooms, enclosures, supplies, transactions, contacts, collections, generalTasks, breederInfo, computeIsInTreatment, computeHealthStatus, resyncAnimalToPublic };
