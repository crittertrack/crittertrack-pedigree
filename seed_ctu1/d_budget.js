function transactions(userId, ids) {
  return [
    { userId, type: 'purchase', animalId: ids.chestnut, animalName: 'Chestnut', price: 40, date: new Date('2024-05-01T12:00:00Z'), buyer: null, seller: 'Maple Rattery', category: null, description: null, notes: 'Foundation sire purchase' },
    { userId, type: 'purchase', animalId: ids.willow, animalName: 'Willow', price: 40, date: new Date('2024-08-15T12:00:00Z'), buyer: null, seller: 'Maple Rattery', category: null, description: null, notes: 'Foundation dam purchase' },
    { userId, type: 'purchase', animalId: ids.oakley, animalName: 'Oakley', price: 35, date: new Date('2026-10-08T12:00:00Z'), buyer: null, seller: 'Cedar Creek Rattery', category: null, description: null, notes: 'Young buck, new bloodline' },
    { userId, type: 'expense', animalId: null, animalName: null, price: 85, date: new Date('2026-10-08T12:00:00Z'), buyer: null, seller: null, category: 'food', description: 'Oxbow food + aspen restock', notes: 'Monthly feed run' },
    { userId, type: 'expense', animalId: null, animalName: null, price: 46, date: new Date('2026-10-08T12:00:00Z'), buyer: null, seller: null, category: 'other', description: 'Vet: Oakley intake + Bramble URI exam', notes: 'Maple Street Vet Clinic' },
    { userId, type: 'sale', animalId: ids.cinder, animalName: 'Placeholder pup', price: 35, date: new Date('2026-09-28T12:00:00Z'), buyer: 'Demo Adopter', seller: null, category: null, description: null, notes: 'Spring pup placed (demo record)' },
    { userId, type: 'income', animalId: null, animalName: null, price: 25, date: new Date('2026-09-18T12:00:00Z'), buyer: null, seller: null, category: 'other', description: 'Stud fee: Chestnut autumn pairing', notes: 'Demo stud income' },
  ];
}
module.exports = { transactions };
