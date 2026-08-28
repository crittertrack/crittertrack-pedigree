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

const { Animal, AnimalLog } = require('../database/models');

// Curated label overrides for the auto-generated tracked-field list below (FIELD_EDIT_TRACKED_FIELDS)
// — any scalar field not listed here still gets tracked, just with a camelCase -> Title Case fallback.
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
    earset: 'Earset',
    morph: 'Morph',
    markings: 'Markings',
    eyeColor: 'Eye Color',
    body: 'Body',
    breed: 'Breed',
    strain: 'Strain',
    geneticCode: 'Genetic Code',
    breederAssignedId: 'Breeder Assigned ID',
    breederId_public: 'Breeder',
    manualBreederName: 'Breeder Name',
    sireId_public: 'Sire (Father)',
    damId_public: 'Dam (Mother)',
    origin: 'Origin',
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
};

const CARE_LABELS = {
    feedingIntervalHours: 'Feeding Interval (hours)',
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
    nailCareSchedule: 'Nail/Claw/Hoof Care Schedule',
    beakHoofScaleSchedule: 'Beak/Hoof/Scale Maintenance Schedule',
    skinEarCareSchedule: 'Skin & Ear Care Schedule',
    dentalCareSchedule: 'Dental Care Schedule',
    healthMonitoringSchedule: 'Special Observations Schedule',
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
const SCHEDULE_FIELDS = new Set(Object.keys(SCHEDULE_FIELD_LABELS));

// System/internal/computed fields — must NEVER be logged as field edits.
const EXCLUDED_FIELDS = new Set([
    '_id', '__v', 'id_public', 'creatorId', 'creatorId_public', 'originalCreatorId', 'soldStatus',
    'viewOnlyForUsers', 'pendingTransferId', 'hiddenForUsers', 'healthStatus', 'isInTreatment',
    'isPlannedMating', 'inbreedingCoefficient', 'sbId', 'litterId', 'timelineNotes', 'pinnedEvents',
    'measurementUnits', 'manualPedigree', 'createdAt', 'updatedAt',
    // isOwned/isDisplay flip frequently (transfers, batch visibility toggles)
    // and were crowding the timeline with noise — excluded from field-edit logging entirely.
    'isOwned', 'isDisplay',
]);

// Scalar fields already surfaced via their own derived timeline-event types (health/breeding/
// ownership) in TimelineTabContent.jsx & AnimalFormModalV2.jsx's aggregateAllEvents — excluded here
// so the same change doesn't show up twice on the timeline.
const DERIVED_EVENT_FIELDS = new Set([
    'spayNeuterDate', 'lastHeatDate', 'lastMatingDate', 'expectedDueDate', 'nursingStartDate',
    'weaningDate', 'lastPregnancyDate', 'purchaseDate', 'saleDate',
]);

// Fields already logged under the 'care'/'feeding' categories elsewhere in this file — excluded
// from the 'field' category so they don't get logged twice.
const CARE_OR_FEEDING_TRACKED_FIELDS = new Set([...CARE_SCALAR_FIELDS, 'lastFedDate']);

const SCALAR_TYPES = new Set(['String', 'Number', 'Boolean', 'Date']);
const toTitleCase = (field) => field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
const getFieldLabel = (field) => FIELD_LABELS[field] || toTitleCase(field);

// Auto-derive every trackable top-level scalar field straight from the Mongoose schema instead of
// hand-maintaining a small allowlist, so newly added Animal fields get logged automatically.
// Also captures each field's static schema default (if any) — needed so a field that was never
// actually stored in the DB (before = undefined) isn't falsely diffed against Mongoose's
// auto-applied default on the freshly-hydrated `after` document (see FIELD_DEFAULTS usage below).
const FIELD_DEFAULTS = {};
const buildTrackedFieldList = () => {
    const fields = [];
    Animal.schema.eachPath((path, schemaType) => {
        if (path.includes('.') || EXCLUDED_FIELDS.has(path) || DERIVED_EVENT_FIELDS.has(path) || SCHEDULE_FIELDS.has(path) || CARE_OR_FEEDING_TRACKED_FIELDS.has(path)) return;
        if (!SCALAR_TYPES.has(schemaType.instance)) return;
        fields.push(path);
        const def = schemaType.options?.default;
        if (def !== undefined && typeof def !== 'function') {
            FIELD_DEFAULTS[path] = def;
        }
    });
    return fields;
};
const FIELD_EDIT_TRACKED_FIELDS = buildTrackedFieldList();

// Array/list fields with no dedicated derived-event generation elsewhere (Health tab-only
// conditions/allergies, gallery, misc records) — logged as a single generic "Updated" entry per
// save rather than diffed item-by-item, since they have no stable per-item key to diff against.
const GENERIC_ARRAY_FIELDS = {
    tags: 'Tags',
    extraImages: 'Extra Images',
    medicalConditions: 'Medical Conditions',
    allergies: 'Allergies',
    healthClearances: 'Health Clearances',
    growthRecords: 'Growth Records',
    keeperHistory: 'Keeper History',
    legalDocuments: 'Legal Documents',
    parasitePreventionSchedule: 'Parasite Prevention Schedule',
};

const toComparable = (value) => {
    // Treat "no value" consistently regardless of whether it arrived as undefined, null, or an
    // empty string (forms routinely send '' for untouched text fields while the DB has the field
    // as missing/null) — otherwise these compare as "different" forever, on every save.
    if (value === undefined || value === null || value === '') return null;
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
 * Diffs `before` vs `after` for every trackable core "field edit" field (auto-derived from the
 * Animal schema, see FIELD_EDIT_TRACKED_FIELDS) plus quarantine/treatment status and the generic
 * array/list fields. Each individual change gets its OWN AnimalLog document (category 'field') —
 * never piled together into one entry — so the Timeline shows one card per actual change.
 */
const logFieldEdits = async ({ userId, animalId, animalId_public, before, after }) => {
    try {
        const changes = [];
        for (const field of FIELD_EDIT_TRACKED_FIELDS) {
            // Fall back to the field's own schema default (not a hardcoded null) when a value is
            // missing, so a never-touched field doesn't falsely diff against Mongoose's auto-applied
            // default on the hydrated `after` document (before is always fetched via .lean(), which
            // never applies defaults, so an untouched field would otherwise look like undefined -> default).
            const fallback = FIELD_DEFAULTS[field] !== undefined ? FIELD_DEFAULTS[field] : null;
            const oldValue = before?.[field] ?? fallback;
            const newValue = after?.[field] ?? fallback;
            if (!valuesEqual(oldValue, newValue)) {
                changes.push({ field, label: getFieldLabel(field), oldValue, newValue });
            }
        }

        for (const [field, label] of Object.entries(GENERIC_ARRAY_FIELDS)) {
            const oldArr = JSON.stringify(before?.[field] || []);
            const newArr = JSON.stringify(after?.[field] || []);
            if (oldArr !== newArr) {
                changes.push({ field, label: `${label} Updated`, oldValue: null, newValue: null });
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
        return await AnimalLog.insertMany(
            changes.map(change => ({ animalId, animalId_public, userId, category: 'field', changes: [change] }))
        );
    } catch (err) {
        console.error('[animalLogger] Failed to log field edits:', err && err.message ? err.message : err);
        return null;
    }
};

/**
 * Diffs `before` vs `after` for care-schedule fields (feeding/maintenance frequency)
 * and animalCareTasks array (added/removed/frequency-changed/completed tasks). Each individual
 * change gets its OWN AnimalLog document (category 'care') rather than being piled together.
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
                        label: name,
                        oldValue: null,
                        newValue: task.lastSkipped ? 'Skipped' : 'Completed',
                    });
                }
            }
            for (const [name] of oldMap) {
                if (!newMap.has(name)) {
                    changes.push({ field: groupLabel, label: `${groupLabel} Removed`, oldValue: null, newValue: name });
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
                    label,
                    oldValue: null,
                    newValue: newSched?.lastSkipped ? 'Skipped' : 'Completed',
                });
            }
        }

        if (changes.length === 0) return null;
        return await AnimalLog.insertMany(
            changes.map(change => ({ animalId, animalId_public, userId, category: 'care', changes: [change] }))
        );
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
