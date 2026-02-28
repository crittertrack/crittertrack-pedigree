# UI Implementation Plan for Field Template System

## Overview

This document outlines the UI implementation plan for integrating the field template system with tab categorization into the CritterTrack frontend, while preserving existing detail view functionality.

### Current Database Usage (as of Feb 2026)

**Total Animals: 1,058**

| Species | Count | % of Total | Template Mapping |
|---------|-------|------------|------------------|
| Fancy Mouse | 948 | 89.6% | Small Mammal Template |
| Fancy Rat | 95 | 9.0% | *Small Mammal Template (needs update) |
| Guinea Pig | 5 | 0.5% | Small Mammal Template |
| Cat | 4 | 0.4% | Full Mammal Template |
| Fat-tailed gerbil | 2 | 0.2% | *Other Template (needs update) |
| Campbells Dwarf Hamster | 2 | 0.2% | *Other Template (needs update) |
| Corn Snake | 1 | 0.1% | Reptile Template |
| Dog | 1 | 0.1% | Full Mammal Template |

**Key Insights:**
- **Fancy Mouse dominates** at 89.6% of all animals - UI must prioritize this species
- **Small mammals** (mouse, rat, guinea pig, gerbil, hamster) = 99.2% of database
- **Full mammals** (cat, dog) = 0.5% of database
- **Reptiles** (corn snake) = 0.1% of database
- **Other species groups** (Bird, Fish, Amphibian, Invertebrate) = Currently unused

**Priority Implementation Order:**
1. **CRITICAL**: Small Mammal Template (covers 948+ animals, 90%+ of database)
2. **HIGH**: Full Mammal Template (covers 5 animals)
3. **MEDIUM**: Reptile Template (covers 1 animal)
4. **LOW**: Bird, Fish, Amphibian, Invertebrate, Other Templates (currently unused)

*Note: Some species mappings need updating in the classification system (Fancy Rat should use Small Mammal Template instead of Other)

## Current UI State (Preserve As-Is)

### Detail View (Read-Only)
**Location**: `crittertrack-frontend/src/app.jsx` lines ~2434-2900
**Behavior**: Fields appear in multiple tabs for better UX
- **Overview Tab**: Shows variety, genetic code, identification numbers, parents
- **Physical Tab**: Re-shows variety, genetic code, measurements  
- **Identification Tab**: Re-shows identification numbers, species/breed
- **Status**: Must remain exactly as-is (no breaking changes)

### Current Tab Structure (Detail View)
1. Overview
2. Status & Privacy  
3. Physical
4. Identification
5. Lineage
6. Breeding
7. Health
8. Husbandry
9. Behavior
10. Records
11. End of Life
12. **Legal & Documentation** (NEW TAB)

## New UI Components to Implement

### 1. Edit Mode with Field Templates
**Purpose**: Create tabbed edit forms using field template categorizations
**Location**: New component or enhanced existing edit modal
**Requirements**:
- Load species-specific field template from backend
- Organize fields by tab categories (12 tabs)
- NO field duplication in edit mode
- Dynamic field enabling/disabling based on template

### 2. Tab-Based Edit Form Component
```javascript
// Component Structure
const TabBasedEditForm = ({ 
    animal, 
    fieldTemplate, 
    onSave, 
    onCancel 
}) => {
    // Implementation details below
}
```

### 3. Field Template Integration

#### Backend API Endpoints Needed
```javascript
// Get field template for species
GET /api/field-templates/:species

// Response format:
{
    "templateName": "Small Mammal Template",
    "fields": [
        {
            "fieldName": "prefix",
            "label": "Prefix", 
            "enabled": true,
            "required": false,
            "tab": "Overview"
        },
        // ... more fields
    ]
}
```

## 🚨 RISK MITIGATION STRATEGY 🚨

### Critical Risk Assessment

**THE DANGER:**
- Small Mammal Template affects **948 Fancy Mouse records (90% of database)**
- ONE bug could break viewing/editing for nearly all active users
- Data corruption risk affects real user animals with breeding records, lineages, and history
- This is **PRODUCTION DATA** - mistakes are not acceptable

### Safety-First Implementation Approach

#### Strategy 1: Test on Unused Templates First ⭐ RECOMMENDED
```
Phase 1: Implement Bird Template UI (0 animals - safe to break)
Phase 2: Test thoroughly, gather feedback
Phase 3: Implement Fish Template UI (0 animals - safe to break)  
Phase 4: Test, refine, document issues
Phase 5: Implement Amphibian/Invertebrate (0 animals - safe to break)
Phase 6: After 100% confidence, implement Small Mammal Template
```

**Benefits:**
- ✅ Zero risk to production data
- ✅ Real-world testing of field grouping logic
- ✅ UI/UX refinement without consequences
- ✅ Bug discovery on templates that don't matter
- ✅ Build confidence before touching critical data

#### Strategy 2: Feature Flag with Gradual Rollout
```javascript
// Backend feature flag system
const FEATURE_FLAGS = {
  FIELD_TEMPLATES_ENABLED: {
    'Small Mammal': false,  // Keep OFF until fully tested
    'Full Mammal': false,
    'Reptile': true,        // Start with low-impact species
    'Bird': true,           // Safe - no animals
    'Fish': true,           // Safe - no animals
    'Amphibian': true,      // Safe - no animals
    'Invertebrate': true    // Safe - no animals
  }
};

// Gradual rollout
// Week 1: Enable for Reptile (1 animal)
// Week 2: Enable for Full Mammal (5 animals) 
// Week 3: Enable for 10% of Fancy Mouse users
// Week 4: Enable for 50% of Fancy Mouse users
// Week 5: Full rollout if zero issues
```

#### Strategy 3: Comprehensive Backup & Rollback Plan
```bash
# BEFORE any implementation:
# 1. Full database backup
mongodump --uri="$MONGODB_URI" --out=/backups/pre-template-implementation-$(date +%Y%m%d)

# 2. Test restoration process
mongorestore --uri="$MONGODB_URI_TEST" --nsInclude="crittertrack.*" /backups/pre-template-implementation-*

# 3. Document rollback procedure
# 4. Have rollback script ready to execute in < 5 minutes
```

#### Strategy 4: Read-Only Mode First
```javascript
// Phase 1: View-only implementation (NO editing)
const TEMPLATE_MODE = {
  'Small Mammal': 'VIEW_ONLY',  // Can't break data if can't edit
  'Full Mammal': 'VIEW_ONLY',
  // ... etc
};

// Phase 2: After 2+ weeks of view-only with zero issues
// Enable editing for ONE test user account only

// Phase 3: Gradual editing rollout
```

### Testing Requirements (Before Small Mammal Template)

#### Unit Tests (Required)
- [ ] Field template loading
- [ ] Field grouping logic
- [ ] Tab navigation
- [ ] Data validation
- [ ] Save/cancel operations
- [ ] 100% code coverage on critical paths

#### Integration Tests (Required)
- [ ] End-to-end animal viewing
- [ ] End-to-end animal editing
- [ ] Field template switching
- [ ] Data persistence
- [ ] Error handling and recovery

#### User Acceptance Testing (Required)
- [ ] Test with 5+ beta users on Bird template (0 risk)
- [ ] Test with 5+ beta users on Reptile template (1 animal risk)
- [ ] Create 50+ test animals with various field combinations
- [ ] Test edge cases: empty fields, special characters, long text
- [ ] Test on mobile, tablet, desktop
- [ ] Test with slow connections

#### Load Testing (Required)
- [ ] Test with 1000+ animal records
- [ ] Measure template load time
- [ ] Measure save operation time
- [ ] Ensure no memory leaks
- [ ] Ensure no performance degradation

### Monitoring & Alerts (Production)

```javascript
// Real-time error monitoring
const CRITICAL_ALERTS = {
  animalLoadFailure: {
    threshold: 1,  // Alert on FIRST failure
    action: 'IMMEDIATE_ROLLBACK'
  },
  animalSaveFailure: {
    threshold: 1,
    action: 'IMMEDIATE_ROLLBACK'  
  },
  dataCorruption: {
    threshold: 1,
    action: 'IMMEDIATE_ROLLBACK'
  }
};

// Automatic rollback trigger
if (errorCount > threshold) {
  await disableFeatureFlag('FIELD_TEMPLATES_ENABLED');
  await notifyDevTeam('CRITICAL: Auto-rollback triggered');
  await revertToLegacyUI();
}
```

### Data Integrity Verification

```javascript
// Before and after implementation
const integrityChecks = [
  'All 948 fancy mice still loadable',
  'No missing field data',
  'No corrupted lineages',
  'All images still display',
  'All breeding records intact',
  'Pedigree chains unbroken'
];

// Run after EVERY change
await verifyDataIntegrity(integrityChecks);
```

## Implementation Phases (REVISED FOR SAFETY)

### Phase 0: Classification System Update (Priority: CRITICAL)
**Before UI implementation, fix species-to-template mappings:**
- [ ] Update "Fancy Rat" mapping from "Other Template" → "Small Mammal Template"
- [ ] Update "Fat-tailed gerbil" mapping from "Other Template" → "Small Mammal Template"
- [ ] Update "Campbells Dwarf Hamster" mapping from "Other Template" → "Small Mammal Template"
- [ ] Run migration to update existing 99 animals with corrected templates
- [ ] This ensures 99.7% of database uses Small Mammal Template consistently

### Phase 1: Backend API (Priority 1 - SAFE TEMPLATES ONLY)
- [ ] Create field template API endpoint
- [ ] Implement template retrieval by species
- [ ] Test with existing animals
- [ ] **TEST ONLY WITH: Bird, Fish, Amphibian, Invertebrate templates (0 animals - zero risk)**

### Phase 2: Edit Form Component (Priority 1 - SAFE TEMPLATES ONLY)
- [ ] Create `FieldTemplateEditForm` component
- [ ] Implement 12-tab structure matching template system
- [ ] Add field rendering logic based on template
- [ ] Integrate with existing edit modal/page
- [ ] **INITIALLY ENABLE ONLY FOR: Bird template (0 animals - can't break anything)**
- [ ] Group fields by tab category
- [ ] Implement conditional rendering (enabled/disabled fields)
- [ ] Add required field validation
- [ ] Style consistently with existing design

### Phase 3: Testing & Refinement on Safe Templates (Priority 1 - REQUIRED)
- [ ] Deploy Bird template UI to production
- [ ] Create test birds, gather user feedback for 2+ weeks
- [ ] Fix all discovered bugs
- [ ] Implement Fish template UI
- [ ] Test for another 2+ weeks
- [ ] Implement Amphibian & Invertebrate templates
- [ ] **DO NOT proceed to Phase 4 until ZERO bugs for 30 consecutive days**

### Phase 4: Low-Risk Species Testing (Priority 2 - CONTROLLED ROLLOUT)
- [ ] Enable for Reptile template (1 animal - Corn Snake - minimal impact)
- [ ] Monitor closely for 1+ week, contact owner for feedback
- [ ] Enable for Full Mammal template (5 animals - Cat/Dog - low impact)
- [ ] Monitor closely for 2+ weeks, gather all user feedback
- [ ] **DO NOT proceed to Phase 5 without explicit approval and sign-off**

### Phase 5: Small Mammal Pilot Program (Priority 3 - EXTREME CAUTION)
- [ ] Feature flag: Enable ONLY for 5 trusted beta users with fancy mice
- [ ] READ-ONLY mode first (viewing, no editing)
- [ ] Monitor every interaction for 1 week
- [ ] Enable editing for beta users only
- [ ] Gather detailed feedback
- [ ] Fix any issues immediately
- [ ] Expand to 25 users (2-3% of fancy mouse owners)
- [ ] Monitor for 2+ weeks
- [ ] **ROLLBACK IMMEDIATELY if ANY data issues detected**

### Phase 6: Gradual Small Mammal Rollout (Priority 3 - MEASURED APPROACH)
- [ ] 10% of fancy mouse users (if Phase 5 perfect)
- [ ] Monitor for 1 week, check error rates
- [ ] 25% of fancy mouse users
- [ ] Monitor for 1 week
- [ ] 50% of fancy mouse users
- [ ] Monitor for 1 week  
- [ ] 75% of fancy mouse users
- [ ] Monitor for 1 week
- [ ] 100% rollout (only after ALL phases successful with zero data loss)

### Phase 7: Enhanced UX Features (Priority 4 - AFTER FULL ROLLOUT)
- [ ] Tab indicators showing filled/empty status
- [ ] Field validation per tab
- [ ] Progress indication across tabs
- [ ] Auto-save functionality
- [ ] Advanced field grouping optimizations

## Tab Implementation Details

### Tab Categories (12 Tabs)
1. **Overview** - Core identity, appearance, breeding/sale status
2. **Status & Privacy** - Ownership, privacy, co-ownership
3. **Physical** - Size, weight, appearance, morphology  
4. **Identification** - Registration numbers, microchips, IDs
5. **Lineage** - Origin, ancestry, genetic history
6. **Breeding** - Reproduction, fertility, matings, offspring
7. **Health** - Medical records, vaccinations, conditions
8. **Husbandry** - Housing, diet, environmental needs
9. **Behavior** - Temperament, training, social behavior
10. **Records** - Shows, competitions, achievements  
11. **End of Life** - Death records, necropsy, final care
12. **Legal & Documentation** - Permits, restrictions, insurance, compliance

### Field Grouping for Consistent Display

#### Complete Field Group Mapping (All Species)
Every field needs consistent placement and grouping across species. Here's the comprehensive mapping:

#### 0. Core Universal Fields (All Species)
```javascript
// These fields are ENABLED in ALL 8 templates and should always be accessible
const CORE_UNIVERSAL_FIELDS = {
  ALL_SPECIES: [
    // Core identity (from Core Fields section in FIELD_TEMPLATES.md)
    'name',              // Animal name (always available)
    'species',           // Species type (always available)
    'gender',            // Male/Female/Intersex/Unknown (always available)
    'birthDate',         // Birth/Hatch date (always available)
    'deceasedDate',      // Date of death (always available)
    'status',            // Pet/Breeder/Show/Working (always available)
    'id_public',         // Public ID (always available)
    
    // Ownership (always available)
    'ownerId',           // Backend owner reference
    'ownerId_public',    // Public owner ID
    'isOwned',           // Currently owned status
    'isDisplay',         // Public profile status
    
    // Universal enabled fields (enabled in ALL 8 templates)
    'prefix',            // Name prefix
    'suffix',            // Name suffix
    'color',             // Base color (universal across all species)
    'currentOwnerDisplay', // Owner display name
    'remarks',           // General notes/remarks
    'keeperHistory',  // Ownership history
    'breederAssignedId', // Breeder ID
    'pedigreeRegistrationId', // Registration #
    
    // Lineage (always available)
    'sireId_public',     // Father
    'damId_public',      // Mother
    'breederId_public',  // Breeder
    'origin',            // Origin (enabled in all templates)
    
    // Status fields (always available)
    'isPregnant',        // Pregnancy status
    'isNursing',         // Nursing status
    'isTransferred',     // Transfer status
    
    // Display/images (always available)
    'imageUrl',          // Image URL
    'tags'               // Organization tags
  ]
};
```

#### 1. Identity & Core Information
```javascript
const IDENTITY_FIELDS = {
  'Small Mammal': ['name', 'gender', 'prefix', 'suffix', 'breed', 'strain', 'geneticCode'],
  'Full Mammal': ['name', 'gender', 'prefix', 'suffix', 'breed', 'strain', 'geneticCode'],
  'Reptile': ['name', 'gender', 'prefix', 'suffix', 'species', 'subspecies', 'morph', 'geneticCode'],
  'Bird': ['name', 'gender', 'prefix', 'suffix', 'species', 'breed', 'strain', 'geneticCode'],
  'Fish': ['name', 'gender', 'prefix', 'suffix', 'species', 'strain', 'geneticCode'],
  'Amphibian': ['name', 'gender', 'prefix', 'suffix', 'species', 'subspecies', 'morph', 'geneticCode'],
  'Invertebrate': ['name', 'gender', 'prefix', 'suffix', 'species', 'subspecies', 'morph'],
  'Other': ['name', 'gender', 'prefix', 'suffix', 'breed', 'strain', 'geneticCode']
};
```

#### +1. Ownership & Privacy Status  
```javascript
const OWNERSHIP_FIELDS = {
  'Small Mammal': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay', 'coOwnership'],
  'Full Mammal': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay', 'coOwnership'],
  'Reptile': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay'],
  'Bird': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay'],
  'Fish': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay'],
  'Amphibian': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay'],
  'Invertebrate': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay'],
  'Other': ['currentOwner', 'currentOwnerDisplay', 'isOwned', 'isDisplay', 'coOwnership']
};
```

#### 2. Appearance/Variety Display
```javascript
const VARIETY_FIELDS = {
  'Small Mammal': ['color', 'coatPattern', 'coat', 'earset'],
  'Full Mammal': ['color', 'coatPattern', 'coat', 'earset'], 
  'Reptile': ['color', 'pattern', 'scaleType', 'scaleShed'],
  'Bird': ['color', 'coatPattern', 'featherType', 'crestType'],
  'Fish': ['color', 'pattern', 'finType', 'bodyShape'],
  'Amphibian': ['color', 'pattern', 'skinTexture', 'skinMoisture'],
  'Invertebrate': ['color', 'pattern', 'exoskeletonType', 'bodySegmentation'],
  'Other': ['color', 'coatPattern', 'coat', 'morph']
};
```

#### 3. Physical Markings & Details
```javascript
const MARKINGS_FIELDS = {
  'Small Mammal': ['markings', 'eyeColor', 'nailColor'],
  'Full Mammal': ['markings', 'eyeColor', 'nailColor'],
  'Reptile': ['markings', 'eyeColor', 'scaleDamage'],
  'Bird': ['markings', 'eyeColor', 'beakColor', 'legColor'],
  'Fish': ['markings', 'eyeColor', 'finDamage'],
  'Amphibian': ['markings', 'eyeColor', 'skinDamage'],
  'Invertebrate': ['markings', 'eyeColor', 'limbDamage'],
  'Other': ['markings', 'eyeColor']
};
```

#### 4. Size & Measurements
```javascript
const MEASUREMENT_FIELDS = {
  'Small Mammal': ['weight', 'bodyLength', 'bodyConditionScore'],
  'Full Mammal': ['weight', 'bodyLength', 'heightAtWithers', 'chestGirth', 'bodyConditionScore'],
  'Reptile': ['weight', 'length', 'girth', 'bodyConditionScore'],
  'Bird': ['weight', 'wingspan', 'bodyLength', 'bodyConditionScore'],
  'Fish': ['weight', 'length', 'girth', 'bodyConditionScore'],
  'Amphibian': ['weight', 'length', 'bodyConditionScore'],
  'Invertebrate': ['weight', 'length', 'wingSpan', 'bodyConditionScore'],
  'Other': ['weight', 'length', 'bodyConditionScore']
};
```

#### 5. Identification Numbers
```javascript
const IDENTIFICATION_FIELDS = {
  'Small Mammal': ['breederAssignedId', 'pedigreeRegistrationId', 'microchipNumber'],
  'Full Mammal': ['breederAssignedId', 'pedigreeRegistrationId', 'microchipNumber', 'tattooId', 'akcRegistrationNumber', 'cfaRegistrationNumber'],
  'Reptile': ['breederAssignedId', 'pedigreeRegistrationId', 'microchipNumber'],
  'Bird': ['breederAssignedId', 'pedigreeRegistrationId', 'microchipNumber', 'bandNumber'],
  'Fish': ['breederAssignedId', 'pedigreeRegistrationId'],
  'Amphibian': ['breederAssignedId', 'pedigreeRegistrationId'],
  'Invertebrate': ['breederAssignedId', 'pedigreeRegistrationId'],
  'Other': ['breederAssignedId', 'pedigreeRegistrationId', 'microchipNumber']
};
```

#### 6. Life Stage & Status
```javascript
const LIFESTAGE_FIELDS = {
  'Small Mammal': ['status', 'lifeStage', 'birthDate', 'deceasedDate', 'ageAtDeath'],
  'Full Mammal': ['status', 'lifeStage', 'birthDate', 'deceasedDate', 'ageAtDeath'],
  'Reptile': ['status', 'lifeStage', 'hatchDate', 'deceasedDate', 'ageAtDeath'],
  'Bird': ['status', 'lifeStage', 'hatchDate', 'deceasedDate', 'ageAtDeath'],
  'Fish': ['status', 'lifeStage', 'hatchDate', 'deceasedDate', 'ageAtDeath'],
  'Amphibian': ['status', 'lifeStage', 'birthDate', 'deceasedDate', 'ageAtDeath'],
  'Invertebrate': ['status', 'lifeStage', 'emergenceDate', 'deceasedDate', 'ageAtDeath'],
  'Other': ['status', 'lifeStage', 'birthDate', 'deceasedDate', 'ageAtDeath']
};
```

#### 7. Breeding Information
```javascript
const BREEDING_FIELDS = {
  'Small Mammal': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount'],
  'Full Mammal': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount', 'isNeutered', 'spayNeuterDate'],
  'Reptile': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount', 'layDate', 'eggCount'],
  'Bird': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount', 'layDate', 'eggCount'],
  'Fish': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastSpawningDate', 'offspringCount', 'spawningDate'],
  'Amphibian': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount', 'layDate'],
  'Invertebrate': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount'],
  'Other': ['breedingRole', 'availableForBreeding', 'fertilityStatus', 'lastMatingDate', 'offspringCount']
};
```

#### 8. Health & Medical
```javascript
const HEALTH_FIELDS = {
  'Small Mammal': ['vaccinations', 'medicalConditions', 'medications', 'vetVisits', 'parasiteControl'],
  'Full Mammal': ['vaccinations', 'medicalConditions', 'medications', 'vetVisits', 'parasiteControl', 'heartwormStatus', 'dentalRecords'],
  'Reptile': ['medicalConditions', 'medications', 'vetVisits', 'parasiteControl', 'shedRecords'],
  'Bird': ['vaccinations', 'medicalConditions', 'medications', 'vetVisits', 'parasiteControl'],
  'Fish': ['medicalConditions', 'medications', 'quarantineRecords', 'parasiteControl'],
  'Amphibian': ['medicalConditions', 'medications', 'quarantineRecords', 'parasiteControl'],
  'Invertebrate': ['medicalConditions', 'medications', 'moltRecords'],
  'Other': ['vaccinations', 'medicalConditions', 'medications', 'vetVisits']
};
```

#### 9. Housing & Environment
```javascript
const HUSBANDRY_FIELDS = {
  'Small Mammal': ['housingType', 'bedding', 'dietType', 'feedingSchedule', 'enrichment'],
  'Full Mammal': ['housingType', 'bedding', 'dietType', 'feedingSchedule', 'exerciseRequirements', 'dailyExerciseMinutes'],
  'Reptile': ['enclosureType', 'substrate', 'dietType', 'feedingSchedule', 'temperatureRange', 'humidity', 'lighting', 'uvRequirements'],
  'Bird': ['cageType', 'perching', 'dietType', 'feedingSchedule', 'temperatureRange', 'lighting', 'enrichment'],
  'Fish': ['tankType', 'substrate', 'dietType', 'feedingSchedule', 'temperatureRange', 'waterParams', 'filtration'],
  'Amphibian': ['enclosureType', 'substrate', 'dietType', 'feedingSchedule', 'temperatureRange', 'humidity', 'waterQuality'],
  'Invertebrate': ['enclosureType', 'substrate', 'dietType', 'feedingSchedule', 'temperatureRange', 'humidity'],
  'Other': ['housingType', 'bedding', 'dietType', 'feedingSchedule', 'temperatureRange']
};
```

#### 10. Behavior & Training
```javascript
const BEHAVIOR_FIELDS = {
  'Small Mammal': ['temperament', 'handlingTolerance', 'socialStructure', 'activityCycle'],
  'Full Mammal': ['temperament', 'handlingTolerance', 'socialStructure', 'trainingLevel', 'crateTrained', 'leashTrained'],
  'Reptile': ['temperament', 'handlingTolerance', 'activityCycle', 'aggressionLevel'],
  'Bird': ['temperament', 'handlingTolerance', 'socialStructure', 'vocalizationLevel', 'flightAbility'],
  'Fish': ['temperament', 'aggressionLevel', 'socialStructure', 'activityCycle'],
  'Amphibian': ['temperament', 'handlingTolerance', 'activityCycle'],
  'Invertebrate': ['temperament', 'handlingTolerance', 'activityCycle'],
  'Other': ['temperament', 'handlingTolerance', 'socialStructure', 'activityCycle']
};
```

#### 11. Records & Achievements
```javascript
const RECORDS_FIELDS = {
  'Small Mammal': ['showTitles', 'showRatings', 'judgeComments', 'awards'],
  'Full Mammal': ['showTitles', 'showRatings', 'judgeComments', 'awards', 'workingTitles', 'certifications'],
  'Reptile': ['showTitles', 'showRatings', 'judgeComments', 'awards'],
  'Bird': ['showTitles', 'showRatings', 'judgeComments', 'awards', 'flightRecords'],
  'Fish': ['showTitles', 'showRatings', 'judgeComments', 'awards'],
  'Amphibian': ['showTitles', 'showRatings', 'judgeComments', 'awards'],
  'Invertebrate': ['showTitles', 'showRatings', 'judgeComments', 'awards'],
  'Other': ['showTitles', 'showRatings', 'judgeComments', 'awards']
};
```

#### 12. Legal & Documentation
```javascript
const LEGAL_FIELDS = {
  'Small Mammal': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory'],
  'Full Mammal': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory', 'insurance'],
  'Reptile': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory', 'citesPermit', 'exportRestrictions'],
  'Bird': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory', 'citesPermit', 'exportRestrictions'],
  'Fish': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory', 'exportRestrictions'],
  'Amphibian': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory', 'exportRestrictions'],
  'Invertebrate': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory', 'exportRestrictions'],
  'Other': ['licenseNumber', 'licenseJurisdiction', 'breedingRestrictions', 'transferHistory']
};
```

### Field Rendering Logic
```javascript
// Master field group mapping
const FIELD_GROUPS = {
  CORE_UNIVERSAL_FIELDS,
  IDENTITY_FIELDS,
  OWNERSHIP_FIELDS,
  VARIETY_FIELDS, 
  MARKINGS_FIELDS,
  MEASUREMENT_FIELDS,
  IDENTIFICATION_FIELDS,
  LIFESTAGE_FIELDS,
  BREEDING_FIELDS,
  HEALTH_FIELDS,
  HUSBANDRY_FIELDS,
  BEHAVIOR_FIELDS,
  RECORDS_FIELDS,
  LEGAL_FIELDS
};

const renderFieldsByTab = (fields, currentTab, animal, template) => {
    const tabFields = fields.filter(field => 
        field.enabled && field.tab === currentTab
    );
    
    // Get species template name for field mapping
    const templateName = template.templateName;
    
    // Special handling for Overview tab with multiple field groups
    if (currentTab === 'Overview') {
        return (
            <>
                {/* Identity Group */}
                <FieldGroup
                    title="Basic Information"
                    fields={IDENTITY_FIELDS[templateName]}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                />
                
                {/* Variety Group */}
                <FieldGroup
                    title="Variety"
                    fields={VARIETY_FIELDS[templateName]}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                    grouped={true}
                />
                
                {/* Markings Group */}
                <FieldGroup
                    title="Markings & Details"
                    fields={MARKINGS_FIELDS[templateName]}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                />
                
                {/* Breeding Status Group */}
                <FieldGroup
                    title="Breeding & Sale Status"
                    fields={['isStudAnimal', 'availableForBreeding', 'isForSale', 'studFeeAmount', 'salePriceAmount']}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                />
            </>
        );
    }
    
    // Physical tab with organized measurement groups
    if (currentTab === 'Physical') {
        return (
            <>
                <FieldGroup
                    title="Life Stage"
                    fields={LIFESTAGE_FIELDS[templateName]}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                />
                
                <FieldGroup
                    title="Size & Measurements"
                    fields={MEASUREMENT_FIELDS[templateName]}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                />
                
                <FieldGroup
                    title="Physical Appearance"
                    fields={VARIETY_FIELDS[templateName].concat(MARKINGS_FIELDS[templateName])}
                    allFields={fields}
                    animal={animal}
                    onChange={handleFieldChange}
                />
            </>
        );
    }
    
    // Continue with other tab-specific groupings...
    // Standard rendering for other tabs or fallback
    return tabFields.map(field => (
        <FormField 
            key={field.fieldName}
            name={field.fieldName}
            label={field.label}
            required={field.required}
            value={animal[field.fieldName] || ''}
            onChange={handleFieldChange}
        />
    ));
};

// Reusable FieldGroup component
const FieldGroup = ({ title, fields = [], allFields, animal, onChange, grouped = false }) => {
    const groupFields = fields.map(fieldName => 
        allFields.find(f => f.fieldName === fieldName)
    ).filter(Boolean);
    
    if (groupFields.length === 0) return null;
    
    return (
        <div className="field-group mb-6">
            <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">
                {title}
            </h4>
            <div className={grouped ? "grid grid-cols-2 md:grid-cols-4 gap-3" : "space-y-3"}>
                {groupFields.map(field => (
                    <FormField 
                        key={field.fieldName}
                        name={field.fieldName}
                        label={field.label}
                        required={field.required}
                        value={animal[field.fieldName] || ''}
                        onChange={onChange}
                        compact={grouped}
                    />
                ))}
            </div>
        </div>
    );
};
```

## Key Preservation Requirements

### ✅ MUST Preserve (No Changes)
- Current detail view display logic
- Field duplications in detail view tabs
- Existing fancy mouse overview structure  
- All current animal display functionality
- Existing navigation and UI patterns

### ✅ NEW Functionality Only
- Edit mode organization using field templates  
- Tab-based editing with no field duplication
- Species-specific field availability
- Enhanced form organization

### ✅ Enhanced Display Consistency 
**Apply field groupings to BOTH edit mode AND view mode for consistency:**

#### View Mode Field Group Display
```javascript
// Update existing detail view to use consistent field groupings
const renderDetailViewSection = (sectionName, animal, template) => {
    const templateName = template.templateName;
    
    switch (sectionName) {
        case 'variety':
            const varietyFields = VARIETY_FIELDS[templateName] || [];
            const varietyValue = varietyFields
                .map(field => animal[field])
                .filter(Boolean)
                .join(' ') || 'N/A';
            return `Variety: ${varietyValue}`;
            
        case 'identification':
            const idFields = IDENTIFICATION_FIELDS[templateName] || [];
            return idFields.map(fieldName => ({
                label: getFieldLabel(fieldName),
                value: animal[fieldName] || ''
            }));
            
        case 'measurements':
            const measureFields = MEASUREMENT_FIELDS[templateName] || [];
            return measureFields.map(fieldName => ({
                label: getFieldLabel(fieldName),
                value: animal[fieldName] || ''
            }));
            
        // ... continue for all field groups
    }
};
```

#### Consistent Field Labeling System
```javascript
// Centralized field label mapping for consistent display
const FIELD_LABELS = {
    // Core universal fields
    'name': 'Name',
    'gender': 'Gender',
    'status': 'Status',
    'birthDate': 'Birth Date',
    'currentOwner': 'Owner',
    'currentOwnerDisplay': 'Owner Display Name',
    'isOwned': 'Currently Owned',
    'isDisplay': 'Public Profile',
    'remarks': 'Notes/Remarks',
    
    // Identity fields
    'prefix': 'Prefix',
    'suffix': 'Suffix', 
    'breed': 'Breed',
    'species': 'Species',
    'strain': 'Strain/Line',
    'geneticCode': 'Genetic Code',
    
    // Variety fields  
    'color': 'Color',
    'coatPattern': 'Pattern', 
    'coat': 'Coat Type',
    'earset': 'Ear Set',
    'pattern': 'Pattern',
    'scaleType': 'Scale Type',
    'morph': 'Morph',
    'featherType': 'Feather Type',
    'finType': 'Fin Type',
    'skinTexture': 'Skin Texture',
    'exoskeletonType': 'Exoskeleton Type',
    
    // Measurements
    'weight': 'Weight',
    'bodyLength': 'Length',
    'heightAtWithers': 'Height',
    'bodyConditionScore': 'Body Condition',
    'length': 'Length',
    'girth': 'Girth',
    'wingspan': 'Wingspan',
    
    // Ownership
    'coOwnership': 'Co-Ownership',
    
    // Life stage
    'lifeStage': 'Life Stage',
    'deceasedDate': 'Deceased Date',
    'ageAtDeath': 'Age at Death',
    'hatchDate': 'Hatch Date',
    'emergenceDate': 'Emergence Date',
    
    // Continue for all fields...
};

const getFieldLabel = (fieldName) => FIELD_LABELS[fieldName] || fieldName;
```

#### View/Edit Mode Synchronization
- **Edit Mode**: Organized by field groups, no duplicates
- **View Mode**: Enhanced with same field groupings for consistency  
- **Both Modes**: Use same field labels and grouping logic
- **Result**: Seamless UX between viewing and editing

## Technical Considerations

### State Management
```javascript
// Edit form state structure
const [editFormData, setEditFormData] = useState({
    currentTab: 'Overview',
    fieldValues: { ...animal },
    template: null,
    validation: {},
    isDirty: false
});
```

### API Integration
```javascript
// Load field template on edit mode open
const loadFieldTemplate = async (species) => {
    try {
        const response = await fetch(`${API_BASE_URL}/field-templates/${species}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const template = await response.json();
        setEditFormData(prev => ({ ...prev, template }));
    } catch (error) {
        console.error('Failed to load field template:', error);
        // Fallback to basic template
    }
};
```

### Form Validation
```javascript
const validateTab = (tabName, values, template) => {
    const tabFields = template.fields.filter(f => f.tab === tabName && f.required);
    const errors = {};
    
    tabFields.forEach(field => {
        if (!values[field.fieldName]) {
            errors[field.fieldName] = `${field.label} is required`;
        }
    });
    
    return errors;
};
```

## Design System Integration

### Styling Consistency
- Use existing Tailwind classes from current UI
- Match current tab styling from detail view
- Maintain consistent spacing and typography
- Follow existing button and input patterns

### Responsive Design
- Mobile-first approach matching current design
- Tab navigation optimized for small screens
- Field layout adaptable to viewport size
- Consistent with existing responsive patterns

## Testing Strategy

### Unit Tests
- [ ] Field template loading
- [ ] Tab switching functionality  
- [ ] Field validation logic
- [ ] Save/cancel operations

### Integration Tests  
- [ ] Edit mode with different species
- [ ] Template switching on species change
- [ ] Data persistence across tabs
- [ ] Error handling and fallbacks

### User Acceptance Tests
- [ ] Edit flow completion for each species
- [ ] Field availability matches templates
- [ ] No regression in detail view display
- [ ] Performance with large datasets

## Migration Considerations

### Backward Compatibility
- Existing animals work with new system
- Graceful degradation if templates unavailable  
- No data loss during implementation
- Existing edit flows remain functional during transition

### Rollout Strategy
1. **Beta Testing**: Test with subset of users
2. **Feature Flag**: Toggle between old/new edit modes
3. **Gradual Rollout**: Species-by-species activation
4. **Full Migration**: Complete switch after validation

## Success Metrics

### Performance Targets
- Edit form load time: < 500ms
- Template switching: < 200ms  
- Save operation: < 2s
- No impact on detail view performance

### User Experience Goals
- Reduced form complexity through tabbing
- Clearer field organization by category
- Species-appropriate fields only
- No functional regressions

---

## Implementation Checklist

### Backend Requirements
- [ ] Field template API endpoint
- [ ] Species-template mapping
- [ ] Template validation
- [ ] Error handling

### Frontend Requirements  
- [ ] Edit form component
- [ ] Tab navigation
- [ ] Field rendering
- [ ] Validation system
- [ ] State management
- [ ] API integration

### Testing Requirements
- [ ] Unit test coverage
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Regression testing

### Documentation Requirements
- [ ] API documentation
- [ ] Component documentation
- [ ] User guide updates
- [ ] Developer handbook updates

---

*Last Updated: February 21, 2026*
*Next Review: Implementation kickoff*