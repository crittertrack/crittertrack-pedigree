// scripts/remove-stray-litter-breeding-records.js

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Litter } = require('../database/models');

const APPLY_CHANGES = process.argv.includes('--apply');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  console.log(
    APPLY_CHANGES
      ? '\n⚠️  APPLY MODE — database changes WILL be made.\n'
      : '\n🔎 DRY RUN — no database changes will be made.\n'
  );

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    /*
     * Load all real litters first.
     *
     * A breedingRecords entry with a litterId pointing to one of these
     * records is considered stray/manual duplicate data.
     */
    const litters = await Litter.find(
      {},
      {
        _id: 1,
        litter_id_public: 1,
        birthDate: 1,
        offspringIds_public: 1,
      }
    ).lean();

    const litterByPublicId = new Map();

    for (const litter of litters) {
      if (litter.litter_id_public) {
        litterByPublicId.set(litter.litter_id_public, litter);
      }
    }

    console.log(`Found ${litters.length} litter records.`);
    console.log(`Found ${litterByPublicId.size} public litter IDs.\n`);

    /*
     * Find animals that actually have breedingRecords.
     */
    const animals = await Animal.find(
      {
        breedingRecords: {
          $exists: true,
          $ne: [],
        },
      },
      {
        _id: 1,
        id_public: 1,
        name: 1,
        litterId: 1,
        breedingRecords: 1,
      }
    ).lean();

    console.log(`Found ${animals.length} animals with breeding records.\n`);

    let animalsAffected = 0;
    let recordsRemoved = 0;
    let recordsSkipped = 0;

    const changes = [];

    for (const animal of animals) {
      const records = Array.isArray(animal.breedingRecords)
        ? animal.breedingRecords
        : [];

      if (records.length === 0) {
        continue;
      }

      const keep = [];
      const remove = [];

      for (let index = 0; index < records.length; index++) {
        const record = records[index];

        if (!record || typeof record !== 'object') {
          keep.push(record);
          continue;
        }

        const litterId = record.litterId;

        /*
         * No litterId = normal manual breeding history.
         * Keep it untouched.
         */
        if (!litterId) {
          keep.push(record);
          continue;
        }

        /*
         * A litterId exists, but if it doesn't point to a real Litter,
         * don't delete it automatically. It may be stale data that needs
         * separate investigation.
         */
        const litter = litterByPublicId.get(String(litterId));

        if (!litter) {
          keep.push(record);
          recordsSkipped++;

          console.log(
            `⚠️  ${animal.id_public || animal._id}: ` +
            `breedingRecords[${index}] references missing litter ${litterId} — kept`
          );

          continue;
        }

        /*
         * This is the bug we're targeting:
         *
         * breedingRecords is supposed to be manual history, while the
         * actual litter relationship is represented by Litter + Animal.litterId.
         *
         * Therefore a breedingRecords entry pointing to a real litter
         * is a duplicate representation and should be removed.
         */
        remove.push({
          index,
          record,
          litter,
        });
      }

      if (remove.length === 0) {
        continue;
      }

      animalsAffected++;
      recordsRemoved += remove.length;

      const change = {
        animalId: animal.id_public || String(animal._id),
        animalName: animal.name || null,
        animalLitterId: animal.litterId || null,
        removed: remove.map(({ index, record, litter }) => ({
          index,
          litterId: record.litterId,
          litterPublicId: litter.litter_id_public,
          litterBirthDate: litter.birthDate || null,
          litterOffspringCount: Array.isArray(litter.offspringIds_public)
            ? litter.offspringIds_public.length
            : 0,
          record: {
            litterId: record.litterId || null,
            outcome: record.outcome || null,
            birthEventDate: record.birthEventDate || null,
            matingDate: record.matingDate || null,
            notes: record.notes || null,
          },
        })),
      };

      changes.push(change);

      console.log(
        `\n${APPLY_CHANGES ? '🗑️' : '🔍'} ${change.animalId}` +
        `${change.animalName ? ` (${change.animalName})` : ''}`
      );

      for (const item of change.removed) {
        console.log(
          `   breedingRecords[${item.index}] → litter ${item.litterId}` +
          ` | birth ${item.litterBirthDate || '?'} ` +
          `| ${item.litterOffspringCount} offspring`
        );
      }

      /*
       * Only actually modify the database when --apply is supplied.
       */
      if (APPLY_CHANGES) {
        await Animal.updateOne(
          { _id: animal._id },
          {
            $set: {
              breedingRecords: keep,
            },
          }
        );

        console.log(`   ✓ Removed ${remove.length} stray record(s).`);
      }
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Animals affected:       ${animalsAffected}`);
    console.log(`Records to remove:      ${recordsRemoved}`);
    console.log(`Records skipped:        ${recordsSkipped}`);
    console.log('========================================\n');

    if (!APPLY_CHANGES) {
      if (recordsRemoved > 0) {
        console.log(
          'DRY RUN ONLY — nothing was changed.'
        );
        console.log(
          'Review the records above, then run with --apply to remove them:\n'
        );
        console.log(
          'node scripts/remove-stray-litter-breeding-records.js --apply\n'
        );
      } else {
        console.log('No stray litter-linked breeding records were found.');
      }
    } else {
      console.log(
        `✓ Migration complete. Removed ${recordsRemoved} stray breeding record(s).`
      );
    }

    /*
     * Print machine-readable change information at the end.
     * Useful for keeping a record of exactly what was changed.
     */
    console.log('\nChange report:');
    console.log(JSON.stringify(changes, null, 2));
  } catch (error) {
    console.error('\nMigration failed:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();