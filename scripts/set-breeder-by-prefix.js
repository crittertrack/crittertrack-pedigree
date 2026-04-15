/**
 * set-breeder-by-prefix.js
 *
 *  1. FKM  prefixed animals  → breederId_public = 'CTU80', manualBreederName = null
 *  2. RM   prefixed animals  → breederId_public = null,    manualBreederName = 'Royal Mice'
 *  3. TnS  prefixed animals  → breederId_public = 'CTU11', manualBreederName = null
 *
 * Dry-run by default. Pass --apply to commit changes.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal } = require('../database/models');

const DRY_RUN = !process.argv.includes('--apply');

const RULES = [
  { prefix: 'FKM',  breederId_public: 'CTU80', manualBreederName: null },
  { prefix: 'RM',   breederId_public: null,     manualBreederName: 'Royal Mice' },
  { prefix: 'TnS',  breederId_public: 'CTU11',  manualBreederName: null },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to commit)' : 'APPLY'}\n`);

  for (const rule of RULES) {
    // Match prefix case-insensitively to handle any casing variants
    const prefixRegex = new RegExp(`^${rule.prefix}$`, 'i');
    const animals = await Animal.find({ prefix: prefixRegex }).select('id_public name prefix breederId_public manualBreederName').lean();

    console.log(`--- ${rule.prefix} (${animals.length} animals) ---`);
    for (const a of animals) {
      console.log(`  ${a.id_public}  "${a.prefix} ${a.name}"  breeder: ${a.breederId_public || 'none'} / "${a.manualBreederName || 'none'}"`);
    }

    if (!DRY_RUN && animals.length > 0) {
      const ids = animals.map(a => a._id);
      const setFields = {
        breederId_public: rule.breederId_public,
        manualBreederName: rule.manualBreederName,
      };

      await Animal.updateMany({ _id: { $in: ids } }, { $set: setFields });

      // Sync to PublicAnimal
      const idPublics = animals.map(a => a.id_public);
      await PublicAnimal.updateMany({ id_public: { $in: idPublics } }, { $set: setFields });

      console.log(`  → Updated ${animals.length} Animal docs + synced PublicAnimal`);
    }
    console.log();
  }

  if (DRY_RUN) console.log('=== DRY RUN — no changes made ===');
  await mongoose.disconnect();
})();
