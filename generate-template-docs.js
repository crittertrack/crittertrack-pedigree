require('dotenv').config();
const mongoose = require('mongoose');
const { FieldTemplate } = require('./database/models');
const fs = require('fs');

async function generateMarkdown() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const templates = await FieldTemplate.find({ isDefault: true }).sort('name');
        
        let markdown = '# Field Template Configuration\n\n';
        markdown += `*Generated: ${new Date().toISOString()}*\n\n`;
        markdown += `**Total Templates:** ${templates.length}\n\n`;
        markdown += '---\n\n';
        
        // Table of contents
        markdown += '## Table of Contents\n\n';
        templates.forEach((template, idx) => {
            markdown += `${idx + 1}. [${template.name}](#${template.name.toLowerCase().replace(/\s+/g, '-')})\n`;
        });
        markdown += '\n---\n\n';
        
        for (const template of templates) {
            markdown += `## ${template.name}\n\n`;
            
            const enabled = [];
            const disabled = [];
            
            Object.keys(template.fields).forEach(field => {
                const fieldConfig = template.fields[field];
                if (fieldConfig.enabled) {
                    enabled.push({ name: field, label: fieldConfig.label || field, required: fieldConfig.required });
                } else {
                    disabled.push({ name: field, label: fieldConfig.label || field, required: fieldConfig.required });
                }
            });
            
            markdown += `**Total Fields:** ${Object.keys(template.fields).length}\n`;
            markdown += `**Enabled:** ${enabled.length} | **Disabled:** ${disabled.length}\n\n`;
            
            // Enabled fields table
            markdown += `### ✅ Enabled Fields (${enabled.length})\n\n`;
            markdown += '| Field Name | Label | Required |\n';
            markdown += '|------------|-------|----------|\n';
            enabled.forEach(f => {
                markdown += `| \`${f.name}\` | ${f.label} | ${f.required ? '✓' : ''} |\n`;
            });
            
            markdown += '\n';
            
            // Disabled fields table
            markdown += `### ❌ Disabled Fields (${disabled.length})\n\n`;
            markdown += '| Field Name | Label |\n';
            markdown += '|------------|-------|\n';
            disabled.forEach(f => {
                markdown += `| \`${f.name}\` | ${f.label} |\n`;
            });
            
            markdown += '\n---\n\n';
        }
        
        fs.writeFileSync('FIELD_TEMPLATES.md', markdown, 'utf8');
        console.log('\n✅ Successfully generated FIELD_TEMPLATES.md');
        console.log(`📄 File contains ${templates.length} templates\n`);
        
        await mongoose.disconnect();
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

generateMarkdown();
