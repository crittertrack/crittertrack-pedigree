require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

// Set lastDoneDate = last Sunday on the specific CTU2 General Care Tasks shown as
// "Never" done in the management view — does NOT touch the other general tasks that
// already have a legitimate recent lastDoneDate (e.g. Umbra + Babies, Ditzy, etc).
const APPLY = process.argv.includes('--apply');

const TARGET_TASK_NAMES = new Set([
    'Breeding Males',
    'Female Groep 1',
    'Female Groep 2',
    'Female Groep 3',
    'Female Groep 4',
    'Young Males 1 (Nashville + Brothers)',
    'Young Males 2 (R16 + T16)',
    'Solo Booked Males',
    'Females Justin',
    'Females Marion + Kassy + Desle',
]);

function lastSunday() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const diff = day === 0 ? 7 : day;
    const d = new Date(now);
    d.setDate(now.getDate() - diff);
    d.setHours(12, 0, 0, 0);
    return d;
}

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu2User = await User.findOne({ id_public: 'CTU2' }).select('_id').lean();
    if (!ctu2User) {
        console.error('CTU2 user not found.');
        await mongoose.disconnect();
        return;
    }

    const profile = await PublicProfile.findOne({ userId_backend: ctu2User._id }).select('generalCareTasks').lean();
    if (!profile || !Array.isArray(profile.generalCareTasks) || profile.generalCareTasks.length === 0) {
        console.log('No general care tasks found for CTU2.');
        await mongoose.disconnect();
        return;
    }

    const targetDate = lastSunday();
    const tasksToUpdate = profile.generalCareTasks.filter(t => TARGET_TASK_NAMES.has(t.taskName));
    console.log('Setting lastDoneDate to:', targetDate.toISOString(), `(${targetDate.toDateString()})`);
    console.log('Tasks to update:', tasksToUpdate.length, 'of', profile.generalCareTasks.length, 'total');
    tasksToUpdate.forEach(t => console.log(`  ${t.taskName} (was: ${t.lastDoneDate || 'Never'})`));
    const missing = [...TARGET_TASK_NAMES].filter(name => !profile.generalCareTasks.some(t => t.taskName === name));
    if (missing.length) console.log('WARNING — not found:', missing);

    if (APPLY) {
        const result = await PublicProfile.updateOne(
            { userId_backend: ctu2User._id, 'generalCareTasks.taskName': { $in: [...TARGET_TASK_NAMES] } },
            { $set: { 'generalCareTasks.$[t].lastDoneDate': targetDate, 'generalCareTasks.$[t].lastSkipped': false } },
            { arrayFilters: [{ 't.taskName': { $in: [...TARGET_TASK_NAMES] } }] }
        );
        console.log('Modified count:', result.modifiedCount);
    } else {
        console.log('Dry run only — pass --apply to write changes.');
    }

    await mongoose.disconnect();
})();
