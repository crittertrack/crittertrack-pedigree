// Daily digest push notifications for overdue animal-care/health/reproduction/enclosure tasks.
// These items are NOT persisted as Notification documents (they're derived/computed, not events),
// so this bypasses the Notification model entirely and pushes directly via sendPushToUser.
const cron = require('node-cron');
const { Animal, Litter, Enclosure, SupplyItem, SystemSettings, PublicProfile } = require('../database/models');
const { sendPushToUser } = require('./pushService');
const { formatAnimalName, formatAlertDigest } = require('./alertNames');

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

// Tracks due counts and distinct display names per user/category.
const bump = (alerts, userId, category, name, n = 1) => {
    if (!n) return;
    const key = userId.toString();
    if (!alerts.has(key)) alerts.set(key, {});
    const categories = alerts.get(key);
    if (!categories[category]) categories[category] = { count: 0, names: new Set() };
    const alert = categories[category];
    alert.count += n;
    if (name) alert.names.add(name);
};

const runAnimalAlertsCheck = async () => {
    const alerts = new Map(); // userId -> category -> { count, names }

    // --- Animals: feeding, grooming/training schedules, custom care tasks, health ---
    const animals = await Animal.find({ archived: { $ne: true } })
        .select('creatorId id_public prefix name suffix lastFedDate feedingIntervalHours animalCareTasks quarantineDetails healthStatus healthStatusOverride medications ' + SCHEDULE_FIELD_KEYS.join(' '))
        .lean();

    const animalNamesById = new Map(animals.map((animal) => [animal.id_public, formatAnimalName(animal)]));
    animals.forEach((a) => {
        if (!a.creatorId) return;
        const animalName = formatAnimalName(a);
        if (isFeedingDue(a.lastFedDate, a.feedingIntervalHours)) bump(alerts, a.creatorId, 'feeding', animalName);

        (a.animalCareTasks || []).filter((task) => isTaskDue(task.lastDoneDate, task.frequencyDays))
            .forEach((task) => bump(alerts, a.creatorId, 'careTasks', `${animalName} — ${task.taskName}`));
        SCHEDULE_FIELD_KEYS.filter((key) => isTaskDue(a[key]?.lastDoneDate, a[key]?.frequencyDays))
            .forEach((key) => {
                const taskName = key.replace(/Schedule$/, '').replace(/([A-Z])/g, ' $1').trim();
                bump(alerts, a.creatorId, 'careTasks', `${animalName} — ${taskName}`);
            });

        // Only count a passed quarantine end date while quarantine is still marked active —
        // once a user ends it, status resets to 'None' but endDate is deliberately kept as the
        // "ended on" record for the health timeline (see AnimalFormModalV2.jsx), so checking
        // endDate alone fired this every single day forever for any animal that ever finished one.
        const quarantineActive = a.quarantineDetails?.status && a.quarantineDetails.status !== 'None';
        if (quarantineActive && a.quarantineDetails?.endDate && daysSince(a.quarantineDetails.endDate) >= 0) {
            bump(alerts, a.creatorId, 'health', `${animalName} — quarantine end date`);
        }
        const status = a.healthStatusOverride || a.healthStatus;
        if (HEALTH_STATUSES_OF_CONCERN.includes(status)) {
            bump(alerts, a.creatorId, 'health', `${animalName} — ${status} health status`);
        }
        const dueMedications = (a.medications || [])
            .filter((m) => !m.status || m.status === 'active')
            .map((medication) => ({ medication, nextDose: calcNextDose(medication) }))
            .filter(({ nextDose }) => nextDose && nextDose.getTime() <= Date.now());
        dueMedications.forEach(({ medication }) => bump(alerts, a.creatorId, 'health', `${animalName} — ${medication.name || 'medication'}`));
    });

    // --- Enclosures: cleaning/maintenance tasks ---
    const enclosures = await Enclosure.find({}).select('creatorId name cleaningTasks').lean();
    enclosures.forEach((e) => {
        if (!e.creatorId) return;
        (e.cleaningTasks || []).filter((task) => isTaskDue(task.lastDoneDate, cleaningTaskFreqDays(task)))
            .forEach((task) => bump(alerts, e.creatorId, 'enclosureCare', `${e.name || 'Unnamed enclosure'} — ${task.taskName || task.type || 'task'}`));
    });

    // --- Standalone (not animal/enclosure-linked) general Feeding & Care tasks ---
    // generalCareTasks lives on PublicProfile (keyed by userId_backend), not on User.
    const profilesWithGeneralTasks = await PublicProfile.find({ 'generalCareTasks.0': { $exists: true } }).select('userId_backend generalCareTasks').lean();
    profilesWithGeneralTasks.forEach((p) => {
        if (!p.userId_backend) return;
        (p.generalCareTasks || []).forEach((t) => {
            if (!isTaskDue(t.lastDoneDate, cleaningTaskFreqDays(t))) return;
            const category = t.type === 'Feeding' ? 'feeding' : t.type === 'Cleaning' || t.type === 'Maintenance' ? 'enclosureCare' : 'careTasks';
            const assignedNames = (t.assignedAnimals || []).map((id) => animalNamesById.get(id)).filter(Boolean);
            const taskLabel = t.taskName || 'General care task';
            bump(alerts, p.userId_backend, category, assignedNames.length ? `${taskLabel} — ${assignedNames.join(', ')}` : taskLabel);
        });
    });

    // --- Litters: planned mating date reached, due date reached, weaning date reached ---
    const littersAll = await Litter.find({}).select('creatorId litter_id_public breedingPairCodeName sireId_public damId_public isPlanned matingDate pregnancyDate expectedDueDate birthDate weaningDate weaningConfirmed pregnancyLost').lean();
    littersAll.forEach((l) => {
        if (!l.creatorId) return;
        const litterLabel = l.litter_id_public || l.breedingPairCodeName || 'Litter';
        const sireName = animalNamesById.get(l.sireId_public);
        const damName = animalNamesById.get(l.damId_public);
        if (l.isPlanned && !l.pregnancyDate && !l.birthDate && l.matingDate) {
            const days = daysSince(l.matingDate);
            if (days !== null && days >= 0) {
                const parents = [damName, sireName].filter(Boolean);
                bump(alerts, l.creatorId, 'breeding', parents.length ? parents.join(' × ') : litterLabel);
            }
        }
        if (l.pregnancyDate && !l.birthDate && l.expectedDueDate) {
            const days = daysSince(l.expectedDueDate);
            if (days !== null && days >= 0) bump(alerts, l.creatorId, 'breeding', damName || litterLabel);
        }
        const stillNursing = !l.weaningConfirmed && !l.pregnancyLost;
        if (l.birthDate && l.weaningDate && stillNursing) {
            const days = daysSince(l.weaningDate);
            if (days !== null && days >= 0) bump(alerts, l.creatorId, 'breeding', damName || litterLabel);
        }
    });

    // --- Supplies: reorder due (grouped with enclosure/logistics care, not feeding) ---
    const supplies = await SupplyItem.find({}).select('userId name currentStock reorderThreshold nextOrderDate').lean();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    supplies.forEach((s) => {
        if (!s.userId) return;
        const due = (s.reorderThreshold != null && s.currentStock <= s.reorderThreshold) ||
            (s.nextOrderDate && new Date(s.nextOrderDate) <= today);
        if (due) bump(alerts, s.userId, 'enclosureCare', s.name || 'Unnamed supply');
    });

    // --- Send one digest push per user per category with anything due ---
    const CATEGORY_LABELS = {
        feeding: { emoji: '🍽️', label: 'Feeding', url: '/animals?view=feeding' },
        careTasks: { emoji: '🧴', label: 'Grooming & Care Tasks', url: '/animals?view=feeding' },
        enclosureCare: { emoji: '🧹', label: 'Enclosure & Supplies', url: '/enclosures' },
        health: { emoji: '🩺', label: 'Health', url: '/animals?view=health' },
        breeding: { emoji: '🐣', label: 'Reproduction', url: '/litters' },
    };

    for (const [userId, entry] of alerts.entries()) {
        for (const [category, alert] of Object.entries(entry)) {
            if (!alert.count) continue;
            const meta = CATEGORY_LABELS[category];
            await sendPushToUser(userId, {
                title: `${meta.emoji} ${meta.label} needs attention`,
                body: formatAlertDigest(alert.count, [...alert.names]),
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

    console.log(`[animalAlertsCron] Digest sent for ${alerts.size} user(s) with due items.`);
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

module.exports = {
    startAnimalAlertsCron, runAnimalAlertsCheck,
    // Exported so routes (e.g. the bell-icon alert-count endpoint) can reuse the exact same
    // due-date/frequency logic instead of re-implementing it and risking drift.
    daysSince, isTaskDue, isFeedingDue, cleaningTaskFreqDays, calcNextDose,
    SCHEDULE_FIELD_KEYS, HEALTH_STATUSES_OF_CONCERN,
};
