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

**Images & Display:**
- `imageUrl` - Image URL (consolidated from photoUrl)
- `originalOwner` - Original creator (for transfer returns)
- `transferredFrom` - Who sent animal to current owner
- `isTransferred` - Boolean: received via transfer
- `tags` - Organization tags
- `showOnPublicProfile` - Public visibility toggle
- `isDisplay` - Display on public profile

**Tracking:**
- `growthRecords` - Growth history array
- `measurementUnits` - Measurement preferences

---

## Small Mammal Template

**Enabled:** 99 fields | **Disabled:** 42 fields

### ✅ Enabled Template Fields (96)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `color` | Color |  | Overview |
| `coat` | Coat Type |  | Overview |
| `earset` | Earset |  | Physical |
| `coatPattern` | Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Body/Tail Length |  | Physical |
| `carrierTraits` | Carrier Traits |  | Physical |
| `pedigreeRegistrationId` | Pedigree Registration # |  | Identification |
| `breed` | Breed |  | Overview |
| `strain` | Strain |  | Overview |
| `origin` | Origin |  | Lineage |
| `isNeutered` | Neutered/Spayed |  | Breeding |
| `spayNeuterDate` | Spay/Neuter Date |  | Breeding |
| `heatStatus` | Heat Status |  | Breeding |
| `lastHeatDate` | Last Heat Date |  | Breeding |
| `ovulationDate` | Ovulation Date |  | Breeding |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Due Date |  | Breeding |
| `litterCount` | Litter Count |  | Breeding |
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
| `damFertilityStatus` | Dam Fertility Status |  | Breeding |
| `damFertilityNotes` | Dam Fertility Notes |  | Breeding |
| `estrusCycleLength` | Estrus Cycle Length (days) |  | Breeding |
| `gestationLength` | Gestation Length (days) |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Pregnant |  | Breeding |
| `isNursing` | Nursing |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
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

### ❌ Disabled Fields (42)

| Field Name | Label |
|------------|-------|
| `microchipNumber` | Microchip # |
| `licenseNumber` | License Number |
| `licenseJurisdiction` | License Jurisdiction |
| `rabiesTagNumber` | Rabies Tag # |
| `tattooId` | Tattoo ID |
| `akcRegistrationNumber` | AKC Registration # |
| `fciRegistrationNumber` | FCI Registration # |
| `cfaRegistrationNumber` | CFA Registration # |
| `workingRegistryIds` | Working Registry IDs |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `deliveryMethod` | Delivery Method |
| `reproductiveClearances` | Reproductive Clearances |
| `parasitePreventionSchedule` | Parasite Prevention Schedule |
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
| `insurance` | Insurance |
| `legalStatus` | Legal Status |
| `coOwnership` | Co-Ownership |
| `breedingRestrictions` | Breeding Restrictions |
| `exportRestrictions` | Export Restrictions |
| `morph` | Morph |
| `colonyId` | Colony ID |
| `groupRole` | Group Role |
| `freeFlightTrained` | Free Flight Trained |

---

## Full Mammal Template

**Enabled:** 130 fields | **Disabled:** 11 fields

### ✅ Enabled Template Fields (127)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
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
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `microchipNumber` | Microchip # |  | Identification |
| `pedigreeRegistrationId` | Pedigree Registration # |  | Identification |
| `breed` | Breed |  | Overview |
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
| `matingDates` | Mating Dates |  | Breeding |
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
| `damFertilityStatus` | Dam Fertility Status |  | Breeding |
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
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Pregnant |  | Breeding |
| `isNursing` | Nursing |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
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
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

### ❌ Disabled Fields (11)

| Field Name | Label | Reason |
|------------|-------|--------|
| `earset` | Earset | Not standard for dogs/cats |
| `strain` | Bloodline/Strain | Not standard for dogs/cats |
| `length` | Length | Not a standard measurement for larger mammals |
| `temperatureRange` | Temperature Range | Environmental control not needed for most mammals |
| `humidity` | Humidity | Environmental control not needed for most mammals |
| `lighting` | Lighting | Not critical for standard dog/cat husbandry |
| `morph` | Morph | Not applicable to mammals |
| `colonyId` | Colony ID | Not applicable to larger mammals |
| `carrierTraits` | Carrier Traits | Use geneticTestResults instead |
| `groupRole` | Group Role | Not standard for most mammal breeders |
| `freeFlightTrained` | Free Flight Trained | Bird-specific |

---

## Reptile Template

**Enabled:** 94 fields | **Disabled:** 47 fields

### ✅ Enabled Template Fields (91)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
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
| `length` | Total Length |  | Physical |
| `microchipNumber` | Microchip # |  | Identification |
| `pedigreeRegistrationId` | Registry/Studbook # |  | Identification |
| `licenseNumber` | CITES/License Number |  | Legal & Documentation |
| `licenseJurisdiction` | License Jurisdiction |  | Legal & Documentation |
| `origin` | Origin |  | Lineage |
| `ovulationDate` | Pre-lay/Ovulation Date |  | Breeding |
| `matingDates` | Breeding Dates |  | Breeding |
| `expectedDueDate` | Expected Lay/Birth Date |  | Breeding |
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
| `damFertilityStatus` | Female Fertility Status |  | Breeding |
| `damFertilityNotes` | Female Fertility Notes |  | Breeding |
| `gestationLength` | Incubation/Gestation Period (days) |  | Breeding |
| `deliveryMethod` | Egg-laying/Live Birth |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Gravid |  | Breeding |
| `isNursing` | Brooding |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
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
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph |  | Physical |
| `markings` | Pattern/Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

### ❌ Disabled Fields (47)

| Field Name | Label |
|------------|-------|
| `coat` | Coat Type |
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `breed` | Breed/Species Locality |
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
| `nursingStartDate` | Nursing Start Date |
| `weaningDate` | Weaning Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `reproductiveClearances` | Reproductive Clearances |
| `vaccinations` | Vaccinations |
| `allergies` | Allergies |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `dentalRecords` | Dental Records |
| `noise` | Noise Levels |
| `exerciseRequirements` | Exercise Requirements |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `leashTrained` | Leash Trained |
| `trainingLevel` | Training Level |
| `trainingDisciplines` | Training Disciplines |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `workingTitles` | Working Titles |
| `insurance` | Insurance |
| `colonyId` | Colony ID |
| `carrierTraits` | Carrier Traits |
| `groupRole` | Group Role |
| `freeFlightTrained` | Free Flight Trained |

---

## Bird Template

**Enabled:** 107 fields | **Disabled:** 34 fields

### ✅ Enabled Template Fields (107)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
| `breederyId` | Band Number |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `colonyId` | Flock/Aviary ID |  | Identification |
| `carrierTraits` | Carrier Traits |  | Physical |
| `color` | Color |  | Overview |
| `coat` | Feather Type |  | Overview |
| `coatPattern` | Plumage Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Wingspan |  | Physical |
| `eyeColor` | Eye Color |  | Physical |
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
| `weaningDate` | Fledging/Weaning Date |  | Breeding |
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
| `damFertilityStatus` | Female Fertility Status |  | Breeding |
| `damFertilityNotes` | Female Fertility Notes |  | Breeding |
| `gestationLength` | Incubation Period (days) |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Gravid/Egg-Laying |  | Breeding |
| `isNursing` | Brooding/Chick Rearing |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
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
| `noise` | Vocalizations/Noise |  | Husbandry |
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
| `freeFlightTrained` | Free Flight Trained |  | Behavior |
| `leashTrained` | Harness Trained |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status/CITES |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Mutation/Morph |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

### ❌ Disabled Fields (33)

| Field Name | Label |
|------------|-------|
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `nailColor` | Nail Color |
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
| `deliveryMethod` | Delivery Method |
| `reproductiveClearances` | Reproductive Clearances |
| `allergies` | Allergies |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `eyeClearance` | Eye Clearance |
| `cardiacClearance` | Cardiac Clearance |
| `sheddingLevel` | Shedding Level |
| `crateTrained` | Crate Trained |
| `litterTrained` | Litter Trained |
| `certifications` | Certifications |
| `workingRole` | Working Role |
| `workingTitles` | Working Titles |
| `strain` | Strain |
| `groupRole` | Group Role |

---

## Amphibian Template

**Enabled:** 89 fields | **Disabled:** 39 fields

### ✅ Enabled Template Fields (89)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
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
| `licenseNumber` | CITES/Export License |  | Legal & Documentation |
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
| `damFertilityStatus` | Female Fertility Status |  | Breeding |
| `damFertilityNotes` | Female Fertility Notes |  | Breeding |
| `gestationLength` | Development Period |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Gravid |  | Breeding |
| `isNursing` | Brooding/Guarding Eggs |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
| `breed` | Species/Locality |  | Overview |
| `strain` | Strain/Lineage |  | Overview |
| `microchipNumber` | Microchip # |  | Identification |
| `weaningDate` | Metamorphosis Date |  | Breeding |
| `deliveryMethod` | Spawning Method |  | Breeding |
| `reproductiveClearances` | Health Clearances |  | Breeding |
| `vaccinations` | Vaccinations/Treatments |  | Health |
| `dewormingRecords` | Deworming Records |  | Health |
| `parasiteControl` | Parasite Control |  | Health |
| `medicalConditions` | Medical Conditions |  | Health |
| `allergies` | Environmental Sensitivities |  | Health |
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
| `noise` | Vocalization/Calling |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `exerciseRequirements` | Activity Space Requirements |  | Husbandry |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite/Toxin Contact History |  | Behavior |
| `reactivityNotes` | Stress Response Notes |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `insurance` | Insurance |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

### ❌ Disabled Fields (52)

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
| `colonyId` | Colony ID |
| `carrierTraits` | Carrier Traits |
| `groupRole` | Group Role |
| `freeFlightTrained` | Free Flight Trained |

---

## Fish Template

**Enabled:** 80 fields | **Disabled:** 61 fields

### ✅ Enabled Template Fields (77)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
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
| `breed` | Variety |  | Overview |
| `strain` | Breeding Line |  | Overview |
| `origin` | Origin |  | Lineage |
| `matingDates` | Spawn Dates |  | Breeding |
| `expectedDueDate` | Expected Hatch Date |  | Breeding |
| `litterCount` | Fry Count |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Pairing Date |  | Breeding |
| `successfulMatings` | Successful Spawns |  | Breeding |
| `offspringCount` | Offspring Count |  | Breeding |
| `isStudAnimal` | Breeding Male |  | Overview |
| `availableForBreeding` | Available for Breeding |  | Overview |
| `studFeeCurrency` | Breeding Fee Currency |  | Overview |
| `studFeeAmount` | Breeding Fee Amount |  | Overview |
| `fertilityStatus` | Fertility Status |  | Breeding |
| `fertilityNotes` | Fertility Notes |  | Breeding |
| `isDamAnimal` | Breeding Female |  | Breeding |
| `damFertilityStatus` | Female Fertility Status |  | Breeding |
| `damFertilityNotes` | Female Fertility Notes |  | Breeding |
| `gestationLength` | Incubation Period |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Gravid |  | Breeding |
| `isNursing` | Mouthbrooding |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
| `adultWeight` | Adult Weight |  | Physical |
| `weight` | Weight |  | Physical |
| `licenseNumber` | Permit Number |  | Legal & Documentation |
| `licenseJurisdiction` | Permit Jurisdiction |  | Legal & Documentation |
| `ovulationDate` | Spawn Readiness Date |  | Breeding |
| `lastPregnancyDate` | Last Spawn Date |  | Breeding |
| `weaningDate` | Free-Swimming Date |  | Breeding |
| `deliveryMethod` | Spawning Method |  | Breeding |
| `reproductiveClearances` | Health Clearances |  | Breeding |
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
| `humidity` | Water Parameters/pH |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `noise` | Tank Environment Noise |  | Husbandry |
| `enrichment` | Tank Enrichment |  | Husbandry |
| `exerciseRequirements` | Swimming Space Requirements |  | Husbandry |
| `temperament` | Behavior Profile |  | Behavior |
| `handlingTolerance` | Handling Stress Tolerance |  | Behavior |
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
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export/Import Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph/Variety |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

> ⚠️ **Fish Notes:** `breed` ("Variety") and `strain` ("Breeding Line") may overlap for some keepers — review whether both are needed per use case. `humidity` repurposed as "Water Parameters/pH" since atmospheric humidity is N/A for fish.

### ❌ Disabled Fields (61)

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
| `vaccinations` | Vaccinations |
| `allergies` | Sensitivities/Allergies |
| `colonyId` | Colony ID |
| `carrierTraits` | Carrier Traits |
| `groupRole` | Group Role |
| `freeFlightTrained` | Free Flight Trained |

---

## Invertebrate Template

**Enabled:** 64 fields | **Disabled:** 77 fields

### ✅ Enabled Template Fields (61)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
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
| `expectedDueDate` | Expected Egg Sac/Hatch Date |  | Breeding |
| `litterCount` | Spiderling/Nymph Count |  | Breeding |
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
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `isPregnant` | Gravid/Egg-Bearing |  | Breeding |
| `isNursing` | Guarding Egg Sac |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
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
| `adultWeight` | Adult Weight |  | Physical |
| `weight` | Weight |  | Physical |
| `pedigreeRegistrationId` | Breeding Registration # |  | Identification |
| `breed` | Species/Locality |  | Overview |
| `remarks` | Notes/Remarks |  | Overview |

> ⚠️ **Invertebrate Notes:** `bodyConditionScore` — BCS is a mammal-derived scoring system; has limited applicability to most invertebrates, consider disabling per use case. `colonyId` is disabled but should be enabled for colonial species (ants, bees, termites). `licenseNumber` (disabled) — CITES permits apply to some species (e.g. certain tarantulas, beetles); consider enabling for those.

### ❌ Disabled Fields (77)

| Field Name | Label |
|------------|-------|
| `coat` | Coat Type |
| `earset` | Earset |
| `heightAtWithers` | Height at Withers |
| `chestGirth` | Chest Girth |
| `microchipNumber` | Microchip # |
| `strain` | Strain |
| `licenseNumber` | Permit Number |
| `licenseJurisdiction` | Permit Jurisdiction |
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
| `weaningDate` | Independence/Dispersal Date |
| `estrusCycleLength` | Estrus Cycle Length (days) |
| `artificialInseminationUsed` | Artificial Insemination Used |
| `whelpingDate` | Whelping Date |
| `queeningDate` | Queening Date |
| `deliveryMethod` | Delivery Method |
| `reproductiveClearances` | Reproductive Clearances |
| `lastPregnancyDate` | Last Reproduction Date |
| `isInfertile` | Infertile |
| `fertilityStatus` | Fertility Status |
| `fertilityNotes` | Fertility Notes |
| `damFertilityStatus` | Female Fertility Status |
| `damFertilityNotes` | Female Fertility Notes |
| `vaccinations` | Vaccinations |
| `dewormingRecords` | Deworming Records |
| `allergies` | Allergies |
| `supplements` | Supplements |
| `medicalProcedures` | Medical Procedures |
| `labResults` | Lab Results |
| `vetVisits` | Vet Visits |
| `primaryVet` | Primary Veterinarian |
| `heartwormStatus` | Heartworm Status |
| `hipElbowScores` | Hip/Elbow Scores |
| `geneticTestResults` | Genetic Test Results |
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
| `behavioralIssues` | Behavioral Issues |
| `workingTitles` | Working Titles |
| `showTitles` | Show Titles |
| `showRatings` | Show Ratings |
| `judgeComments` | Judge Comments |
| `performanceScores` | Performance Scores |
| `necropsyResults` | Necropsy Results |
| `insurance` | Insurance |
| `endOfLifeCareNotes` | End of Life Care Notes |
| `coOwnership` | Co-Ownership |
| `breedingRestrictions` | Breeding Restrictions |
| `geneticCode` | Genetic Code |
| `colonyId` | Colony ID |
| `carrierTraits` | Carrier Traits |
| `groupRole` | Group Role |
| `freeFlightTrained` | Free Flight Trained |
| `strain` | Strain/Line |

---

## Other Template

**Enabled:** 142 fields | **Disabled:** 0 fields

*This is the flexible catch-all template. All fields are enabled to accommodate any animal type not covered by a dedicated template.*

### ✅ Enabled Template Fields (139)

| Field Name | Label | Required | Tab |
|------------|-------|----------|-----|
| `prefix` | Prefix |  | Overview |
| `suffix` | Suffix |  | Overview |
| `isOwned` | Currently Owned |  | Status & Privacy |
| `manualBreederName` | Breeder Name (Manual) |  | Overview |
| `breederyId` | Breeder ID |  | Identification |
| `currentOwnerDisplay` | Current Owner |  | Status & Privacy |
| `ownershipHistory` | Ownership History |  | Status & Privacy |
| `colonyId` | Colony ID |  | Identification |
| `groupRole` | Group Role |  | Status & Privacy |
| `carrierTraits` | Carrier Traits |  | Physical |
| `color` | Color |  | Overview |
| `coat` | Coat/Covering Type |  | Overview |
| `earset` | Earset |  | Physical |
| `coatPattern` | Pattern |  | Overview |
| `lifeStage` | Life Stage |  | Physical |
| `heightAtWithers` | Height at Withers |  | Physical |
| `bodyLength` | Body Length |  | Physical |
| `chestGirth` | Chest Girth |  | Physical |
| `adultWeight` | Adult Weight |  | Physical |
| `bodyConditionScore` | Body Condition Score |  | Physical |
| `weight` | Weight |  | Physical |
| `length` | Length |  | Physical |
| `microchipNumber` | Microchip # |  | Identification |
| `pedigreeRegistrationId` | Pedigree Registration # |  | Identification |
| `breed` | Breed/Species/Type |  | Overview |
| `strain` | Strain/Line |  | Overview |
| `licenseNumber` | License/Permit Number |  | Legal & Documentation |
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
| `ovulationDate` | Ovulation/Reproduction Date |  | Breeding |
| `matingDates` | Mating Dates |  | Breeding |
| `expectedDueDate` | Expected Due Date |  | Breeding |
| `litterCount` | Litter/Clutch Count |  | Breeding |
| `nursingStartDate` | Nursing Start Date |  | Breeding |
| `weaningDate` | Weaning/Independence Date |  | Breeding |
| `breedingRole` | Breeding Role |  | Breeding |
| `lastMatingDate` | Last Mating Date |  | Breeding |
| `successfulMatings` | Successful Matings |  | Breeding |
| `lastPregnancyDate` | Last Pregnancy/Reproduction Date |  | Breeding |
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
| `estrusCycleLength` | Cycle Length (days) |  | Breeding |
| `gestationLength` | Gestation/Incubation Period |  | Breeding |
| `artificialInseminationUsed` | Artificial Insemination Used |  | Breeding |
| `whelpingDate` | Birth/Hatch Date |  | Breeding |
| `queeningDate` | Queening Date |  | Breeding |
| `deliveryMethod` | Delivery/Birth Method |  | Breeding |
| `reproductiveComplications` | Reproductive Complications |  | Breeding |
| `reproductiveClearances` | Reproductive Clearances |  | Breeding |
| `isForSale` | For Sale |  | Overview |
| `salePriceCurrency` | Sale Price Currency |  | Overview |
| `salePriceAmount` | Sale Price Amount |  | Overview |
| `isInfertile` | Infertile |  | Breeding |
| `isPregnant` | Pregnant |  | Breeding |
| `isNursing` | Nursing |  | Breeding |
| `isInMating` | In Mating |  | Breeding |
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
| `housingType` | Housing/Enclosure Type |  | Husbandry |
| `bedding` | Bedding/Substrate |  | Husbandry |
| `temperatureRange` | Temperature Range |  | Husbandry |
| `humidity` | Humidity |  | Husbandry |
| `lighting` | Lighting |  | Husbandry |
| `noise` | Environmental Noise |  | Husbandry |
| `enrichment` | Enrichment |  | Husbandry |
| `exerciseRequirements` | Activity Requirements |  | Husbandry |
| `dailyExerciseMinutes` | Daily Exercise (minutes) |  | Husbandry |
| `groomingNeeds` | Grooming Needs |  | Husbandry |
| `sheddingLevel` | Shedding Level |  | Husbandry |
| `crateTrained` | Crate Trained |  | Behavior |
| `litterTrained` | Litter Trained |  | Behavior |
| `leashTrained` | Leash/Harness Trained |  | Behavior |
| `freeFlightTrained` | Free Flight Trained |  | Behavior |
| `temperament` | Temperament |  | Behavior |
| `handlingTolerance` | Handling Tolerance |  | Behavior |
| `socialStructure` | Social Behavior |  | Behavior |
| `activityCycle` | Activity Cycle |  | Behavior |
| `trainingLevel` | Training Level |  | Behavior |
| `trainingDisciplines` | Training Disciplines |  | Behavior |
| `certifications` | Certifications |  | Behavior |
| `workingRole` | Working Role |  | Behavior |
| `behavioralIssues` | Behavioral Issues |  | Behavior |
| `biteHistory` | Bite/Defensive History |  | Behavior |
| `reactivityNotes` | Behavioral Notes |  | Behavior |
| `showTitles` | Show Titles |  | Records |
| `showRatings` | Show Ratings |  | Records |
| `judgeComments` | Judge Comments |  | Records |
| `workingTitles` | Working Titles |  | Records |
| `performanceScores` | Performance Scores |  | Records |
| `causeOfDeath` | Cause of Death |  | End of Life |
| `necropsyResults` | Necropsy Results |  | End of Life |
| `endOfLifeCareNotes` | End of Life Care Notes |  | End of Life |
| `insurance` | Insurance |  | Legal & Documentation |
| `legalStatus` | Legal Status/Permits |  | Legal & Documentation |
| `coOwnership` | Co-Ownership |  | Status & Privacy |
| `transferHistory` | Transfer History |  | Legal & Documentation |
| `breedingRestrictions` | Breeding Restrictions |  | Legal & Documentation |
| `exportRestrictions` | Export Restrictions |  | Legal & Documentation |
| `geneticCode` | Genetic Code |  | Overview |
| `phenotype` | Phenotype |  | Physical |
| `morph` | Morph/Variety |  | Physical |
| `markings` | Markings |  | Physical |
| `remarks` | Notes/Remarks |  | Overview |

---
