function contacts(userId) {
  return [
    { userId, linkedCTUID: null, personalName: 'Dr. Alvarez', breederName: 'Maple Street Vet Clinic',
      prefix: null, suffix: null,
      address: { street: '12 Maple Street', city: 'Portland', state: 'OR', postalCode: '97205', country: 'US' },
      isKeeper: false, isBreeder: false, breederStatus: 'active',
      notes: 'Exotics vet. Wellness, URI treatment, pregnancy confirms.', assign: [] },
    { userId, linkedCTUID: null, personalName: 'Maple Rattery', breederName: 'Maple Rattery',
      prefix: null, suffix: null,
      address: { street: '8 Cedar Ave', city: 'Portland', state: 'OR', postalCode: '97202', country: 'US' },
      isKeeper: false, isBreeder: true, breederStatus: 'active',
      notes: 'Source of Chestnut and Willow foundation lines.', assign: [] },
    { userId, linkedCTUID: null, personalName: 'Demo Adopter', breederName: null,
      prefix: null, suffix: null,
      address: { street: '5 Birch Road', city: 'Beaverton', state: 'OR', postalCode: '97005', country: 'US' },
      isKeeper: true, isBreeder: false, breederStatus: 'active',
      notes: 'Adopted a spring pup. Approved home check.', assign: [] },
  ];
}
module.exports = { contacts };
