/**
 * healthStatusSync.js
 *
 * Single source of truth for computing an animal's `isInTreatment` flag and overall
 * `healthStatus` pill from its own medical records — mirrors reproStatusSync.js's approach
 * for reproductive flags. Neither is manually-toggled: isInTreatment always reflects whether
 * the animal currently has an active medication or an active critical medical condition, and
 * healthStatus is a score derived from quarantine/treatment/medications/conditions/allergies
 * (see calculateHealthStatus in the frontend's utils/medicalStatus.js, which this mirrors).
 * Both are recomputed on every save (see db_service.js).
 *
 * treatmentDetails/treatmentHistory remain manually-editable descriptive
 * metadata (type/reason/dates) for record-keeping, but no longer drive the
 * isInTreatment boolean themselves.
 */

const parseArrayField = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

// Mirrors crittertrack-frontend/src/utils/dateFormatter.js's isStatusPeriodActive: a
// quarantine/treatment period is only "active" once its start date has arrived and, if set,
// its end date hasn't passed yet (using UTC calendar-date string comparison).
function isStatusPeriodActive(details) {
    if (!details || !details.status || details.status === 'None') return false;
    if (!details.startDate) return false;
    const toUTCDateString = (value) => new Date(value).toISOString().slice(0, 10);
    const todayStr = toUTCDateString(new Date());
    const startStr = toUTCDateString(details.startDate);
    if (startStr > todayStr) return false;
    if (details.endDate) {
        const endStr = toUTCDateString(details.endDate);
        if (endStr < todayStr) return false;
    }
    return true;
}

function hasActiveMedication(medications) {
    return parseArrayField(medications).some(m =>
        (!m.status || m.status === 'active') && (!m.stopDate || new Date(m.stopDate) >= new Date())
    );
}

function hasActiveCriticalCondition(medicalConditions) {
    return parseArrayField(medicalConditions).some(c => c.status === 'active' && c.severity === 'critical');
}

/**
 * Pure computation of isInTreatment from an animal's medications and medicalConditions.
 */
function computeIsInTreatment({ medications, medicalConditions }) {
    return hasActiveMedication(medications) || hasActiveCriticalCondition(medicalConditions);
}

// Per-type quarantine score deductions (see the Type/Reason dropdown in the frontend's
// AnimalFormModalV2.jsx / AssignHealthStatusModal.jsx for the full option list) — mirrors
// crittertrack-frontend/src/utils/medicalStatus.js. Preventive types don't deduct at all;
// Contagious Disease and Aggression are weighted heaviest since they alone must reach Critical.
const QUARANTINE_TYPE_PENALTIES = {
    'Preventive - New Arrival': 0,
    'Preventive - Intake': 0,
    'Medical - Illness/URI': 1.75,
    'Medical - Contagious Disease': 3.5,
    'Medical - Recovery': 1,
    'Behavioral - Aggression': 3.25,
    'Behavioral - Fear/Stress': 0.75,
    'Other': 1.6,
};
const DEFAULT_QUARANTINE_PENALTY = 1.25; // No type selected yet, or an unrecognized value

// Animals saved before the Excellent/Good/Fair/Poor/Critical -> Healthy/Monitoring/Concern/
// Critical rename still have old labels stored in healthStatus/healthStatusOverride. Remap on
// read instead of a DB migration — Poor and Critical both collapse into the new Critical tier.
const LEGACY_HEALTH_STATUS_MAP = {
    Excellent: 'Healthy',
    Good: 'Monitoring',
    Fair: 'Concern',
    Poor: 'Critical',
    Critical: 'Critical',
};
function remapLegacyHealthStatus(status) {
    if (!status) return status;
    return LEGACY_HEALTH_STATUS_MAP[status] || status;
}

/**
 * Pure computation of the overall health status (Healthy/Monitoring/Concern/Critical), mirroring
 * crittertrack-frontend/src/utils/medicalStatus.js's calculateHealthStatus exactly. Returns just
 * the calculated status string (pre-override) — healthStatusOverride, if set, is applied by the
 * caller/frontend on top of this, since the override itself is stored/displayed separately.
 */
function computeHealthStatus({ quarantineDetails, medications, medicalConditions, allergies }) {
    const medsArr = parseArrayField(medications);
    const conditionsArr = parseArrayField(medicalConditions);
    const allergiesArr = parseArrayField(allergies);
    const quarantine = quarantineDetails || {};

    let score = 5; // Start at excellent

    if (isStatusPeriodActive(quarantine)) {
        const penalty = QUARANTINE_TYPE_PENALTIES[quarantine.type] ?? DEFAULT_QUARANTINE_PENALTY;
        score -= penalty;
    }

    if (computeIsInTreatment({ medications, medicalConditions })) {
        score -= 1.5;
    }

    if (medsArr.length > 0) score -= Math.min(medsArr.length, 2);
    if (conditionsArr.length > 0) score -= Math.min(conditionsArr.length, 2);
    if (allergiesArr.length > 2) score -= 0.5;

    if (score >= 4.5) return 'Healthy';
    if (score >= 3.5) return 'Monitoring';
    if (score >= 2.0) return 'Concern';
    return 'Critical';
}

module.exports = { computeIsInTreatment, hasActiveMedication, hasActiveCriticalCondition, computeHealthStatus, isStatusPeriodActive, remapLegacyHealthStatus };
