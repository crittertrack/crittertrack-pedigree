const { D } = require('./base_core');
const HR = (o) => Object.assign({ id: o.id, name: o.name || null, date: o.date ? D(o.date) : null, notes: o.notes || null, status: o.status || null, severity: o.severity || null }, o.x || {});
function repro(o) {
  return {
    isNeutered: false, heatStatus: o.heat || null, lastHeatDate: o.heatDate ? D(o.heatDate) : null,
    ovulationDate: null, expectedDueDate: o.due ? D(o.due) : null,
    litterCount: o.litters ?? null, litterSizeBorn: o.bornN ?? null, litterSizeWeaned: o.weanedN ?? null,
    stillbornCount: o.stillN ?? null, nursingStartDate: o.nurse ? D(o.nurse) : null, weaningDate: o.wean ? D(o.wean) : null,
    breedingRole: o.role || null, lastMatingDate: o.mated ? D(o.mated) : null,
    successfulMatings: o.succ ?? null, lastPregnancyDate: o.preg ? D(o.preg) : null, offspringCount: o.kids ?? null,
    availableForBreeding: !!o.stud, studFeeCurrency: 'USD', studFeeAmount: o.fee ?? null,
    fertilityStatus: o.fert || 'Unknown', fertilityNotes: o.fertN || null,
    estrusCycleLength: 5, gestationLength: 22, artificialInseminationUsed: false,
    deliveryMethod: o.deliv || null, reproductiveComplications: o.reproC || null, reproductiveClearances: o.reproOk || null,
    breedingRecords: o.recs || [],
    isForSale: !!o.sale, salePriceCurrency: 'USD', salePriceAmount: o.price ?? null, isInfertile: false,
    vaccinations: o.vax || [], dewormingRecords: o.dew || [], parasiteControl: o.par || [],
    medicalConditions: o.cond || [], allergies: o.alg || [], medications: o.med || [],
    medicalProcedures: o.proc || [], labResults: o.lab || [], vetVisits: o.vet || [],
    primaryVet: 'Dr. Alvarez, Maple Street Vet Clinic',
    spayNeuterDate: null,
    parasitePreventionSchedule: o.parSched || [],
    heartwormStatus: null, hipElbowScores: null, geneticTestResults: null, eyeClearance: null,
    sheddingRecords: null, moltingRecords: null, waterParameterChecks: null, cardiacClearance: null,
    dentalRecords: o.dent || null, chronicConditions: o.chron || null,
    healthClearances: o.clear || [],
  };
}
module.exports = { HR, repro };
