/**
 * MIGRATION SCRIPT
 * Fixes the order of genetic codes in all existing animals
 * Ensures C (Albino) comes before D (Dilution) in the standard order
 * 
 * Run with: node scripts/fix-genetic-code-order.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

// Define gene loci for parsing
const GENE_LOCI = ['A', 'B', 'C', 'D', 'E', 'P', 'S', 'W', 'Spl', 'Rn', 'Si', 'Mobr', 'go', 'Re', 'Hr', 'Fz', 'ln', 'Satin', 'Caracul', 'Rex'];

// Define the correct order
const GENE_ORDER = ['A', 'B', 'C', 'D', 'E', 'P', 'S', 'W', 'Spl', 'Rn', 'Si', 'Mobr', 'go', 'Re', 'Hr', 'Fz', 'ln', 'Satin', 'Caracul', 'Rex'];

// Parse genetic code string into components
function parseGeneticCode(codeString) {
    if (!codeString) return {};
    
    const genotype = {};
    const parts = codeString.replace(/,/g, ' ').trim().split(/\s+/);
    
    parts.forEach(part => {
        // Try to identify which locus this belongs to
        // Match patterns like "a/a", "B/B", "C/cch", "go/go", etc.
        
        for (const locus of GENE_LOCI) {
            const locusLower = locus.toLowerCase();
            const partLower = part.toLowerCase();
            
            // Check if this part starts with the locus identifier
            if (partLower.startsWith(locusLower + '/') || 
                partLower.startsWith(locusLower.charAt(0) + '/') ||
                partLower.endsWith('/' + locusLower) ||
                partLower.endsWith('/' + locusLower.charAt(0))) {
                genotype[locus] = part;
                break;
            }
        }
    });
    
    return genotype;
}

// Build genetic code in correct order
function buildGeneticCode(genotype) {
    return GENE_ORDER
        .filter(locus => genotype[locus] && genotype[locus] !== '')
        .map(locus => genotype[locus])
        .join(' ');
}

async function fixGeneticCodeOrder() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack');
        console.log('✓ Connected to MongoDB');

        // Get all animals with genetic codes
        const animals = await Animal.find({ geneticCode: { $exists: true, $ne: null, $ne: '' } });
        console.log(`Found ${animals.length} animals with genetic codes`);

        let updatedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;

        for (const animal of animals) {
            try {
                const originalCode = animal.geneticCode;
                const genotype = parseGeneticCode(originalCode);
                const reorderedCode = buildGeneticCode(genotype);
                
                // Only update if the order changed
                if (originalCode !== reorderedCode && reorderedCode) {
                    console.log(`\nUpdating ${animal.id_public}:`);
                    console.log(`  Old: ${originalCode}`);
                    console.log(`  New: ${reorderedCode}`);
                    
                    // Update Animal record
                    animal.geneticCode = reorderedCode;
                    await animal.save();
                    
                    // Update PublicAnimal record if it exists and should include genetic code
                    if (animal.showOnPublicProfile && animal.includeGeneticCode) {
                        await PublicAnimal.findOneAndUpdate(
                            { id_public: animal.id_public },
                            { $set: { geneticCode: reorderedCode } }
                        );
                    }
                    
                    updatedCount++;
                } else {
                    unchangedCount++;
                }
            } catch (error) {
                console.error(`Error processing animal ${animal.id_public}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n=== MIGRATION COMPLETE ===');
        console.log(`✓ Updated: ${updatedCount} animals`);
        console.log(`- Unchanged: ${unchangedCount} animals`);
        console.log(`✗ Errors: ${errorCount} animals`);

        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
fixGeneticCodeOrder();
