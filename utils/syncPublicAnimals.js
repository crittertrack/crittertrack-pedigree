/**
 * Utility function to sync an animal to the publicanimals collection
 * Only includes fields that are marked as public in sectionPrivacy
 */

async function syncAnimalToPublic(animal) {
    try {
        const { PublicAnimal } = require('../database/models');
        
        if (!animal || !animal.id_public) {
            console.log('[syncAnimalToPublic] Invalid animal data, skipping sync');
            return;
        }
        
        // If animal should be public, upsert to publicanimals
        if (animal.showOnPublicProfile === true) {
            // Remove _id to avoid immutable field error
            const { _id, ...animalWithoutId } = animal.toObject ? animal.toObject() : animal;
            
            // Get sectionPrivacy settings
            const sectionPrivacy = animalWithoutId.sectionPrivacy || {};
            
            // Fields that should be hidden if their privacy setting is false
            const privacyControlledFields = {
                remarks: 'remarks',
                geneticCode: 'geneticCode',
                currentOwner: 'currentOwner',
                // Add other privacy-controlled fields as needed
            };
            
            // Remove private fields based on sectionPrivacy settings
            const publicAnimalData = { ...animalWithoutId };
            for (const [privacyKey, fieldName] of Object.entries(privacyControlledFields)) {
                if (sectionPrivacy[privacyKey] === false) {
                    // Privacy is false (private), so remove the field from public view
                    delete publicAnimalData[fieldName];
                }
            }
            
            await PublicAnimal.replaceOne(
                { id_public: animal.id_public },
                publicAnimalData,
                { upsert: true }
            );
            console.log(`[syncAnimalToPublic] Synced animal ${animal.id_public} to publicanimals`);
        } else {
            // If animal should not be public, remove from publicanimals
            await PublicAnimal.deleteOne({ id_public: animal.id_public });
            console.log(`[syncAnimalToPublic] Removed animal ${animal.id_public} from publicanimals`);
        }
    } catch (error) {
        console.error('[syncAnimalToPublic] Error syncing animal to public collection:', error);
        // Don't throw - this is a background sync operation
    }
}

module.exports = { syncAnimalToPublic };
