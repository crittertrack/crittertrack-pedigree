const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Define Species schema (lightweight version)
const speciesSchema = new mongoose.Schema({
    name: String,
    category: String,
    isDefault: Boolean
});

const Species = mongoose.model('Species', speciesSchema);

async function updateSpeciesCategories() {
    try {
        // Update default species with Rodent category
        const defaultSpecies = ['Mouse', 'Rat', 'Hamster'];
        
        for (const speciesName of defaultSpecies) {
            const result = await Species.updateOne(
                { name: speciesName },
                { 
                    $set: { 
                        category: 'Rodent',
                        isDefault: true 
                    }
                },
                { upsert: true }
            );
            
            if (result.upsertedCount > 0) {
                console.log(`✓ Created ${speciesName} with category: Rodent`);
            } else if (result.modifiedCount > 0) {
                console.log(`✓ Updated ${speciesName} with category: Rodent`);
            } else {
                console.log(`- ${speciesName} already has correct category`);
            }
        }
        
        // Set default category for species without one
        const speciesWithoutCategory = await Species.updateMany(
            { category: { $exists: false } },
            { $set: { category: 'Other' } }
        );
        
        if (speciesWithoutCategory.modifiedCount > 0) {
            console.log(`\n✓ Updated ${speciesWithoutCategory.modifiedCount} species without category to "Other"`);
        }
        
        // Show all species
        const allSpecies = await Species.find({});
        console.log(`\nTotal species in database: ${allSpecies.length}`);
        allSpecies.forEach(s => {
            console.log(`  - ${s.name} (${s.category || 'NO CATEGORY'}) ${s.isDefault ? '[DEFAULT]' : ''}`);
        });
        
    } catch (error) {
        console.error('Error updating species:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

updateSpeciesCategories();
