# Field Template Configuration

**Total Templates:** 8

---

## Core Fields (Always Available)

The following fields are **ALWAYS ENABLED** for all species and are NOT controlled by field templates:

**Identity & Basic Info:**
- `name` - Animal name (required)
- `species` - Species type (required)
- `gender` - Male/Female/Intersex/Unknown (required)
- `birthDate` - Date of birth (required)
- `deceasedDate` - Date of death (optional)
- `id_public` - Public ID (auto-generated)
- `status` - Pet/Breeder/Show/Working/etc.

**Ownership:**
- `ownerId` - Backend owner reference
- `ownerId_public` - Public owner ID
- `originalOwnerId` - Original breeder
- `ownerName` - Custom owner name
- `soldStatus` - Sale/transfer status

**Lineage:**
- `sireId_public` - Father's public ID
- `damId_public` - Mother's public ID
- `litterId` - Litter reference
- `breederId_public` - Breeder's public ID
- `manualBreederName` - Manual breeder name

**Images & Display:**
- `imageUrl` - Image URL (consolidated from photoUrl)
- `originalOwner` - Original creator (for transfer returns)
- `transferredFrom` - Who sent animal to current owner  
- `isTransferred` - Boolean: received via transfer
- `tags` - Organization tags
- `showOnPublicProfile` - Public visibility toggle
- `isDisplay` - Display on public profile

**Tracking:**
- `isOwned` - Currently owned status
- `isPregnant` - Pregnancy status
- `isNursing` - Nursing status
- `isInMating` - Currently in mating
- `growthRecords` - Growth history array
- `measurementUnits` - Measurement preferences

---

## Small Mammal Template

**Enabled:** 108 fields | **Disabled:** 28 fields

### ✅ Enabled Template Fields (108)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coat` | Coat Type |  | Overview |
| `earset` | Earset |  | Overview |
| `coatPattern` | Pattern |  | Overview |
| `carrierTraits` | Carrier Traits |  | Physical |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Length |  | Physical |
| `pedigreeRegistrationId` | Pedigree Registration # |  | Identification |
| `breed` | Breed |  | Overview |
| `strain` | Strain |  | Overview |
| `colonyId` | Colony ID |  | Identification |
| `groupRole` | Group Role |  | Status & Privacy |
| `microchipNumber` | Microchip # |  | Identification |
| `origin` | Origin |  | Lineage |
| `isNeutered` | Neutered/Spayed |  | Breeding |
| `spayNeuterDate` | Spay/Neuter Date |  | Breeding |
| `heatStatus` | Heat Status |  | Breeding |
| `lastHeatDate` | Last Heat Date |  | Breeding |
| `ovulationDate` | Ovulation Date |  | Breeding |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Due Date |  | Breeding |
| `litterCount` | Litter Count |  | Breeding |
| `litterSizeBorn` | Litter Size Born |  | Breeding |
| `litterSizeWeaned` | Litter Size Weaned |  | Breeding |
| `stillbornCount` | Stillborn Count |  | Breeding |
| `nursingStartDate` | Nursing Start Date |  | Breeding |
| `weaningDate` | Weaning Date |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Mating Date |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `lastPregnancyDate` | Last Pregnancy Date |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Stud Animal |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Stud Fee Currency |  | Overview |
| `studFeeAmount` | Stud Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Dam Animal |  | Breeding |
| `damFertilityNotes` | Dam Fertility Notes |  | Breeding |
| `estrusCycleLength` | Estrus Cycle Length (days) |  | Breeding |
| `gestationLength` | Gestation Length (days) |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |

| `vaccinations` | Vaccinations |  | Health |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `allergies` | Allergies |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Housing Type |  | Husbandry |
| `bedding` | Bedding |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `noise` | Noise Levels |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `exerciseRequirements` | Exercise Requirements |  | Husbandry |
| `groomingNeeds` | Grooming Needs |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Structure |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite History |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `licenseNumber` | License Number |  | Legal & Documentation |
| `licenseJurisdiction` | License Jurisdiction |  | Legal & Documentation |
| `parasitePreventionSchedule` | Parasite Prevention Schedule |  | Health |
| `reproductiveClearances` | Reproductive Clearances |  | Breeding |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |

### ❌ Disabled Fields (28)

| Field Name | Label |
|------------|-------|
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `deliveryMethod` | Delivery Method |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `dentalRecords` | Dental Records |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `leashTrained` | Leash Trained |
| `trainingLevel` | Training Level |
| `trainingDisciplines` | Training Disciplines |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `reactivityNotes` | Reactivity Notes |
| `workingTitles` | Working Titles |
| `morph` | Morph |

---
## Full Mammal Template

**Enabled:** 123 fields | **Disabled:** 8 fields

### ✅ Enabled Template Fields (123)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coat` | Coat Type |  | Overview |
| `coatPattern` | Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `heightAtWithers` | Height at Withers |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `chestGirth` | Chest Girth |  | Physical |
| `adultWeight` | Expected Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `microchipNumber` | Microchip # |  | Identification |
| `pedigreeRegistrationId` | Pedigree Registration # |  | Identification |
| `breed` | Breed |  | Overview |
| `strain` | Lineage/Strain |  | Overview |
| `licenseNumber` | License Number |  | Legal & Documentation |
| `licenseJurisdiction` | License Jurisdiction |  | Legal & Documentation |
| `rabiesTagNumber` | Rabies Tag # |  | Identification |
| `tattooId` | Tattoo ID |  | Identification |
| `akcRegistrationNumber` | AKC Registration # |  | Identification |
| `fciRegistrationNumber` | FCI Registration # |  | Identification |
| `cfaRegistrationNumber` | CFA Registration # |  | Identification |
| `workingRegistryIds` | Working Registry IDs |  | Identification |
| `origin` | Origin |  | Lineage |
| `isNeutered` | Neutered/Spayed |  | Breeding |
| `spayNeuterDate` | Spay/Neuter Date |  | Breeding |
| `heatStatus` | Heat Status |  | Breeding |
| `lastHeatDate` | Last Heat Date |  | Breeding |
| `ovulationDate` | Ovulation Date |  | Breeding |
| `matingDates` | Mating Dates (Historical) |  | Breeding |
| `expectedDueDate` | Expected Due Date |  | Breeding |
| `litterCount` | Litter Count |  | Breeding |
| `nursingStartDate` | Nursing Start Date |  | Breeding |
| `weaningDate` | Weaning Date |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Most Recent Mating |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `lastPregnancyDate` | Last Pregnancy Date |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Stud Animal |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Stud Fee Currency |  | Overview |
| `studFeeAmount` | Stud Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Dam Animal |  | Breeding |
| `damFertilityNotes` | Dam Fertility Notes |  | Breeding |
| `estrusCycleLength` | Estrus Cycle Length (days) |  | Breeding |
| `gestationLength` | Gestation Length (days) |  | Breeding |
| `artificialInseminationUsed` | Artificial Insemination Used |  | Breeding |
| `whelpingDate` | Whelping Date |  | Breeding |
| `queeningDate` | Queening Date |  | Breeding |
| `deliveryMethod` | Delivery Method |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `reproductiveClearances` | Reproductive Clearances |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `vaccinations` | Vaccinations |  | Health |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `allergies` | Allergies |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention Schedule |  | Health |
| `heartwormStatus` | Heartworm Status |  | Health |
| `hipElbowScores` | Hip/Elbow Scores |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `eyeClearance` | Eye Clearance |  | Health |
| `cardiacClearance` | Cardiac Clearance |  | Health |
| `dentalRecords` | Dental Records |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Housing Type |  | Husbandry |
| `bedding` | Bedding |  | Husbandry |
| `noise` | Noise Levels |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `exerciseRequirements` | Exercise Requirements |  | Husbandry |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |  | Husbandry |
| `groomingNeeds` | Grooming Needs |  | Husbandry |
| `sheddingLevel` | Shedding Level |  | Husbandry |
| `crateTrained` | Crate Trained |  | Behavior |
| `litterTrained` | Litter Trained |  | Behavior |
| `leashTrained` | Leash Trained |  | Behavior |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Structure |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `trainingLevel` | Training Level |  | Behavior |
| `trainingDisciplines` | Training Disciplines |  | Behavior |
| `certifications` | Certifications |  | Behavior |
| `workingRole` | Working Role |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite History |  | Behavior |
| `reactivityNotes` | Reactivity Notes |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `workingTitles` | Working Titles |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status |  | Legal & Documentation |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

### ❌ Disabled Fields (8)

| Field Name | Label | Reason |
|------------|-------|--------|
| `earset` | Earset | Not applicable to larger mammals |
| `length` | Length | Not standard measurement for dogs/cats |
| `damFertilityStatus` | Dam Fertility Status | **🔄 Consolidated** - Use main `fertilityStatus` instead |
| `isInfertile` | Infertile | **🔄 Redundant** - Use `fertilityStatus` enum instead |
| `temperatureRange` | Temperature Range | Environmental control not needed for most mammals |
| `humidity` | Humidity | Environmental control not needed for most mammals |
| `lighting` | Lighting | Not critical for standard dog/cat husbandry |
| `morph` | Morph | Not applicable to mammals (used for reptiles) |

**Note:** Fields marked **🔄** were recently disabled to reduce duplication and improve data consistency.

---

---

## Reptile Template

**Enabled:** 95 fields | **Disabled:** 36 fields

### ✅ Enabled Template Fields (95)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Base Color |  | Overview |
| `coatPattern` | Morph/Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Snout-Vent Length (SVL) |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Length |  | Physical |
| `pedigreeRegistrationId` | Pedigree Registration # |  | Identification |
| `breed` | Species/Locality |  | Overview |
| `origin` | Origin |  | Lineage |
| `matingDates` | Breeding Dates |  | Breeding |
| `expectedDueDate` | Expected Lay Date |  | Breeding |
| `litterCount` | Clutch Size |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Mating Date |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `lastPregnancyDate` | Last Gravid Period |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Fertility Status |  | Breeding |
| `damFertilityNotes` | Fertility Notes |  | Breeding |
| `gestationLength` | Incubation Period (days) |  | Breeding |
| `deliveryMethod` | Egg-laying/Live Birth |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `vaccinations` | Vaccinations |  | Health |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `allergies` | Allergies |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention Schedule |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Enclosure Type |  | Husbandry |
| `bedding` | Substrate |  | Husbandry |
| `temperatureRange` | Temperature Gradient |  | Husbandry |
| `humidity` | Humidity Level |  | Husbandry |
| `lighting` | UV/Heat Lighting |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `groomingNeeds` | Shed Assistance |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite History |  | Behavior |
| `reactivityNotes` | Defensive Behavior Notes |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph |  | Physical |
| `markings` | Pattern/Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `reproductiveClearances` | Reproductive Clearances |  | Breeding |
| `noise` | Noise Levels |  | Husbandry |
| `exerciseRequirements` | Exercise Requirements |  | Husbandry |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `insurance` | Insurance |  | Legal & Documentation |

### ❌ Disabled Fields (36)

| Field Name | Label |
|------------|-------|
| `coat` | Coat Type |
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `strain` | Strain |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `isNeutered` | Neutered/Spayed |
| `spayNeuterDate` | Spay/Neuter Date |
| `heatStatus` | Heat Status |
| `lastHeatDate` | Last Heat Date |
| `ovulationDate` | Ovulation Date |
| `nursingStartDate` | Nursing Start Date |
| `weaningDate` | Weaning Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `dentalRecords` | Dental Records |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |
| `groomingNeeds` | Grooming Needs |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `leashTrained` | Leash Trained |
| `trainingLevel` | Training Level |
| `trainingDisciplines` | Training Disciplines |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `workingTitles` | Working Titles |

---

---

## Bird Template

**Enabled:** 114 fields | **Disabled:** 26 fields

### ✅ Enabled Template Fields (114)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Band Number |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coat` | Feather Type |  | Overview |
| `coatPattern` | Plumage Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Wingspan |  | Physical |
| `microchipNumber` | Microchip # |  | Identification |
| `pedigreeRegistrationId` | Registration # |  | Identification |
| `breed` | Breed/Variety |  | Overview |
| `licenseNumber` | Permit Number |  | Legal & Documentation |
| `licenseJurisdiction` | Jurisdiction |  | Legal & Documentation |
| `origin` | Origin |  | Lineage |
| `ovulationDate` | Ovulation Date |  | Breeding |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Hatch Date |  | Breeding |
| `litterCount` | Clutch Size |  | Breeding |
| `weaningDate` | Fledging Date |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Mating Date |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `lastPregnancyDate` | Last Egg-laying Date |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Fertility Status |  | Breeding |
| `damFertilityNotes` | Fertility Notes |  | Breeding |
| `gestationLength` | Incubation Period (days) |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `vaccinations` | Vaccinations |  | Health |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention Schedule |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `dentalRecords` | Beak/Nail Care |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Housing Type |  | Husbandry |
| `bedding` | Substrate |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting/Daylight Hours |  | Husbandry |
| `noise` | Noise Levels |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `exerciseRequirements` | Flight/Exercise Requirements |  | Husbandry |
| `dailyExerciseMinutes` | Out-of-Cage Time (minutes) |  | Husbandry |
| `groomingNeeds` | Grooming Needs |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Needs |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `trainingLevel` | Training Level |  | Behavior |
| `trainingDisciplines` | Tricks/Commands |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite History |  | Behavior |
| `reactivityNotes` | Reactivity Notes |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status/CITES |  | Legal & Documentation |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Mutation/Morph |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `strain` | Strain/Line |  | Overview |
| `isNeutered` | Neutered/Spayed |  | Breeding |
| `spayNeuterDate` | Spay/Neuter Date |  | Breeding |
| `artificialInseminationUsed` | Artificial Insemination Used |  | Breeding |
| `deliveryMethod` | Egg-laying/Live Birth |  | Breeding |
| `reproductiveClearances` | Reproductive Clearances |  | Breeding |
| `allergies` | Allergies |  | Health |
| `eyeClearance` | Eye Clearance |  | Health |
| `cardiacClearance` | Cardiac Clearance |  | Health |
| `crateTrained` | Carrier Trained |  | Behavior |
| `litterTrained` | Litter Trained |  | Behavior |
| `leashTrained` | Harness Trained |  | Behavior |
| `certifications` | Certifications |  | Behavior |
| `workingRole` | Working Role |  | Behavior |
| `workingTitles` | Working Titles |  | Records |

### ❌ Disabled Fields (26)

| Field Name | Label |
|------------|-------|
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `heatStatus` | Heat Status |
| `lastHeatDate` | Last Heat Date |
| `nursingStartDate` | Nursing Start Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `sheddingLevel` | Shedding Level |
| `currentOwner` | Owner Name |
| `eyeColor` | Eye Color |
| `nailColor` | Nail Color |
| `carrierTraits` | Carrier Traits |
| `colonyId` | Colony ID |
| `groupRole` | Group Role |
| `litterSizeBorn` | Litter Size Born |
| `litterSizeWeaned` | Litter Size Weaned |
| `stillbornCount` | Stillborn Count |

---

---

## Amphibian Template

**Enabled:** 94 fields | **Disabled:** 37 fields

### ✅ Enabled Template Fields (94)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coatPattern` | Skin Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Snout-Vent Length |  | Physical |
| `pedigreeRegistrationId` | Registration # |  | Identification |
| `licenseNumber` | License Number |  | Legal & Documentation |
| `licenseJurisdiction` | Jurisdiction |  | Legal & Documentation |
| `origin` | Origin |  | Lineage |
| `ovulationDate` | Egg-laying Date |  | Breeding |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Spawn Date |  | Breeding |
| `litterCount` | Egg Count |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Breeding Date |  | Breeding |
| `successfulMatings` | Successful Breedings |  | Breeding |
| `lastPregnancyDate` | Last Spawn Date |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Fertility Status |  | Breeding |
| `damFertilityNotes` | Fertility Notes |  | Breeding |
| `gestationLength` | Development Period |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Enclosure Type |  | Husbandry |
| `bedding` | Substrate |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `breed` | Species/Locality |  | Overview |
| `strain` | Strain/Lineage |  | Overview |
| `microchipNumber` | Microchip # |  | Identification |
| `weaningDate` | Metamorphosis Date |  | Breeding |
| `deliveryMethod` | Spawning Method |  | Breeding |
| `reproductiveClearances` | Health Clearances |  | Breeding |
| `vaccinations` | Vaccinations/Treatments |  | Health |
| `allergies` | Environmental Sensitivities |  | Health |
| `noise` | Vocalization/Calling |  | Husbandry |
| `exerciseRequirements` | Activity Space Requirements |  | Husbandry |
| `biteHistory` | Bite History |  | Behavior |
| `reactivityNotes` | Stress Response Notes |  | Behavior |
| `insurance` | Insurance |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Fertility Status |  | Breeding |
| `damFertilityNotes` | Fertility Notes |  | Breeding |
| `gestationLength` | Development Period |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Enclosure Type |  | Husbandry |
| `bedding` | Substrate |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `breed` | Species/Locality |  | Overview |
| `strain` | Strain/Lineage |  | Overview |
| `microchipNumber` | Microchip # |  | Overview |
| `weaningDate` | Metamorphosis Date |  | Breeding |
| `deliveryMethod` | Spawning Method |  | Breeding |
| `reproductiveClearances` | Health Clearances |  | Breeding |
| `vaccinations` | Vaccinations/Treatments |  | Health |
| `allergies` | Environmental Sensitivities |  | Health |
| `noise` | Vocalization/Calling |  | Husbandry |
| `exerciseRequirements` | Activity Space Requirements |  | Husbandry |
| `biteHistory` | Bite History |  | Behavior |
| `reactivityNotes` | Stress Response Notes |  | Behavior |
| `insurance` | Insurance |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |

### ❌ Disabled Fields (37)

| Field Name | Label |
|------------|-------|
| `coat` | Coat Type |
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `isNeutered` | Neutered/Spayed |
| `spayNeuterDate` | Spay/Neuter Date |
| `heatStatus` | Heat Status |
| `lastHeatDate` | Last Heat Date |
| `nursingStartDate` | Nursing Start Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `dentalRecords` | Dental Records |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |
| `groomingNeeds` | Grooming Needs |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `leashTrained` | Leash Trained |
| `trainingLevel` | Training Level |
| `trainingDisciplines` | Training Disciplines |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `workingTitles` | Working Titles |

---

---

## Fish Template

**Enabled:** 91 fields | **Disabled:** 40 fields

### ✅ Enabled Template Fields (91)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coatPattern` | Color Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Standard Length |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `length` | Length |  | Physical |
| `pedigreeRegistrationId` | Registration # |  | Identification |
| `breed` | Variety/Strain |  | Overview |
| `strain` | Strain/Line |  | Overview |
| `origin` | Origin |  | Lineage |
| `matingDates` | Spawn Dates |  | Breeding |
| `expectedDueDate` | Expected Hatch Date |  | Breeding |
| `litterCount` | Fry Count |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Spawn Date |  | Breeding |
| `successfulMatings` | Successful Spawns |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Fertility Status |  | Breeding |
| `damFertilityNotes` | Fertility Notes |  | Breeding |
| `gestationLength` | Incubation Period |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `dewormingRecords` | Deworming/Parasite Treatment |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Vet Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Tank Type |  | Husbandry |
| `bedding` | Substrate |  | Husbandry |
| `temperatureRange` | Water Temperature |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `enrichment` | Tank Enrichment |  | Husbandry |
| `temperament` | Behavior Profile |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph/Variety |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `adultWeight` | Adult Weight |  | Physical |
| `weight` | Weight |  | Physical |
| `licenseNumber` | Permit Number |  | Legal & Documentation |
| `licenseJurisdiction` | Permit Jurisdiction |  | Legal & Documentation |
| `ovulationDate` | Spawn Readiness Date |  | Breeding |
| `lastPregnancyDate` | Last Spawn Date |  | Breeding |
| `weaningDate` | Free-Swimming Date |  | Breeding |
| `deliveryMethod` | Spawning Method |  | Breeding |
| `reproductiveClearances` | Health Clearances |  | Breeding |
| `vaccinations` | Vaccinations |  | Health |
| `allergies` | Sensitivities |  | Health |
| `humidity` | Water Humidity |  | Husbandry |
| `noise` | Tank Environment Noise |  | Husbandry |
| `exerciseRequirements` | Swimming Space Requirements |  | Husbandry |
| `handlingTolerance` | Handling Stress Tolerance |  | Behavior |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export/Import Restrictions |  | Legal & Documentation |

### ❌ Disabled Fields (40)

| Field Name | Label |
|------------|-------|
| `coat` | Coat Type |
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `microchipNumber` | Microchip # |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `isNeutered` | Neutered/Spayed |
| `spayNeuterDate` | Spay/Neuter Date |
| `heatStatus` | Heat Status |
| `lastHeatDate` | Last Heat Date |
| `nursingStartDate` | Nursing Start Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `dentalRecords` | Dental Records |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |
| `groomingNeeds` | Grooming Needs |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `leashTrained` | Leash Trained |
| `trainingLevel` | Training Level |
| `trainingDisciplines` | Training Disciplines |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `biteHistory` | Bite History |
| `reactivityNotes` | Reactivity Notes |
| `workingTitles` | Working Titles |

---

---

## Invertebrate Template

**Enabled:** 80 fields | **Disabled:** 51 fields

### ✅ Enabled Template Fields (80)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coatPattern` | Exoskeleton Pattern |  | Overview |
| `lifeStage` | Life Stage (Instar) |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `length` | Leg Span/Length |  | Physical |
| `origin` | Origin |  | Lineage |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Hatch/Emergence Date |  | Breeding |
| `litterCount` | Egg Count/Offspring Count |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Mating Date |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `gestationLength` | Egg Sac/Incubation Period |  | Breeding |
| `reproductiveComplications` | Egg Sac/Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `parasiteControl` | Mite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `medications` | Medications |  | Health |
| `parasitePreventionSchedule` | Mite Prevention |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `housingType` | Enclosure Type |  | Husbandry |
| `bedding` | Substrate |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `biteHistory` | Sting/Bite History |  | Behavior |
| `reactivityNotes` | Defensive Behavior/Venom Notes |  | Behavior |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph/Color Form |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |
| `adultWeight` | Adult Weight |  | Physical |
| `weight` | Weight |  | Physical |
| `pedigreeRegistrationId` | Breeding Registration # |  | Identification |
| `breed` | Species/Locality |  | Overview |
| `strain` | Strain/Lineage |  | Overview |
| `licenseNumber` | Permit Number |  | Legal & Documentation |
| `licenseJurisdiction` | Permit Jurisdiction |  | Legal & Documentation |
| `ovulationDate` | Egg-laying Date |  | Breeding |
| `weaningDate` | Independence/Dispersal Date |  | Breeding |
| `lastPregnancyDate` | Last Reproduction Date |  | Breeding |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `damFertilityStatus` | Female Fertility Status |  | Breeding |
| `damFertilityNotes` | Female Fertility Notes |  | Breeding |
| `deliveryMethod` | Egg-laying Method |  | Breeding |
| `reproductiveClearances` | Breeding Clearances |  | Breeding |
| `isInfertile` | Infertile |  | Breeding |
| `dewormingRecords` | Parasite Treatment |  | Health |
| `allergies` | Environmental Sensitivities |  | Health |
| `supplements` | Nutritional Supplements |  | Husbandry |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Exotic Vet Visits |  | Health |
| `primaryVet` | Primary Exotic Veterinarian |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |

### ❌ Disabled Fields (51)

| Field Name | Label |
|------------|-------|
| `coat` | Coat Type |
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `microchipNumber` | Microchip # |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `isNeutered` | Neutered/Spayed |
| `spayNeuterDate` | Spay/Neuter Date |
| `heatStatus` | Heat Status |
| `lastHeatDate` | Last Heat Date |
| `nursingStartDate` | Nursing Start Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `vaccinations` | Vaccinations |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `dentalRecords` | Dental Records |
| `noise` | Noise Levels |
| `exerciseRequirements` | Exercise Requirements |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |
| `groomingNeeds` | Grooming Needs |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `leashTrained` | Leash Trained |
| `trainingLevel` | Training Level |
| `trainingDisciplines` | Training Disciplines |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `workingTitles` | Working Titles |

---

---

## Other Template

**Enabled:** 96 fields | **Disabled:** 35 fields

### ✅ Enabled Template Fields (96)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coat` | Coat/Covering Type |  | Overview |
| `coatPattern` | Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Length |  | Physical |
| `pedigreeRegistrationId` | Registration # |  | Identification |
| `breed` | Species/Type |  | Overview |
| `strain` | Strain/Line |  | Overview |
| `licenseNumber` | License/Permit Number |  | Legal & Documentation |
| `licenseJurisdiction` | License Jurisdiction |  | Legal & Documentation |
| `origin` | Origin |  | Lineage |
| `ovulationDate` | Reproduction Date |  | Breeding |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Due Date |  | Breeding |
| `litterCount` | Offspring Count Expected |  | Breeding |
| `weaningDate` | Independence Date |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Mating Date |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `lastPregnancyDate` | Last Reproduction Date |  | Breeding |
| `offspringCount` | Total Offspring |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Female Fertility Status |  | Breeding |
| `damFertilityNotes` | Female Fertility Notes |  | Breeding |
| `gestationLength` | Gestation/Incubation Period |  | Breeding |
| `deliveryMethod` | Birth/Laying Method |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `reproductiveClearances` | Breeding Clearances |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `vaccinations` | Vaccinations/Treatments |  | Health |
| `dewormingRecords` | Deworming/Parasite Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `allergies` | Allergies/Sensitivities |  | Health |
| `medications` | Medications |  | Health |
| `medicalProcedures` | Medical Procedures |  | Health |
| `labResults` | Lab Results |  | Health |
| `vetVisits` | Veterinary Visits |  | Health |
| `primaryVet` | Primary Veterinarian |  | Health |
| `parasitePreventionSchedule` | Parasite Prevention |  | Health |
| `geneticTestResults` | Genetic Test Results |  | Health |
| `chronicConditions` | Chronic Conditions |  | Health |
| `dietType` | Diet Type |  | Husbandry |
| `feedingSchedule` | Feeding Schedule |  | Husbandry |
| `supplements` | Supplements |  | Husbandry |
| `housingType` | Housing/Enclosure Type |  | Husbandry |
| `bedding` | Bedding/Substrate |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `noise` | Environmental Noise |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `exerciseRequirements` | Activity Requirements |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite/Defensive History |  | Behavior |
| `reactivityNotes` | Behavioral Notes |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph/Variety |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

### ❌ Disabled Fields (35)

| Field Name | Label | Reason |
|------------|-------|--------|
| `earset` | Earset | Mammal-specific anatomy |
| `heightAtWithers` | Height at Withers | Dog/horse-specific measurement |
| `chestGirth` | Chest Girth | Large mammal-specific |
| `microchipNumber` | Microchip # | Primarily for mammals |
| `rabiesTagNumber` | Rabies Tag # | Mammal-specific vaccination |
| `tattooId` | Tattoo ID | Primarily for livestock/mammals |
| `akcRegistrationNumber` | AKC Registration # | Dog-specific registry |
| `fciRegistrationNumber` | FCI Registration # | Dog-specific registry |
| `cfaRegistrationNumber` | CFA Registration # | Cat-specific registry |
| `workingRegistryIds` | Working Registry IDs | Primarily mammal working animals |
| `isNeutered` | Neutered/Spayed | Mammal-specific procedure |
| `spayNeuterDate` | Spay/Neuter Date | Mammal-specific procedure |
| `heatStatus` | Heat Status | Mammal estrus cycle |
| `lastHeatDate` | Last Heat Date | Mammal estrus cycle |
| `nursingStartDate` | Nursing Start Date | Mammalian lactation |
| `estrusCycleLength` | Cycle Length (days) | Mammal estrus cycle |
| `artificialInseminationUsed` | Artificial Insemination Used | Advanced breeding technique |
| `whelpingDate` | Birth/Hatch Date | Mammal-specific birth terminology |
| `queeningDate` | Queening Date | Cat-specific birth terminology |
| `heartwormStatus` | Heartworm Status | Canine/feline-specific parasite |
| `hipElbowScores` | Hip/Elbow Scores | Dog-specific health scores |
| `eyeClearance` | Eye Clearance | Breed-specific health clearance |
| `cardiacClearance` | Cardiac Clearance | Breed-specific health clearance |
| `dentalRecords` | Dental Records | Mammal dental care |
| `dailyExerciseMinutes` | Daily Exercise (minutes) | Primarily for dogs |
| `groomingNeeds` | Grooming Needs | Mammal coat/fur care |
| `sheddingLevel` | Shedding Level | Mammal fur characteristic |
| `crateTrained` | Crate Trained | Dog training concept |
| `litterTrained` | Litter Trained | Cat/small mammal training |
| `leashTrained` | Leash Trained | Dog/some bird training |
| `trainingLevel` | Training Level | Primarily mammal/bird concept |
| `trainingDisciplines` | Training Disciplines | Specific training fields |
| `certifications` | Certifications | Working animal certifications |
| `workingRole` | Working Role | Primarily for working mammals |
| `workingTitles` | Working Titles | Competition/working titles |

---

---
