/**
 * Assign Field Templates to Existing Species
 * 
 * This script assigns the appropriate field template to each species based on:
 * 1. Species category (Mammal, Reptile, Bird, etc.)
 * 2. Species-specific characteristics (e.g., small rodents vs larger mammals)
 * 
 * Run with: node assign-templates-to-species.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Species, FieldTemplate } = require('./database/models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

// Species-to-template mapping rules
const speciesRules = {
    // Small mammals (rodents) - use Small Mammal Template
    smallMammals: [
        'Fancy Mouse', 'Fancy Rat', 'Mouse', 'Rat',
        'Russian Dwarf Hamster', 'Campbells Dwarf Hamster', 
        'Chinese Dwarf Hamster', 'Syrian Hamster', 'Hamster',
        'Guinea Pig', 'Gerbil', 'Chinchilla', 'Degu'
    ],
    
    // Larger mammals - use Full Mammal Template
    largeMammals: [
        'Dog', 'Cat', 'Rabbit', 'Ferret', 'Fox', 'Hedgehog'
    ],
    
    // Reptiles - use Reptile Template
    reptiles: [
        'Ball Python', 'Corn Snake', 'Snake', 'Python', 'Boa',
        'Leopard Gecko', 'Bearded Dragon', 'Gecko', 'Lizard',
        'Turtle', 'Tortoise', 'Chameleon', 'Iguana', 'Monitor'
    ],
    
    // Birds - use Bird Template
    birds: [
        'Parrot', 'Parakeet', 'Cockatiel', 'Budgie', 'Finch',
        'Canary', 'Macaw', 'Cockatoo', 'Lovebird', 'Conure',
        'Chicken', 'Duck', 'Goose', 'Quail', 'Pigeon'
    ],
    
    // Amphibians - use Amphibian Template
    amphibians: [
        'Frog', 'Tree Frog', 'Toad', 'Salamander', 'Newt', 'Axolotl'
    ],
    
    // Fish - use Fish Template
    fish: [
        'Goldfish', 'Betta', 'Guppy', 'Koi', 'Tetra',
        'Cichlid', 'Angelfish', 'Discus', 'Molly', 'Platy'
    ],
    
    // Invertebrates - use Invertebrate Template
    invertebrates: [
        'Tarantula', 'Spider', 'Scorpion', 'Mantis',
        'Beetle', 'Stick Insect', 'Millipede', 'Centipede',
        'Hermit Crab', 'Snail'
    ]
};

// Template selection logic
function getTemplateNameForSpecies(speciesName, category) {
    const name = speciesName.toLowerCase();
    
    // Check specific species lists
    if (speciesRules.smallMammals.some(s => name.includes(s.toLowerCase()))) {
        return 'Small Mammal Template';
    }
    if (speciesRules.largeMammals.some(s => name.includes(s.toLowerCase()))) {
        return 'Full Mammal Template';
    }
    if (speciesRules.reptiles.some(s => name.includes(s.toLowerCase()))) {
        return 'Reptile Template';
    }
    if (speciesRules.birds.some(s => name.includes(s.toLowerCase()))) {
        return 'Bird Template';
    }
    if (speciesRules.amphibians.some(s => name.includes(s.toLowerCase()))) {
        return 'Amphibian Template';
    }
    if (speciesRules.fish.some(s => name.includes(s.toLowerCase()))) {
        return 'Fish Template';
    }
    if (speciesRules.invertebrates.some(s => name.includes(s.toLowerCase()))) {
        return 'Invertebrate Template';
    }
    
    // Fall back to category-based assignment
    switch (category) {
        case 'Mammal':
            return 'Small Mammal Template'; // Default for mammals
        case 'Reptile':
            return 'Reptile Template';
        case 'Bird':
            return 'Bird Template';
        case 'Amphibian':
            return 'Amphibian Template';
        case 'Fish':
            return 'Fish Template';
        case 'Invertebrate':
            return 'Invertebrate Template';
        default:
            return 'Other Template';
    }
}

async function assignTemplates() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully.\n');
        
        console.log('========================================');
        console.log('ASSIGN TEMPLATES TO SPECIES');
        console.log('========================================\n');
        
        // Load all templates
        const templates = await FieldTemplate.find({ isDefault: true });
        const templateMap = {};
        templates.forEach(t => {
            templateMap[t.name] = t._id;
        });
        
        console.log('Available templates:');
        Object.keys(templateMap).forEach(name => {
            console.log(`  - ${name} (${templateMap[name]})`);
        });
        console.log();
        
        // Load all species
        const allSpecies = await Species.find({});
        console.log(`Found ${allSpecies.length} species to process.\n`);
        
        const results = {
            assigned: [],
            updated: [],
            skipped: [],
            noTemplate: []
        };
        
        for (const species of allSpecies) {
            try {
                const templateName = getTemplateNameForSpecies(species.name, species.category);
                const templateId = templateMap[templateName];
                
                if (!templateId) {
                    console.log(`  ⚠️  No template found for "${templateName}" (species: ${species.name})`);
                    results.noTemplate.push(species.name);
                    continue;
                }
                
                if (species.fieldTemplateId) {
                    if (species.fieldTemplateId.toString() === templateId.toString()) {
                        console.log(`  ⏭️  ${species.name} - Already has correct template`);
                        results.skipped.push(species.name);
                    } else {
                        console.log(`  🔄 ${species.name} - Updating template to ${templateName}`);
                        species.fieldTemplateId = templateId;
                        await species.save();
                        results.updated.push(species.name);
                    }
                } else {
                    console.log(`  ✅ ${species.name} - Assigning ${templateName}`);
                    species.fieldTemplateId = templateId;
                    await species.save();
                    results.assigned.push(species.name);
                }
            } catch (error) {
                console.error(`  ❌ Error processing ${species.name}:`, error.message);
            }
        }
        
        console.log('\n========================================');
        console.log('ASSIGNMENT SUMMARY');
        console.log('========================================\n');
        console.log(`✅ Templates assigned: ${results.assigned.length}`);
        if (results.assigned.length > 0) {
            results.assigned.forEach(name => console.log(`   - ${name}`));
        }
        console.log(`\n🔄 Templates updated: ${results.updated.length}`);
        if (results.updated.length > 0) {
            results.updated.forEach(name => console.log(`   - ${name}`));
        }
        console.log(`\n⏭️  Templates skipped (already correct): ${results.skipped.length}`);
        console.log(`\n⚠️  No template found: ${results.noTemplate.length}`);
        if (results.noTemplate.length > 0) {
            results.noTemplate.forEach(name => console.log(`   - ${name}`));
        }
        
        console.log('\n========================================');
        console.log('ASSIGNMENT COMPLETE');
        console.log('========================================\n');
        
        await mongoose.disconnect();
        console.log('Disconnected from database.');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ ASSIGNMENT FAILED:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the assignment
assignTemplates();
