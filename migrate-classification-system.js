/**
 * Classification System Migration Script
 * 
 * This script performs the following actions:
 * 1. Creates default FieldTemplate documents for different animal types
 * 2. Updates all Species documents:
 *    - Changes 'Rodent' category to 'Mammal'
 *    - Assigns appropriate fieldTemplateId to each species
 * 3. Maintains backward compatibility - no changes to Animal documents
 * 
 * Run this script ONCE after deploying the new model changes.
 * 
 * Usage: node migrate-classification-system.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Species, FieldTemplate } = require('./database/models');

const MONGODB_URI = process.env.MONGODB_URI;

// Define the default field templates
const defaultTemplates = [
    {
        name: 'Full Mammal Template',
        description: 'Comprehensive template for larger mammals like dogs, cats, rabbits with full breeding/registration support',
        isDefault: true,
        fields: {
            name: true,
            sex: true,
            birthDate: true,
            deathDate: true,
            status: true,
            strain: { enabled: false, label: 'Strain', required: false },
            geneticCode: { enabled: true, label: 'Genetic Code', required: false },
            phenotype: { enabled: true, label: 'Phenotype', required: false },
            morph: { enabled: false, label: 'Morph', required: false },
            color: { enabled: true, label: 'Color', required: false },
            markings: { enabled: true, label: 'Markings', required: false },
            weight: { enabled: true, label: 'Weight', required: false },
            length: { enabled: false, label: 'Length', required: false },
            breedingStatus: { enabled: true, label: 'Breeding Status', required: false },
            registrationNumber: { enabled: true, label: 'Registration #', required: false },
            microchipNumber: { enabled: true, label: 'Microchip #', required: false },
            temperament: { enabled: true, label: 'Temperament', required: false },
            notes: { enabled: true, label: 'Notes', required: false }
        },
        version: 1
    },
    {
        name: 'Small Mammal Template',
        description: 'Template for small mammals like mice, rats, hamsters, guinea pigs with strain/genetics focus',
        isDefault: true,
        fields: {
            name: true,
            sex: true,
            birthDate: true,
            deathDate: true,
            status: true,
            strain: { enabled: true, label: 'Strain', required: false },
            geneticCode: { enabled: true, label: 'Genetic Code', required: false },
            phenotype: { enabled: true, label: 'Phenotype', required: false },
            morph: { enabled: false, label: 'Morph', required: false },
            color: { enabled: true, label: 'Color', required: false },
            markings: { enabled: true, label: 'Markings', required: false },
            weight: { enabled: true, label: 'Weight', required: false },
            length: { enabled: false, label: 'Length', required: false },
            breedingStatus: { enabled: true, label: 'Breeding Status', required: false },
            registrationNumber: { enabled: true, label: 'Registration #', required: false },
            microchipNumber: { enabled: false, label: 'Microchip #', required: false },
            temperament: { enabled: true, label: 'Temperament', required: false },
            notes: { enabled: true, label: 'Notes', required: false }
        },
        version: 1
    },
    {
        name: 'Reptile Morph Template',
        description: 'Template for reptiles with morph/genetics focus and length measurements',
        isDefault: true,
        fields: {
            name: true,
            sex: true,
            birthDate: true,
            deathDate: true,
            status: true,
            strain: { enabled: false, label: 'Strain', required: false },
            geneticCode: { enabled: true, label: 'Genetic Code', required: false },
            phenotype: { enabled: true, label: 'Phenotype', required: false },
            morph: { enabled: true, label: 'Morph', required: false },
            color: { enabled: true, label: 'Color', required: false },
            markings: { enabled: true, label: 'Pattern/Markings', required: false },
            weight: { enabled: true, label: 'Weight', required: false },
            length: { enabled: true, label: 'Length', required: false },
            breedingStatus: { enabled: true, label: 'Breeding Status', required: false },
            registrationNumber: { enabled: true, label: 'Registration #', required: false },
            microchipNumber: { enabled: false, label: 'Microchip #', required: false },
            temperament: { enabled: true, label: 'Temperament', required: false },
            notes: { enabled: true, label: 'Notes', required: false }
        },
        version: 1
    },
    {
        name: 'Basic Animal Template',
        description: 'Basic template for birds, fish, amphibians, invertebrates with essential fields',
        isDefault: true,
        fields: {
            name: true,
            sex: true,
            birthDate: true,
            deathDate: true,
            status: true,
            strain: { enabled: false, label: 'Strain', required: false },
            geneticCode: { enabled: true, label: 'Genetic Code', required: false },
            phenotype: { enabled: true, label: 'Phenotype', required: false },
            morph: { enabled: false, label: 'Morph', required: false },
            color: { enabled: true, label: 'Color', required: false },
            markings: { enabled: true, label: 'Markings', required: false },
            weight: { enabled: true, label: 'Weight', required: false },
            length: { enabled: false, label: 'Length', required: false },
            breedingStatus: { enabled: true, label: 'Breeding Status', required: false },
            registrationNumber: { enabled: false, label: 'Registration #', required: false },
            microchipNumber: { enabled: false, label: 'Microchip #', required: false },
            temperament: { enabled: true, label: 'Temperament', required: false },
            notes: { enabled: true, label: 'Notes', required: false }
        },
        version: 1
    }
];

// Species-to-template mapping
// Maps species names to which template they should use
const speciesTemplateMapping = {
    // Small mammals (rodents)
    'Fancy Mouse': 'Small Mammal Template',
    'Fancy Rat': 'Small Mammal Template',
    'Russian Dwarf Hamster': 'Small Mammal Template',
    'Campbells Dwarf Hamster': 'Small Mammal Template',
    'Chinese Dwarf Hamster': 'Small Mammal Template',
    'Syrian Hamster': 'Small Mammal Template',
    'Guinea Pig': 'Small Mammal Template',
    'Gerbil': 'Small Mammal Template',
    
    // Other mammals - use Full Mammal Template
    'Dog': 'Full Mammal Template',
    'Cat': 'Full Mammal Template',
    'Rabbit': 'Full Mammal Template',
    'Ferret': 'Full Mammal Template',
    
    // Reptiles - use Reptile Morph Template
    'Ball Python': 'Reptile Morph Template',
    'Corn Snake': 'Reptile Morph Template',
    'Leopard Gecko': 'Reptile Morph Template',
    'Bearded Dragon': 'Reptile Morph Template',
    
    // Others - use Basic Animal Template (default)
};

async function migrateClassificationSystem() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB\n');

        // Step 1: Create default field templates
        console.log('Step 1: Creating default field templates...');
        const createdTemplates = {};
        
        for (const template of defaultTemplates) {
            // Check if template already exists
            const existing = await FieldTemplate.findOne({ name: template.name });
            if (existing) {
                console.log(`  ✓ Template '${template.name}' already exists (ID: ${existing._id})`);
                createdTemplates[template.name] = existing._id;
            } else {
                const newTemplate = await FieldTemplate.create(template);
                console.log(`  ✓ Created template '${template.name}' (ID: ${newTemplate._id})`);
                createdTemplates[template.name] = newTemplate._id;
            }
        }
        console.log(`\nCreated/verified ${Object.keys(createdTemplates).length} field templates\n`);

        // Step 2: Update all species documents
        console.log('Step 2: Updating species documents...');
        
        // Get all species
        const allSpecies = await Species.find({});
        console.log(`Found ${allSpecies.length} species to process\n`);
        
        let updatedCount = 0;
        let categoryChanges = 0;
        let templateAssignments = 0;
        
        for (const species of allSpecies) {
            const updates = {};
            
            // Check if category is 'Rodent' and change to 'Mammal'
            if (species.category === 'Rodent') {
                updates.category = 'Mammal';
                categoryChanges++;
                console.log(`  • ${species.name}: Changing category 'Rodent' → 'Mammal'`);
            }
            
            // Assign field template if not already assigned
            if (!species.fieldTemplateId) {
                // Determine which template to use
                let templateName = speciesTemplateMapping[species.name];
                
                // If not in mapping, assign based on category
                if (!templateName) {
                    if (species.category === 'Mammal' || species.category === 'Rodent') {
                        templateName = 'Full Mammal Template'; // Default for unmapped mammals
                    } else if (species.category === 'Reptile') {
                        templateName = 'Reptile Morph Template';
                    } else {
                        templateName = 'Basic Animal Template';
                    }
                }
                
                const templateId = createdTemplates[templateName];
                if (templateId) {
                    updates.fieldTemplateId = templateId;
                    templateAssignments++;
                    console.log(`    → Assigning template: '${templateName}'`);
                }
            }
            
            // Apply updates if any
            if (Object.keys(updates).length > 0) {
                await Species.updateOne({ _id: species._id }, { $set: updates });
                updatedCount++;
            }
        }
        
        console.log(`\n✅ Migration completed successfully!`);
        console.log(`   - ${updatedCount} species updated`);
        console.log(`   - ${categoryChanges} species changed from 'Rodent' to 'Mammal'`);
        console.log(`   - ${templateAssignments} field templates assigned`);
        console.log(`\n📝 Summary:`);
        console.log(`   Total species: ${allSpecies.length}`);
        console.log(`   Templates created: ${Object.keys(createdTemplates).length}`);
        console.log(`   Species updated: ${updatedCount}`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    migrateClassificationSystem()
        .then(() => {
            console.log('\n✅ All done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrateClassificationSystem;
