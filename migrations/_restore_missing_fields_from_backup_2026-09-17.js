require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const BACKUP_PATH = 'C:/Users/dbana/Downloads/backups_auto-backup-2026-09-16T03-00-00_animals.json';
const FIELDS = ['prefix','suffix','breederAssignedId','imageUrl','photoUrl','sireId_public','damId_public','birthDate','deceasedDate','status','remarks','causeOfDeath','manualownerName','ownerId_public','breederId_public'];
const MERGES = [
  { keepId: 'CTC5040', deleteId: 'CTC7597' },
  { keepId: 'CTC2997', deleteId: 'CTC4390' },
  { keepId: 'CTC3001', deleteId: 'CTC4381' },
  { keepId: 'CTC2966', deleteId: 'CTC4389' },
  { keepId: 'CTC3661', deleteId: 'CTC4465' },
  { keepId: 'CTC74', deleteId: 'CTC4912' },
  { keepId: 'CTC483', deleteId: 'CTC4415' }
];
const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  const backupMap = new Map(backup.map((record) => [record.id_public, record]));

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    for (const { keepId, deleteId } of MERGES) {
      const keep = await Animal.findOne({ id_public: keepId }).lean();
      const source = backupMap.get(deleteId) || backupMap.get(keepId) || {};
      const updates = {};

      for (const field of FIELDS) {
        if (keepId === 'CTC483' && (field === 'sireId_public' || field === 'damId_public')) continue;
        if (!isBlank(keep[field]) || isBlank(source[field])) continue;
        updates[field] = source[field];
      }

      if (Object.keys(updates).length) {
        await Animal.updateOne({ id_public: keepId }, { $set: updates });
        console.log('UPDATED', keepId, JSON.stringify(updates));
      } else {
        console.log('NO_CHANGE', keepId);
      }
    }

    const rows = await Animal.find({ id_public: { $in: ['CTC5040','CTC2997','CTC3001','CTC2966','CTC3661','CTC74','CTC483'] } }, { _id: 0, id_public: 1, prefix: 1, name: 1, suffix: 1, imageUrl: 1, photoUrl: 1, birthDate: 1, deceasedDate: 1, sireId_public: 1, damId_public: 1, status: 1 }).lean();
    console.log(JSON.stringify(rows, null, 2));
    console.log('RESTORE_MISSING_FIELDS_COMPLETE');
  } catch (error) {
    console.error('Restore failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
