function locations(userId) {
  return [
    { creatorId: userId, name: 'Showcase Rattery', type: 'building',
      address: { street: '42 Willow Lane', city: 'Portland', state: 'OR', postalCode: '97201', country: 'US' } },
  ];
}
function rooms(userId, buildingOid) {
  return [
    { creatorId: userId, name: 'Rat Room A', type: 'room', parentLocationId: buildingOid,
      address: { street: null, city: null, state: null, postalCode: null, country: null } },
    { creatorId: userId, name: 'Nursery Nook', type: 'room', parentLocationId: buildingOid,
      address: { street: null, city: null, state: null, postalCode: null, country: null } },
  ];
}
module.exports = { locations, rooms };
