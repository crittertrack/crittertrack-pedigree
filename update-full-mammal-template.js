require('dotenv').config();
const mongoose = require('mongoose');
const { FieldTemplate } = require('./database/models');

async function updateFullMammalTemplate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('\n========================================');
        console.log('UPDATING FULL MAMMAL TEMPLATE');
        console.log('========================================\n');
        
        const template = await FieldTemplate.findOne({ name: 'Full Mammal Template' });
        
        if (!template) {
            console.error('❌ Full Mammal Template not found!');
            process.exit(1);
        }
        
        console.log('Current configuration loaded.\n');
        
        // Track changes
        const changes = [];
        
        // 1. ENABLE registry fields (currently disabled)
        const registryFields = [
            'akcRegistrationNumber',
            'fciRegistrationNumber', 
            'cfaRegistrationNumber'
        ];
        
        registryFields.forEach(field => {
            if (template.fields[field] && !template.fields[field].enabled) {
                template.fields[field].enabled = true;
                changes.push(`✓ Enabled: ${field}`);
            }
        });
        
        // 2. ENABLE strain field (currently disabled)
        if (template.fields['strain'] && !template.fields['strain'].enabled) {
            template.fields['strain'].enabled = true;
            template.fields['strain'].label = 'Lineage/Strain';
            changes.push(`✓ Enabled: strain → renamed label to "Lineage/Strain"`);
        }
        
        // 3. DISABLE redundant fertility field
        if (template.fields['isInfertile'] && template.fields['isInfertile'].enabled) {
            template.fields['isInfertile'].enabled = false;
            changes.push(`✓ Disabled: isInfertile (redundant with fertilityStatus)`);
        }
        
        // 4. DISABLE damFertilityStatus (redundant)
        if (template.fields['damFertilityStatus'] && template.fields['damFertilityStatus'].enabled) {
            template.fields['damFertilityStatus'].enabled = false;
            changes.push(`✓ Disabled: damFertilityStatus (redundant with main fertilityStatus)`);
        }
        
        // 5. Update weight field labels for clarity
        if (template.fields['adultWeight']) {
            template.fields['adultWeight'].label = 'Expected Adult Weight';
            changes.push(`✓ Updated label: adultWeight → "Expected Adult Weight"`);
        }
        
        // Note: currentWeight would need to be added to schema first
        
        // 6. Update breeding-related field labels for better clarity
        if (template.fields['matingDates']) {
            template.fields['matingDates'].label = 'Mating Dates (Historical)';
            changes.push(`✓ Updated label: matingDates → "Mating Dates (Historical)"`);
        }
        
        if (template.fields['lastMatingDate']) {
            template.fields['lastMatingDate'].label = 'Most Recent Mating';
            changes.push(`✓ Updated label: lastMatingDate → "Most Recent Mating"`);
        }
        
        // Display changes
        console.log('CHANGES TO BE APPLIED:\n');
        if (changes.length === 0) {
            console.log('  No changes needed - template already up to date.\n');
        } else {
            changes.forEach(change => console.log(`  ${change}`));
            console.log();
        }
        
        // Save changes
        if (changes.length > 0) {
            template.version += 1;
            template.updatedAt = new Date();
            await template.save();
            
            console.log('✅ Full Mammal Template updated successfully!');
            console.log(`📝 Version: ${template.version}`);
        }
        
        console.log('\n========================================\n');
        
        await mongoose.disconnect();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

updateFullMammalTemplate();
