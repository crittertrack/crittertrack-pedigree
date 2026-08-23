// Daily digest push notifications for overdue animal-care/health/reproduction/enclosure tasks.
// These items are NOT persisted as Notification documents (they're derived/computed, not events),
// so this bypasses the Notification model entirely and pushes directly via sendPushToUser.
const cron = require('node-cron');
const { Animal, Litter, Enclosure, SupplyItem, SystemSettings, User } = require('../database/models');
const { sendPushToUser } = require('./pushService');

const LAST_RUN_KEY = 'animalAlertsCron_lastRunDate';

const todayStr = () => new Date().toISOString().slice(0, 10);

const daysSince = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((today - d) / 86400000);
};

const isTaskDue = (lastDate, freqDays) => {
    if (!freqDays) return false;
    if (!lastDate) return true;
    const ds = daysSince(lastDate);
    return ds !== null && ds >= Number(freqDays);
};

const isFeedingDue = (lastDate, intervalHours) => {
    if (!intervalHours) return false;
    if (!lastDate) return true;
    const d = new Date(lastDate);
    if (isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) / 3600000 >= Number(intervalHours);
};

const cleaningTaskFreqDays = (t) => {
    if (t.frequencyDays) return t.frequencyDays;
    if (!t.frequency) return null;
    const mult = t.frequencyUnit === 'weeks' ? 7 : t.frequencyUnit === 'months' ? 30 : t.frequencyUnit === 'years' ? 365 : 1;
    return t.frequency * mult;
};

const calcNextDose = (med) => {
    if (!med.intervalValue || !med.intervalUnit) return null;
    if (med.stopDate && new Date(med.stopDate) <= new Date()) return null;
    const unitMs = med.intervalUnit === 'hours' ? 3600000
        : med.intervalUnit === 'days' ? 86400000
        : med.intervalUnit === 'weeks' ? 604800000
        : med.intervalUnit === 'months' ? 2592000000 : null;
    if (!unitMs || !med.startDate) return null;
    const start = new Date(med.startDate).getTime();
    if (isNaN(start)) return null;
    const intervalMs = Number(med.intervalValue) * unitMs;
    const elapsed = Date.now() - start;
    if (elapsed < 0) return new Date(start);
    return new Date(start + (Math.floor(elapsed / intervalMs) + 1) * intervalMs);
};

// Same 19 dedicated Grooming/Special-Care/Training schedule fields tracked in
// AnimalList/index.jsx GROOMING_SCHEDULE_DEFS/TRAINING_SCHEDULE_DEFS.
const SCHEDULE_FIELD_KEYS = [
    'groomingSchedule', 'brushingSchedule', 'bathingSchedule', 'specializedCareSchedule', 'specialCareSchedule',
    'nailCareSchedule', 'beakHoofScaleSchedule', 'skinEarCareSchedule', 'dentalCareSchedule', 'healthMonitoringSchedule',
    'exerciseSchedule', 'crateTrainingSchedule', 'litterTrainingSchedule', 'leashTrainingSchedule',
    'freeFlightTrainingSchedule', 'workingRoleTrainingSchedule', 'behavioralIssueTrainingSchedule',
    'reactivityTrainingSchedule', 'flightRiskTrainingSchedule',
];

const HEALTH_STATUSES_OF_CONCERN = ['Concern', 'Critical'];

// Bumps a per-user counter map, e.g. counts.set(userId, { animalCare: 3, health: 1 })
const bump = (counts, userId, category, n = 1) => {
    if (!n) return;
    const key = userId.toString();
    if (!counts.has(key)) counts.set(key, {});
    const entry = counts.get(key);
    entry[category] = (entry[category] || 0) + n;
};

const runAnimalAlertsCheck = async () => {
    const counts = new Map(); // userId -> { feeding, careTasks, enclosureCare, health, breeding }

    // --- Animals: feeding, grooming/training schedules, custom care tasks, health ---
    const animals = await Animal.find({ archived: { $ne: true } })
        .select('creatorId lastFedDate feedingIntervalHours animalCareTasks quarantineDetails healthStatus healthStatusOverride medications ' + SCHEDULE_FIELD_KEYS.join(' '))
        .lean();

    animals.forEach((a) => {
        if (!a.creatorId) return;
        if (isFeedingDue(a.lastFedDate, a.feedingIntervalHours)) bump(counts, a.creatorId, 'feeding', 1);

        let careTaskCount = 0;
        careTaskCount += (a.animalCareTasks || []).filter((t) => isTaskDue(t.lastDoneDate, t.frequencyDays)).length;
        careTaskCount += SCHEDULE_FIELD_KEYS.filter((key) => isTaskDue(a[key]?.lastDoneDate, a[key]?.frequencyDays)).length;
        bump(counts, a.creatorId, 'careTasks', careTaskCount);

        let healthCount = 0;
        if (a.quarantineDetails?.endDate && daysSince(a.quarantineDetails.endDate) >= 0) healthCount += 1;
        const status = a.healthStatusOverride || a.healthStatus;
        if (HEALTH_STATUSES_OF_CONCERN.includes(status)) healthCount += 1;
        healthCount += (a.medications || [])
            .filter((m) => !m.status || m.status === 'active')
            .map((m) => calcNextDose(m))
            .filter((next) => next && next.getTime() <= Date.now()).length;
        bump(counts, a.creatorId, 'health', healthCount);
    });

    // --- Enclosures: cleaning/maintenance tasks ---
    const enclosures = await Enclosure.find({}).select('creatorId cleaningTasks').lean();
    enclosures.forEach((e) => {
        if (!e.creatorId) return;
        const due = (e.cleaningTasks || []).filter((t) => isTaskDue(t.lastDoneDate, cleaningTaskFreqDays(t))).length;
        bump(counts, e.creatorId, 'enclosureCare', due);
    });

    // --- Standalone (not animal/enclosure-linked) general Feeding & Care tasks ---
    const usersWithGeneralTasks = await User.find({ 'generalCareTasks.0': { $exists: true } }).select('generalCareTasks').lean();
    usersWithGeneralTasks.forEach((u) => {
        (u.generalCareTasks || []).forEach((t) => {
            if (!isTaskDue(t.lastDoneDate, cleaningTaskFreqDays(t))) return;
            const category = t.type === 'Feeding' ? 'feeding' : t.type === 'Cleaning' || t.type === 'Maintenance' ? 'enclosureCare' : 'careTasks';
            bump(counts, u._id, category, 1);
        });
    });

    // --- Litters: planned mating date reached, due date reached, weaning date reached ---
    const littersAll = await Litter.find({}).select('creatorId isPlanned matingDate pregnancyDate expectedDueDate birthDate weaningDate weaningConfirmed pregnancyLost').lean();
    littersAll.forEach((l) => {
        if (!l.creatorId) return;
        let reproCount = 0;
        if (l.isPlanned && !l.pregnancyDate && !l.birthDate && l.matingDate) {
            const days = daysSince(l.matingDate);
            if (days !== null && days >= 0) reproCount += 1;
        }
        if (l.pregnancyDate && !l.birthDate && l.expectedDueDate) {
            const days = daysSince(l.expectedDueDate);
            if (days !== null && days >= 0) reproCount += 1;
        }
        const stillNursing = !l.weaningConfirmed && !l.pregnancyLost;
        if (l.birthDate && l.weaningDate && stillNursing) {
            const days = daysSince(l.weaningDate);
            if (days !== null && days >= 0) reproCount += 1;
        }
        bump(counts, l.creatorId, 'breeding', reproCount);
    });

    // --- Supplies: reorder due (grouped with enclosure/logistics care, not feeding) ---
    const supplies = await SupplyItem.find({}).select('userId currentStock reorderThreshold nextOrderDate').lean();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    supplies.forEach((s) => {
        if (!s.userId) return;
        const due = (s.reorderThreshold != null && s.currentStock <= s.reorderThreshold) ||
            (s.nextOrderDate && new Date(s.nextOrderDate) <= today);
        if (due) bump(counts, s.userId, 'enclosureCare', 1);
    });

    // --- Send one digest push per user per category with anything due ---
    const CATEGORY_LABELS = {
        feeding: { emoji: '🍽️', label: 'Feeding', url: '/animals?view=feeding' },
        careTasks: { emoji: '🧴', label: 'Grooming & Care Tasks', url: '/animals?view=feeding' },
        enclosureCare: { emoji: '🧹', label: 'Enclosure & Supplies', url: '/enclosures' },
        health: { emoji: '🩺', label: 'Health', url: '/animals?view=health' },
        breeding: { emoji: '🐣', label: 'Reproduction', url: '/litters' },
    };

    for (const [userId, entry] of counts.entries()) {
        for (const [category, count] of Object.entries(entry)) {
            if (!count) continue;
            const meta = CATEGORY_LABELS[category];
            await sendPushToUser(userId, {
                title: `${meta.emoji} ${meta.label} needs attention`,
                body: `${count} item${count !== 1 ? 's' : ''} due — tap to review.`,
                url: meta.url,
                tag: `daily-${category}`
            }, category).catch((err) => console.error(`[animalAlertsCron] Push failed for user ${userId} (${category}):`, err.message || err));
        }
    }

    await SystemSettings.updateOne(
        { key: LAST_RUN_KEY },
        { key: LAST_RUN_KEY, value: todayStr(), type: 'string', category: 'notifications', description: 'Last date the daily animal-care/health/reproduction alert push digest ran', lastModified: new Date() },
        { upsert: true }
    );

    console.log(`[animalAlertsCron] Digest sent for ${counts.size} user(s) with due items.`);
};

// Guards against double-runs on the same calendar day (e.g. a redeploy restarting the process
// right around the scheduled time) using a persisted SystemSettings marker, not just in-memory state.
const runIfNotAlreadyDoneToday = async () => {
    try {
        const marker = await SystemSettings.findOne({ key: LAST_RUN_KEY }).lean();
        if (marker?.value === todayStr()) return;
        await runAnimalAlertsCheck();
    } catch (err) {
        console.error('[animalAlertsCron] Run failed:', err.message || err);
    }
};

const startAnimalAlertsCron = () => {
    // Runs every hour and no-ops unless it's a new calendar day and past 09:00 UTC — resilient to
    // exact restart timing without needing a single fragile fixed-minute cron expression.
    cron.schedule('0 * * * *', () => {
        const hourUtc = new Date().getUTCHours();
        if (hourUtc >= 9) runIfNotAlreadyDoneToday();
    });
    console.log('[animalAlertsCron] Scheduled (checks hourly, sends once/day after 09:00 UTC).');
};

module.exports = { startAnimalAlertsCron, runAnimalAlertsCheck };
