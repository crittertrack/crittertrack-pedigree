function collections(ids) {
  return {
    collections: [
      { id: 'col_showcase_breeders', name: 'Breeding Group', color: '#8b5cf6', icon: 'heart' },
      { id: 'col_showcase_sale', name: 'Available Now', color: '#22c55e', icon: 'tag' },
      { id: 'col_showcase_nursery', name: 'Nursery', color: '#f59e0b', icon: 'baby' },
    ],
    animalMap: Object.assign(
      { [ids.chestnut]: ['col_showcase_breeders'], [ids.willow]: ['col_showcase_breeders'],
        [ids.hazel]: ['col_showcase_breeders'], [ids.oakley]: ['col_showcase_breeders'],
        [ids.juniper]: ['col_showcase_breeders', 'col_showcase_sale'],
        [ids.cinder]: ['col_showcase_sale'], [ids.dandelion]: ['col_showcase_sale'],
        [ids.pippin]: ['col_showcase_nursery'], [ids.poppy]: ['col_showcase_nursery'],
        [ids.bramble]: [], [ids.birch]: [] },
    ),
  };
}
function generalTasks(ids) {
  return [
    { id: 'gt-1', taskName: 'Feed the rat colony', type: 'Feeding', notes: 'Evening feed for all tubs', lastDoneDate: new Date('2026-10-16T08:00:00Z'), frequency: 1, frequencyUnit: 'days', lastSkipped: false, assignedAnimals: [ids.chestnut, ids.willow, ids.hazel] },
    { id: 'gt-2', taskName: 'Nursery spot clean', type: 'Cleaning', notes: 'Willow and pups, gentle tidy', lastDoneDate: new Date('2026-10-15T12:00:00Z'), frequency: 2, frequencyUnit: 'days', lastSkipped: false, assignedAnimals: [ids.willow] },
    { id: 'gt-3', taskName: 'Order aspen bedding', type: 'Other', notes: 'Stock is low, order this week', lastDoneDate: new Date('2026-09-20T12:00:00Z'), frequency: 30, frequencyUnit: 'days', lastSkipped: false, assignedAnimals: [] },
  ];
}
function breederInfo() {
  return {
    aboutProgram: 'Small family rattery raising friendly, well-socialized Dumbo rats in Portland, Oregon.',
    adoptionRules: 'Indoor homes only. Pairs or groups preferred, single kits to homes with existing rats.',
    careRequirements: '', enclosureCare: 'Spacious cage, aspen or paper bedding, weekly full clean.',
    routineCare: 'Daily handling, fresh veg, free-range time, weekly weigh-ins.',
    healthGuarantee: '2 week health guarantee, lifetime take-back, vet checked before leaving.',
    waitlistInfo: 'Waitlist open for the winter pairing. Message to reserve.',
    pricingNotes: 'Pet kits $35, breeders $45-60. Deposit $10 to reserve.',
    contactPreferences: 'Message here, replies within a day.',
    customFields: [{ title: 'Visiting hours', value: 'Weekends by appointment' }],
  };
}
module.exports = { collections, generalTasks, breederInfo };
