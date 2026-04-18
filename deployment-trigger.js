// Force deployment trigger - ownerId_public fix + litter offspring parent fallback
// Date: 2026-04-18
// Purpose: POST /animals missing ownerId_public; offspring endpoint parent fallback
module.exports = {
    DEPLOYMENT_TIMESTAMP: '2026-04-18T21:30:00Z',
    FEATURES: ['sb_gender_fix', 'sb_species_fallback', 'sb_manual_ctu_mapping']
};