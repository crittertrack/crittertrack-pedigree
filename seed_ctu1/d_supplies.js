function supplies(userId) {
  return [
    { userId, name: 'Oxbow Adult Rat Food 10lb', category: 'Food', currentStock: 6, unit: 'bags', reorderThreshold: 2, notes: 'Staple diet for the colony', isFeederAnimal: false, feederType: '', feederSize: '', costPerUnit: 18.99, nextOrderDate: new Date('2026-11-15T12:00:00Z'), orderFrequency: 2, orderFrequencyUnit: 'months' },
    { userId, name: 'Kiln-dried Aspen 4cuft', category: 'Bedding', currentStock: 1, unit: 'bags', reorderThreshold: 2, notes: 'Low stock - reorder this week for screenshots', isFeederAnimal: false, feederType: '', feederSize: '', costPerUnit: 12.5, nextOrderDate: new Date('2026-10-20T12:00:00Z'), orderFrequency: 1, orderFrequencyUnit: 'months' },
    { userId, name: 'Doxycycline 100mg', category: 'Medication', currentStock: 14, unit: 'doses', reorderThreshold: 4, notes: 'Bramble URI course, ends Oct 22', isFeederAnimal: false, feederType: '', feederSize: '', costPerUnit: 1.2, nextOrderDate: null, orderFrequency: null, orderFrequencyUnit: 'months' },
    { userId, name: 'Frozen peas 2lb', category: 'Food', currentStock: 3, unit: 'bags', reorderThreshold: 1, notes: 'Favorite enrichment treat', isFeederAnimal: false, feederType: '', feederSize: '', costPerUnit: 2.5, nextOrderDate: null, orderFrequency: null, orderFrequencyUnit: 'months' },
    { userId, name: 'Paper nesting strips', category: 'Other', currentStock: 8, unit: 'packs', reorderThreshold: 2, notes: 'Nursery use', isFeederAnimal: false, feederType: '', feederSize: '', costPerUnit: 4.0, nextOrderDate: null, orderFrequency: null, orderFrequencyUnit: 'months' },
  ];
}
module.exports = { supplies };
