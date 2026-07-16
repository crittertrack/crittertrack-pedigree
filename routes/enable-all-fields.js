const path = require('path');
// Load environment variables from the root of the project
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { FieldTemplate } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI;

async function enableAllTemplateFields() {
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI not found in environment variables. Make sure you have a .env file in the project root.');
    process.exit(1);
  }

  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mongoose.connect(MONGODB_URI);
    console.log('Database connected successfully.');

    console.log('\nFetching all field templates...');
    const templates = await FieldTemplate.find({});
    console.log(`Found ${templates.length} templates to process.`);
    let updatedCount = 0;

    for (const template of templates) {
      let wasModified = false;
      if (template.fields) {
        for (const fieldKey in template.fields) {
          if (Object.prototype.hasOwnProperty.call(template.fields, fieldKey)) {
            const field = template.fields[fieldKey];
            if (field && field.enabled === false) {
              field.enabled = true;
              wasModified = true;
            }
          }
        }
      }
      if (wasModified) {
        template.markModified('fields');
        await template.save();
        updatedCount++;
        console.log(`  - Updated template: "${template.name}"`);
      }
    }

    console.log('\nMigration complete.');
    console.log(`✅ Successfully enabled all fields for ${updatedCount} templates.`);

  } catch (error) {
    console.error('\n❌ An error occurred during the migration:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the migration script
enableAllTemplateFields();