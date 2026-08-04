// utils/animalLogger.js
//
// Creates AnimalLog entries whenever an animal record changes, so the frontend's
// Timeline tab (TimelineTabContent.jsx / AnimalFormModalV2.jsx) has something to show.
// Three categories are used:
//   - 'field'   → core record field edits (name, status, morph, identifiers, etc.)
//   - 'care'    → care schedule / task changes (frequencies, task add/remove/complete)
//   - 'feeding' → feeding actions (mark fed / skip feeding)
//
// Logging failures are always swallowed (caught + console.error'd) so a logging bug
// can never break the underlying animal save.

const { AnimalLog } = require('../database/models');

// Human-readable labels for the "core record" fields tracked under the 'field' category.
const FIELD_LABELS = {
    name: 'Name',
    prefix: 'Prefix',
    suffix: 'Suffix',
    species: 'Species',
    gender: 'Gender',
    birthDate: 'Birth Date',
    deceasedDate: 'Deceased Date',
    status: 'Status',
    lifeStage: 'Life Stage',
    color: 'Color',
    coat: 'Coat',
    coatPattern: 'Coat Pattern',
    earset: 'Earset',
    phenotype: 'Phenotype',
    morph: 'Morph',
    markings: 'Markings',
    eyeColor: 'Eye Color',
    nailColor: 'Nail Color',
    size: 'Size',
    breed: 'Breed',
    strain: 'Strain',
    geneticCode: 'Genetic Code',
    breederAssignedId: 'Breeder Assigned ID',
    breederId_public: 'Breeder',
    manualBreederName: 'Breeder Name',
    sireId_public: 'Sire (Father)',
    damId_public: 'Dam (Mother)',
    origin: 'Origin',
    isOwned: 'Currently Owned',
    archived: 'Archived',
    enclosureId: 'Enclosure',
    isNeutered: 'Neutered / Spayed',
    availableForBreeding: 'Available for Stud',
    isForSale: 'For Sale',
    salePriceAmount: 'Sale Price',
    salePriceCurrency: 'Sale Price Currency',
    studFeeAmount: 'Stud Fee',
    studFeeCurrency: 'Stud Fee Currency',
    microchipNumber: 'Microchip Number',
    pedigreeRegistrationId: 'Pedigree Registration ID',
    ringId: 'Ring ID',
    eartagNumber: 'Eartag Number',
    showOnPublicProfile: 'Public Profile Visibility',
};

const FIELD_EDIT_TRACKED_FIELDS = Object.keys(FIELD_LABELS);

const CARE_LABELS = {
    feedingFrequencyDays: 'Feeding Frequency (days)',
};
const CARE_SCALAR_FIELDS = Object.keys(CARE_LABELS);

// Dedicated, individually-tracked schedules ({ lastDoneDate, frequencyDays }) — Grooming/Special
// Care (Routine Care tab) and Training (Behavior tab, surfaced in Feeding & Care management view).
const SCHEDULE_FIELD_LABELS = {
    groomingSchedule: 'Grooming Schedule',
    brushingSchedule: 'Brushing Schedule',
    bathingSchedule: 'Bathing Schedule',
    specializedCareSchedule: 'Specialized Care Schedule',
    specialCareSchedule: 'Special Care Schedule',
    exerciseSchedule: 'Daily Exercise Schedule',
    crateTrainingSchedule: 'Crate Training Schedule',
    litterTrainingSchedule: 'Litter Training Schedule',
    leashTrainingSchedule: 'Leash Training Schedule',
    freeFlightTrainingSchedule: 'Free-Flight Training Schedule',
    workingRoleTrainingSchedule: 'Working Role Training Schedule',
    behavioralIssueTrainingSchedule: 'Behavioral Issue Training Schedule',
    reactivityTrainingSchedule: 'Reactivity Training Schedule',
    flightRiskTrainingSchedule: 'Flight Risk Training Schedule',
};

const toComparable = (value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const t = new Date(value).getTime();
        return Number.isNaN(t) ? value : t;
    }
    return value;
};

const valuesEqual = (a, b) => {
    const na = toComparable(a);
    const nb = toComparable(b);
    if (na === null && nb === null) return true;
    return na === nb;
};

/**
 * Diffs `before` vs `after` for the curated list of core "field edit" fields
 * (plus quarantine/treatment status) and, if anything changed, writes a single
 * AnimalLog entry with category 'field'.
 */
const logFieldEdits = async ({ userId, animalId, animalId_public, before, after }) => {
    try {
        const changes = [];
        for (const field of FIELD_EDIT_TRACKED_FIELDS) {
            const oldValue = before?.[field] ?? null;
            const newValue = after?.[field] ?? null;
            if (!valuesEqual(oldValue, newValue)) {
                changes.push({ field, label: FIELD_LABELS[field], oldValue, newValue });
            }
        }

        const oldQStatus = before?.quarantineDetails?.status || 'None';
        const newQStatus = after?.quarantineDetails?.status || 'None';
        if (oldQStatus !== newQStatus) {
            changes.push({ field: 'quarantineDetails.status', label: 'Quarantine Status', oldValue: oldQStatus, newValue: newQStatus });
        }

        const oldTStatus = before?.treatmentDetails?.status || 'None';
        const newTStatus = after?.treatmentDetails?.status || 'None';
        if (oldTStatus !== newTStatus) {
            changes.push({ field: 'treatmentDetails.status', label: 'Treatment Status', oldValue: oldTStatus, newValue: newTStatus });
        }

        if (changes.length === 0) return null;
        return await AnimalLog.create({ animalId, animalId_public, userId, category: 'field', changes });
    } catch (err) {
        console.error('[animalLogger] Failed to log field edits:', err && err.message ? err.message : err);
        return null;
    }
};

/**
 * Diffs `before` vs `after` for care-schedule fields (feeding/maintenance frequency)
 * and animalCareTasks array (added/removed/frequency-changed/completed tasks),
 * and if anything changed, writes a single AnimalLog entry with category 'care'.
 */
const logCareUpdates = async ({ userId, animalId, animalId_public, before, after }) => {
    try {
        const changes = [];
        for (const field of CARE_SCALAR_FIELDS) {
            const oldValue = before?.[field] ?? null;
            const newValue = after?.[field] ?? null;
            if (!valuesEqual(oldValue, newValue)) {
                changes.push({ field, label: CARE_LABELS[field], oldValue, newValue });
            }
        }

        const diffTaskList = (groupLabel, oldList = [], newList = []) => {
            const oldMap = new Map((oldList || []).map(t => [t.taskName, t]));
            const newMap = new Map((newList || []).map(t => [t.taskName, t]));

            for (const [name, task] of newMap) {
                const oldTask = oldMap.get(name);
                if (!oldTask) {
                    changes.push({ field: groupLabel, label: `${groupLabel} Added`, oldValue: null, newValue: name });
                    continue;
                }
                const oldFreq = oldTask.frequencyDays ?? null;
                const newFreq = task.frequencyDays ?? null;
                if (oldFreq !== newFreq) {
                    changes.push({ field: groupLabel, label: `${name}: Frequency`, oldValue: oldFreq, newValue: newFreq });
                }
                const oldDone = oldTask.lastDoneDate ? new Date(oldTask.lastDoneDate).getTime() : null;
                const newDone = task.lastDoneDate ? new Date(task.lastDoneDate).getTime() : null;
                if (newDone && oldDone !== newDone) {
                    changes.push({
                        field: groupLabel,
                        label: task.lastSkipped ? `${name}: Skipped` : `${name}: Completed`,
                        oldValue: null,
                        newValue: name,
                    });
                }
            }
            for (const [name] of oldMap) {
                if (!newMap.has(name)) {
                    changes.push({ field: groupLabel, label: `${groupLabel} Removed`, oldValue: name, newValue: null });
                }
            }
        };

        diffTaskList('Animal Care Task', before?.animalCareTasks, after?.animalCareTasks);

        // Diff each dedicated schedule field (frequency changes + mark-done/skip events)
        for (const [field, label] of Object.entries(SCHEDULE_FIELD_LABELS)) {
            const oldSched = before?.[field];
            const newSched = after?.[field];

            const oldFreq = oldSched?.frequencyDays ?? null;
            const newFreq = newSched?.frequencyDays ?? null;
            if (oldFreq !== newFreq) {
                changes.push({ field, label: `${label}: Frequency`, oldValue: oldFreq, newValue: newFreq });
            }

            const oldDone = oldSched?.lastDoneDate ? new Date(oldSched.lastDoneDate).getTime() : null;
            const newDone = newSched?.lastDoneDate ? new Date(newSched.lastDoneDate).getTime() : null;
            if (newDone && oldDone !== newDone) {
                changes.push({
                    field,
                    label: newSched?.lastSkipped ? `${label}: Skipped` : `${label}: Completed`,
                    oldValue: null,
                    newValue: label,
                });
            }
        }

        if (changes.length === 0) return null;
        return await AnimalLog.create({ animalId, animalId_public, userId, category: 'care', changes });
    } catch (err) {
        console.error('[animalLogger] Failed to log care updates:', err && err.message ? err.message : err);
        return null;
    }
};

/**
 * Logs a single feeding action (mark fed / skip feeding) with category 'feeding'.
 */
const logFeedingEvent = async ({ userId, animalId, animalId_public, foodName, quantity, notes, skipped }) => {
    try {
        const changes = [
            { field: 'lastFedDate', label: skipped ? 'Feeding Skipped' : 'Fed', oldValue: null, newValue: new Date() },
        ];
        if (foodName) changes.push({ field: 'food', label: 'Food', oldValue: null, newValue: foodName });
        if (quantity !== undefined && quantity !== null && quantity !== '') {
            changes.push({ field: 'quantity', label: 'Quantity', oldValue: null, newValue: quantity });
        }
        if (notes) changes.push({ field: 'notes', label: 'Notes', oldValue: null, newValue: notes });

        return await AnimalLog.create({ animalId, animalId_public, userId, category: 'feeding', changes });
    } catch (err) {
        console.error('[animalLogger] Failed to log feeding event:', err && err.message ? err.message : err);
        return null;
    }
};

/**
 * Logs the creation of a new animal record with category 'field'.
 */
const logAnimalCreated = async ({ userId, animalId, animalId_public, name }) => {
    try {
        return await AnimalLog.create({
            animalId,
            animalId_public,
            userId,
            category: 'field',
            changes: [{ field: 'created', label: 'Animal Record Created', oldValue: null, newValue: name || animalId_public }],
        });
    } catch (err) {
        console.error('[animalLogger] Failed to log animal creation:', err && err.message ? err.message : err);
        return null;
    }
};

module.exports = {
    logFieldEdits,
    logCareUpdates,
    logFeedingEvent,
    logAnimalCreated,
    FIELD_LABELS,
    CARE_LABELS,
};
