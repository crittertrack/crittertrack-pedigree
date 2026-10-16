const D = (s) => new Date(s + 'T12:00:00Z');
const SCHED = (done, freq) => ({ lastDoneDate: done ? D(done) : null, frequencyDays: freq ?? null, lastSkipped: false });

// Distinct placeholder images for the CTU1 demo animals (no local image assets are checked in).
// Keyed by animal name so every demo animal gets a unique look in the UI.
// Each entry overrides imageUrl/photoUrl in core() unless the animal passes its own imageUrl/photoUrl.
const ANIMAL_IMAGES = {
  Chestnut:  { imageUrl: 'https://placehold.co/400x400/8B4513/FFFFFF?text=Chestnut&font=arial', photoUrl: null },
  Willow:    { imageUrl: 'https://placehold.co/400x400/6B8E23/FFFFFF?text=Willow&font=arial', photoUrl: null },
  Hazel:     { imageUrl: 'https://placehold.co/400x400/D2691E/FFFFFF?text=Hazel&font=arial', photoUrl: null },
  Oakley:    { imageUrl: 'https://placehold.co/400x400/5D4037/FFFFFF?text=Oakley&font=arial', photoUrl: null },
  Juniper:   { imageUrl: 'https://placehold.co/400x400/2E8B57/FFFFFF?text=Juniper&font=arial', photoUrl: null },
  Bramble:   { imageUrl: 'https://placehold.co/400x400/8E24AA/FFFFFF?text=Bramble&font=arial', photoUrl: null },
  Cinder:    { imageUrl: 'https://placehold.co/400x400/757575/FFFFFF?text=Cinder&font=arial', photoUrl: null },
  Dandelion: { imageUrl: 'https://placehold.co/400x400/FBC02D/333333?text=Dandelion&font=arial', photoUrl: null },
  Pippin:    { imageUrl: 'https://placehold.co/400x400/C62828/FFFFFF?text=Pippin&font=arial', photoUrl: null },
  Poppy:     { imageUrl: 'https://placehold.co/400x400/EF6C00/FFFFFF?text=Poppy&font=arial', photoUrl: null },
  Birch:     { imageUrl: 'https://placehold.co/400x400/FFFDE7/5D4037?text=Birch&font=arial', photoUrl: null },
};

function core(o) {
  return {
    creatorId: o.userId, creatorId_public: 'CTU1', id_public: o.idp,
    originalCreatorId: null, soldStatus: null, viewOnlyForUsers: [], hiddenForUsers: [],
    species: 'Fancy Rat', prefix: o.prefix || null, suffix: null, name: o.name, gender: o.gender,
    birthDate: D(o.born), deceasedDate: o.died ? D(o.died) : null,
    breederAssignedId: o.tag || null, sbId: null, status: o.status || 'Pet',
    color: 'Agouti', coat: 'Standard', earset: 'Dumbo',
    breederId_public: 'CTU1', manualBreederName: null, ownerId_public: 'CTU1',
    isOwned: true, archived: false, isStub: false,
    isPlannedMating: false, isPregnant: false, isNursing: false, isInMating: false,
    isQuarantine: !!o.quar, isInTreatment: false, healthStatus: 'Healthy',
    healthStatusOverride: null, healthStatusOverrideNotes: null,
    quarantineDetails: o.quar ? { status: 'Active', type: 'Preventive - New Arrival', reason: 'New arrival intake observation', startDate: D('2026-10-10'), endDate: D('2026-10-24') } : { status: 'None', type: null, reason: null, startDate: null, endDate: null },
    treatmentDetails: { status: 'None', type: null, reason: null, startDate: null, endDate: null },
    quarantineHistory: [], treatmentHistory: [],
    lastFedDate: D(o.fed || '2026-10-16'), feedingIntervalHours: 24,
    animalCareTasks: [], milestones: [], tags: o.tags || [],
    imageUrl: o.imageUrl || (ANIMAL_IMAGES[o.name] && ANIMAL_IMAGES[o.name].imageUrl) || null,
    photoUrl: o.photoUrl || (ANIMAL_IMAGES[o.name] && ANIMAL_IMAGES[o.name].photoUrl) || null,
    extraImages: Array.isArray(o.extraImages) ? o.extraImages : [],
    sireId_public: o.sire || null, damId_public: o.dam || null, litterId: o.litterOid || null,
    remarks: o.notes || '', geneticCode: 'A/A B/B D/D R/R',
    possibleHets: [],
    manualownerName: null, groupRole: o.role || null,
    keeperHistory: [], ownershipHistory: [],
    markings: 'Self', lifeStage: o.stage || 'Adult', eyeColor: 'Black', body: 'Standard',
    carrierTraits: 'None known', weight: o.wt || '380', length: o.len || '22',
    heightAtWithers: null, bodyLength: o.len || '22', chestGirth: '14', bodyConditionScore: '3/5',
    microchipNumber: null, pedigreeRegistrationId: o.reg || null, identifiers: null,
    colonyId: 'SHOWCASE-COLONY', breed: null, strain: 'Dumbo',
    licenseNumber: null, licenseJurisdiction: null, tattooId: null, ringId: '', eartagNumber: '',
    origin: 'Captive-bred',
  };
}
module.exports = { D, SCHED, core };
