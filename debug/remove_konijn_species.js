/**
 * One-off: inventory everything referencing the custom species "Konijn" before
 * deleting it from the species collection, then delete + verify.
 *
 * Usage:
 *   node debug/remove_konijn_species.js            # dry run (report only)
 *   node debug/remove_konijn_species.js --apply    # re-key options + delete the species entry
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // 1. The species entry itself
  const sp = await db.collection('species').findOne({ name: /^konijn$/i });
  console.log('Species entry:', sp
    ? JSON.stringify({ _id: String(sp._id), name: sp.name, isDefault: sp.isDefault, createdBy_public: sp.createdBy_public, createdAt: sp.createdAt })
    : 'NOT FOUND');

  // 2. Exact-match usage anywhere it matters
  const exactAnimals = await db.collection('animals').countDocuments({ species: /^konijn$/i });
  const exactPublic = await db.collection('publicanimals').countDocuments({ species: /^konijn$/i });
  const favUsers = await db.collection('users').countDocuments({ speciesFavorites: /^konijn$/i });
  console.log(`\nExact "Konijn" species usage:`);
  console.log(`- animals: ${exactAnimals}`);
  console.log(`- publicanimals: ${exactPublic}`);
  console.log(`- users' speciesFavorites: ${favUsers}`);

  // 3. Custom appearance-field options keyed to this species (would be orphaned)
  const afOptions = await db.collection('appearancefieldoptions').find({ species: /^konijn$/i },
    { projection: { _id: 0, field: 1, value: 1, userId: 1 } }).toArray();
  console.log(`\nappearancefieldoptions with species "Konijn": ${afOptions.length}`);
  for (const o of afOptions) console.log(`- ${o.field} = "${o.value}"`);

  // 4. Any other species-keyed config
  const spc = await db.collection('speciesconfigs').countDocuments({ species: /^konijn$/i });
  const sgs = await db.collection('speciesgeneticssubmissions').countDocuments({ species: /^konijn$/i });
  console.log(`\nspeciesconfigs: ${spc} | speciesgeneticssubmissions: ${sgs}`);

  // Safety gate
  if (exactAnimals > 0 || exactPublic > 0) {
    console.error('\nABORT: animals still use species "Konijn" — migrate them first.');
    process.exit(1);
  }
  if (!sp) { console.log('\nNothing to delete.'); await client.close(); return; }
  if (sp.isDefault) { console.error('\nABORT: "Konijn" is marked isDefault — refusing to delete.'); process.exit(1); }

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to delete the species entry.');
    await client.close();
    return;
  }

  const del = await db.collection('species').deleteOne({ _id: sp._id });
  console.log(`Deleted species entries: ${del.deletedCount}`);

  // Appearance options: the migrated animals still carry these values (Wit,
  // Langhaar, Gevlekt, ...), and "Rabbit" has no options of its own — so
  // re-key them to Rabbit instead of orphan-deleting them. Skip any value
  // that already exists under Rabbit (dupes would violate uniqueness intent).
  if (afOptions.length) {
    const rabbitOpts = await db.collection('appearancefieldoptions').find({ species: /^rabbit$/i },
      { projection: { field: 1, value: 1, userId: 1 } }).toArray();
    const hasDup = (o) => rabbitOpts.some(r =>
      r.field === o.field && r.value === o.value && String(r.userId) === String(o.userId));
    let rekeyed = 0, skipped = 0;
    for (const o of afOptions) { // afOptions projected without _id; re-fetch ids for update
      const match = await db.collection('appearancefieldoptions').findOne({
        species: /^konijn$/i, field: o.field, value: o.value, userId: o.userId
      });
      if (!match) continue;
      if (hasDup(o)) {
        await db.collection('appearancefieldoptions').deleteOne({ _id: match._id });
        skipped++;
      } else {
        await db.collection('appearancefieldoptions').updateOne({ _id: match._id }, { $set: { species: 'Rabbit' } });
        rekeyed++;
      }
    }
    console.log(`Appearance options re-keyed Konijn -> Rabbit: ${rekeyed}; duplicate removed: ${skipped}`);
  }

  // Verify
  const gone = await db.collection('species').countDocuments({ name: /^konijn$/i });
  const orphanOpts = await db.collection('appearancefieldoptions').countDocuments({ species: /^konijn$/i });
  console.log(`\nVerification — species entries matching "konijn": ${gone} | appearance options on "Konijn": ${orphanOpts} ${gone === 0 && orphanOpts === 0 ? '(OK)' : '(FAILED)'}`);
  if (gone !== 0 || orphanOpts !== 0) process.exit(1);

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
