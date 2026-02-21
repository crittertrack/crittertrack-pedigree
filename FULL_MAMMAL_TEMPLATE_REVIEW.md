# Full Mammal Template - Review & Recommendations

## Analysis Summary

This document reviews the **Full Mammal Template** field configuration and identifies gaps, duplications, and improvement opportunities.

---

## 1. Birth Terminology Duplication

### Current State
- `whelpingDate` - Dog-specific ✅ EXISTS
- `queeningDate` - Cat-specific ✅ EXISTS

### Issue
Both fields are enabled but are species-specific. Should only show relevant field based on species.

### Recommendation
**Add conditional field visibility logic** based on `species` value:
- Dogs → show `whelpingDate`
- Cats → show `queeningDate`
- Other mammals → show generic `birthDate` / `litterBirthDate`

---

## 2. Registry-Specific IDs

### Current State
- `akcRegistrationNumber` - American Kennel Club (dogs) ✅ EXISTS
- `cfaRegistrationNumber` - Cat Fanciers' Association (cats) ✅ EXISTS
- `fciRegistrationNumber` - Fédération Cynologique Internationale (dogs) ✅ EXISTS

### Status
✅ **Already exist in schema** but currently **DISABLED** in Full Mammal Template

### Recommendation
**ENABLE these fields** in Full Mammal Template since dogs/cats are primary users.

---

## 3. Missing Core Fields

### Currently Missing from Animal Schema

| Field | Purpose | Priority |
|-------|---------|----------|
| `age` | Calculated from birthDate | HIGH - computed field |
| `birthLocation` | Where animal was born | MEDIUM |
| `currentWeight` | Current weight measurement | HIGH |
| `birthOrder` | Position in litter | MEDIUM |
| `handRaised` | Boolean - hand-reared? | MEDIUM |

### Action Required
Add these fields to **AnimalSchema** in `database/models.js`

---

## 4. Weight Fields Duplication/Clarity

### Current State
```javascript
adultWeight: { type: String, default: null }  // Line 196
weight: // Only in growthRecords array, not standalone
```

### Issue
No clear "current weight" field. `adultWeight` is ambiguous.

### Recommendation
**Rename for clarity:**
```javascript
currentWeight: { type: String, default: null }      // Most recent weight
expectedAdultWeight: { type: String, default: null } // Target adult weight
```

**Keep `growthRecords` array** for historical tracking.

---

## 5. Fertility Field Simplification

### Current State (Redundant)
```javascript
fertilityStatus: { type: String, default: 'Unknown' }       // Line 244
isInfertile: { type: Boolean, default: false }              // Line 277
damFertilityStatus: { type: String, default: 'Unknown' }   // Line 251
```

### Recommendation
**Consolidate to single enum field:**
```javascript
fertilityStatus: { 
    type: String, 
    enum: ['fertile', 'infertile', 'unknown', 'retired', 'spayed/neutered'],
    default: 'unknown' 
}
```

**Remove:**
- `isInfertile` ❌
- `damFertilityStatus` ❌ (redundant with main fertilityStatus)

**Keep separate:** `fertilityNotes` for details

---

## 6. Pregnancy/Mating Data Structure

### Current State (Fragmented)
```javascript
matingDates: { type: String, default: null }          // Line 229
lastMatingDate: { type: Date, default: null }         // Line 239
successfulMatings: { type: Number, default: null }    // Line 240
lastPregnancyDate: { type: Date, default: null }      // Line 241
```

### Issue
Reproductive history stored as disconnected fields, hard to track individual events.

### Recommendation
**Replace with structured array:**
```javascript
breedingEvents: [{
    eventDate: { type: Date },
    eventType: { type: String, enum: ['mating', 'pregnancy_confirmed', 'birth', 'miscarriage'] },
    partnerId_public: { type: String },             // Link to mate
    litterId: { type: ObjectId, ref: 'Litter' },   // Link to resulting litter
    success: { type: Boolean },
    notes: { type: String }
}]
```

**Benefits:**
- Complete breeding timeline
- Links matings to offspring
- Better for pedigree tracking

---

## 7. Parentage/Lineage Fields

### Current State
```javascript
sireId_public: { type: String, default: null }  ✅ EXISTS
damId_public: { type: String, default: null }   ✅ EXISTS
litterId: { type: ObjectId, ref: 'Litter' }     ✅ EXISTS
```

### Missing
- ❌ `birthOrder` - Position in litter (1st born, 2nd born, etc.)
- ❌ `handRaised` - Boolean flag for hand-reared animals

### Recommendation
**Add to schema:**
```javascript
birthOrder: { type: Number, default: null },        // 1, 2, 3, etc.
handRaised: { type: Boolean, default: false },      // True if bottle-fed/hand-reared
handRaisedReason: { type: String, default: null }   // Why (orphaned, rejected, etc.)
```

---

## 8. Vital Signs / Health Baselines

### Currently Missing
Essential for veterinary tracking:

```javascript
baselineTemperature: { type: Number, default: null },      // °F or °C
baselineHeartRate: { type: Number, default: null },        // BPM
baselineRespirationRate: { type: Number, default: null },  // Breaths/min
spayNeuterReason: { type: String, default: null }          // Medical, behavioral, etc.
```

### Priority
**HIGH** - Critical for:
- Veterinary records
- Health monitoring
- Medical emergencies (know normal baseline)

---

## 9. Location Tracking

### Currently Missing
Animal ownership ≠ physical location

```javascript
currentLocation: { type: String, default: null },     // Current physical location
facility: { type: String, default: null },            // Kennel, shelter, zoo name
enclosureId: { type: String, default: null },         // Cage/pen/run number
pastLocations: [{
    location: { type: String },
    facility: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    reason: { type: String }
}]
```

### Use Cases
- Multi-facility operations
- Boarding/kenneling
- Zoos (enclosure tracking)
- Transfers between locations

---

## 10. Feeding Details

### Current State
```javascript
dietType: { type: String, default: null }           ✅ EXISTS
feedingSchedule: { type: String, default: null }    ✅ EXISTS
supplements: { type: String, default: null }        ✅ EXISTS
```

### Missing Specifics
```javascript
dailyFoodAmount: { type: String, default: null },       // "2 cups", "500g"
waterAccess: { type: String, default: null },           // "Free choice", "Scheduled"
feedingRestrictions: { type: String, default: null },   // Pre-surgery fasting, etc.
foodAllergies: { type: String, default: null }          // Separate from medical allergies
```

---

## 11. Behavioral Safety / Management

### Currently Missing
Critical for working animals, rescues, zoos:

```javascript
handlingRisks: { type: String, default: null },         // "Bite risk", "Flight risk"
escapeRisk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
aggressionTriggers: { type: String, default: null },    // "Food guarding", "Resource guarding"
preferredHandlers: { type: String, default: null }      // "Only staff X can handle"
```

### Priority
**HIGH** - Liability and safety concerns

---

## 12. Media / Documentation

### Currently Missing
Almost all modern animal management systems include:

```javascript
documents: [{
    type: { type: String },              // "pedigree", "health cert", "insurance"
    url: { type: String },
    uploadDate: { type: Date },
    description: { type: String }
}],
pedigreeDocument: { type: String, default: null },      // Direct link
insuranceDocuments: [{ 
    provider: { type: String },
    policyNumber: { type: String },
    coverage: { type: String },
    expiryDate: { type: Date },
    documentUrl: { type: String }
}]
```

---

## 13. Strain Field - Should Enable

### Current State
```javascript
strain: { type: String, default: null }  // ✅ EXISTS but DISABLED
```

### Use Cases
- **Lab mammals** - specific research strains
- **Livestock** - breeding lines
- **Conservation** - genetic diversity tracking
- **Working dogs** - bloodlines for specific traits

### Recommendation
1. **ENABLE** in Full Mammal Template
2. **Rename** field label to: `"Lineage/Strain"` or `"Bloodline"`
3. Keep field name as `strain` in schema (no breaking change)

---

## Implementation Priority

### 🔴 HIGH PRIORITY (Immediate)
1. Fix weight field naming (`currentWeight` / `expectedAdultWeight`)
2. Simplify fertility fields (remove duplicates)
3. Enable AKC/CFA registry fields
4. Enable `strain` field
5. Add vital signs baselines (temp, heart rate, respiration)

### 🟡 MEDIUM PRIORITY (Phase 2)
1. Add location tracking fields
2. Restructure breeding events as array
3. Add feeding detail fields
4. Add behavioral safety fields
5. Add parentage details (birthOrder, handRaised)

### 🟢 LOW PRIORITY (Future Enhancement)
1. Document management system
2. Insurance tracking
3. Advanced location history

---

## Migration Strategy

### Option 1: Incremental Updates
Add fields gradually, maintain backward compatibility.

### Option 2: Major Schema Refactor
Requires migration script for existing animals.

### Recommendation
**Start with HIGH priority items** that add fields without restructuring existing data, then plan Phase 2 for structural changes (like `breedingEvents` array).

---

## Next Steps

1. **Review this document** with team
2. **Approve field additions** for Animal schema
3. **Create migration script** for schema updates
4. **Update FieldTemplate** configurations
5. **Test with existing animals** to ensure no data loss
6. **Update frontend forms** to show new fields

---

*Generated: 2026-02-21*
