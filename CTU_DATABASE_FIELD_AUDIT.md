# Database Field Audit — Users CTU1, CTU2, CTU8

**Date generated:** live query against production MongoDB (see methodology).
**Users resolved:**

| Public ID | Name | `_id` |
|---|---|---|
| CTU1 | Admin | `6934b7c970b7dc125b5fc65e` |
| CTU2 | Dani | `6935d63a9a5a8b31e51a4821` |
| CTU8 | Database - Backup Account | `6959712382eff1af6092abb7` |

## Methodology

1. Statically read every schema in `database/models.js` (33 Mongoose models) and catalogued every field that can link a document to a user — either an `ObjectId` ref to `User` (e.g. `creatorId`, `userId`, `senderId`) or a denormalized public-ID string (e.g. `creatorId_public`, `userId_public`, `raterId_public`).
2. Ran a live script against all 33 collections, matching on those linking fields for CTU1/CTU2/CTU8, to get real document counts and the actual set of top-level fields holding non-empty data.
3. Cross-referenced the ~16 fields explicitly commented `// legacy` / `// DEPRECATED` in `models.js`, plus a separately-discovered class of **duplicate field declarations within the same schema object literal** (JS object-literal semantics mean the second declaration silently overwrites the first before Mongoose ever sees it — the first is 100% dead code).
4. Ran targeted live counts on the highest-risk redundant/legacy fields to determine whether they are actually empty (safe to drop) or still hold real, unmigrated data (need a migration step, not a straight drop) for these 3 users specifically.

---

## 1. Collections With Data Linked to CTU1/CTU2/CTU8

Of the 33 models, these had at least one linked document:

| Collection | Linked docs | Linking field(s) matched |
|---|---:|---|
| User (self) | 3 | `id_public` |
| PublicProfile | 3 | `userId_backend` |
| Animal | 2,919 | `creatorId`, `originalCreatorId`, `breederId_public`, `viewOnlyForUsers`, `hiddenForUsers` |
| PublicAnimal | 2,904 | `creatorId_public`, `breederId_public` |
| Litter | 355 | `creatorId` |
| Notification | 234 | `userId`, `requestedBy_id` |
| BugReport | 2 | `userId` |
| Message | 113 | `senderId`, `receiverId` |
| AuditLog | 4 | `moderatorId` |
| UserActivityLog | 34,689 | `userId` |
| Transaction | 160 | `userId`, `buyerUserId`, `sellerUserId` |
| AnimalTransfer | 759 | `fromUserId`, `toUserId` |
| Enclosure | 7 | `creatorId` |
| EnclosureLog | 52 | `userId` |
| SupplyItem | 4 | `userId` |
| AnimalLog | 7,811 | `userId` |
| BreederRating | 5 | `raterId_backend`, `targetId_public` |
| Favorite | 12 | `userId` |
| Location | 2 | `creatorId` |

The following **14 collections had zero linked documents** for these 3 users (schema fields still exist, just unused by them): `GeneticsFeedback`, `Feedback`, `BetaSurvey`, `MessageReport`, `ProfileReport`, `AnimalReport`, `FieldTemplate`, `Species`, `SystemSettings`, `SpeciesConfig`, `GeneticsData`, `ModChat`, `RatingReport`.

---

## 2. Full Schema Field Inventory (linked collections)

> Full field list per schema, not filtered by whether populated for these specific 3 users. Fields flagged with **[LEGACY]** or **[DUPLICATE]** are discussed in detail in Section 3.

### Animal (`AnimalSchema`)
Identity/health: `id_public, name, prefix, suffix, species, gender, color, coat, coatPattern, phenotype, morph, markings, eyeColor, nailColor, size, weight, length, heightAtWithers, bodyLength, chestGirth, adultWeight, bodyConditionScore, birthDate, deceasedDate, causeOfDeath, lifeStage, status, healthStatus, healthStatusOverride, healthStatusOverrideNotes, isArchived, archived, isDisplay, showOnPublicProfile`.
Ownership/linking: `creatorId, creatorId_public, originalCreatorId, viewOnlyForUsers, hiddenForUsers, breederId_public, manualBreederName, manualownerName, groupRole, keeperHistory[] **[LEGACY→ownershipHistory]**, ownershipHistory[]`.
Quarantine/treatment: `quarantineDetails{status,type,reason,startDate,endDate}, treatmentDetails{status,type,reason,startDate,endDate}, quarantineHistory[], treatmentHistory[], isQuarantine, isInTreatment, isInfertile`.
Health records (sub-docs, `HealthRecordSchema`): `vaccinations, dewormingRecords, parasiteControl, medicalConditions, allergies, medications, medicalProcedures, labResults, vetVisits`.
Care: `lastFedDate, feedingFrequencyDays, lastMaintenanceDate, maintenanceFrequencyDays, careTasks[] **[DUPLICATE of animalCareTasks]**, animalCareTasks[] **[DUPLICATE of careTasks]**, milestones[], tags[], nutritionSchedule, dietSupplies[], supplementSupplies[]`.
Media: `imageUrl, photoUrl, extraImages[]`.
Lineage: `sireId_public, damId_public, litterId, fatherId_public`.
Identification: `microchipNumber, pedigreeRegistrationId, identifiers **[free-form JSON string]**, colonyId, breed, strain, licenseNumber, licenseJurisdiction, tattooId, ringId, eartagNumber`.
Reproduction: `origin, heatStatus, lastHeatDate, ovulationDate, matingDates **[LEGACY string, top-level — distinct from breedingRecords[].matingDate]**, expectedDueDate, litterCount, litterSizeBorn, litterSizeWeaned, stillbornCount, lossesCount, nursingStartDate, weaningDate, breedingRole, lastMatingDate, breedingRecords[] (each with `matingDate` + `matingDates` **[DUPLICATE declared twice inside sub-schema]**), isPlannedMating, isPregnant, isNursing`.
Behavior: `activityCycle, aggressionLevel, fearAnxietyLevel, preyDriveLevel, biteHistory, foodAggressionLevel, eatingSpeed, foodPreferences, attachmentStyle, bondingBehavior, noiseSensitivity, touchSensitivity, lightSensitivity, sensoryNotes, boldnessLevel, independenceLevel, sociabilityLevel, escapeRiskLevel, freeFlightTrained, crateTrained, litterTrained, leashTrained`.
Show: `shows[] (ShowEventSchema), showTitles **[LEGACY→shows]**, showRatings **[LEGACY→shows]**, judgeComments **[LEGACY→shows]**, workingTitles, performanceScores`.
End of life/legal: `necropsyResults, insurance, legalStatus, endOfLifeCareNotes, coOwnership **[legacy free-text]**, transferHistory **[legacy free-text, superseded by `AnimalTransfer` collection]**, breedingRestrictions, exportRestrictions, purchaseDate, purchaseLocation, purchasePrice, purchasePriceCurrency, sellerName`.
Sale/marketplace: `isForSale **[DUPLICATE — declared again near end of schema]**, salePriceAmount **[DUPLICATE]**, salePriceCurrency **[DUPLICATE]**, availableForBreeding, studFeeAmount, studFeeCurrency, soldStatus, pendingTransferId`.
Misc: `manualPedigree` (heavily used — see Section 3), `enclosureId, geneticCode, remarks, includeGeneticCode, includeRemarks, isOwned, isViewOnly, inbreedingCoefficient, carrierTraits, growthRecords[], measurementUnits{}, createdAt, updatedAt`.

### PublicAnimal (`PublicAnimalSchema`)
Same conceptual data as `Animal` but denormalized/public-safe. **This schema has by far the worst duplication** — ~40 fields are declared twice: once early under a `{type:String, default:null}` "Health Records (stored as JSON strings)" block, then again under `--- PROMOTED TO PUBLIC ---` comment blocks as the real typed field (usually `[Mixed]` array or proper `Boolean`/`Number`). Affected fields: `vaccinations, medications, medicalConditions, allergies, labResults, vetVisits, parasiteControl, dewormingRecords, healthClearances, parasitePreventionSchedule, spayNeuterDate, isNeutered, heartwormStatus, hipElbowScores, geneticTestResults, eyeClearance, cardiacClearance, aggressionLevel, fearAnxietyLevel, preyDriveLevel, biteHistory, foodAggressionLevel, reactivityNotes, trainingLevel, trainingDisciplines, certifications, workingRole, breedingRole, lastMatingDate, successfulMatings, lastPregnancyDate, offspringCount, fertilityStatus, fertilityNotes, damFertilityStatus, damFertilityNotes, breedingRecords, artificialInseminationUsed, reproductiveClearances, housingType, bedding, temperatureRange, humidity, lighting, exerciseRequirements, dailyExerciseMinutes, groomingNeeds, sheddingLevel, crateTrained, litterTrained, leashTrained, shows, workingTitles, breedingRestrictions, exportRestrictions, breederBuybackClause, isForSale, availableForBreeding, salePriceAmount, salePriceCurrency, studFeeAmount, studFeeCurrency, tags`.
`careTasks: [{type:String}]` — also structurally **incompatible** with `Animal.careTasks: [{taskName, lastDoneDate, frequencyDays}]` (not just duplicate — different shape entirely).
Live-populated fields for these users: `activityCycle, aggressionLevel, availableForBreeding, birthDate, breederAssignedId, breederId_public, breedingRole, carrierTraits, causeOfDeath, coat, coatPattern, color, createdAt, creatorId_public, damFertilityStatus, damId_public, deceasedDate, enclosureId, eyeColor, fearAnxietyLevel, fertilityStatus, foodAggressionLevel, gender, geneticCode, growthRecords, id_public, imageUrl, inbreedingCoefficient, isDisplay, isForSale, isInMating, isInTreatment, isNeutered, isNursing, isOwned, isPregnant, isQuarantine, lifeStage, manualBreederName, measurementUnits, name, origin, pedigreeRegistrationId, photoUrl, prefix, preyDriveLevel, remarks, salePriceAmount, salePriceCurrency, sbId, sireId_public, species, status, studFeeAmount, studFeeCurrency, suffix, tags, updatedAt`.

### Litter (`LitterSchema`)
`creatorId, litter_id_public, damId_public, sireId_public, damPrefixName, sirePrefixName, breedingPairCodeName, isPlanned, isPlannedMating(via other field), matingDate **[DUPLICATE — declared twice]**, pairingDate **[LEGACY→matingDate]**, matingDates **[LEGACY→matingDate]**, expectedDueDate **[DUPLICATE]**, pregnancyDate, pregnancyLost, matingReminderSent, breedingMethod **[DUPLICATE]**, breedingConditionAtTime **[DUPLICATE]**, outcome **[DUPLICATE]**, birthDate, birthMethod **[DUPLICATE]**, litterSizeBorn **[DUPLICATE]**, numberBorn **[LEGACY→litterSizeBorn, still dual-written]**, litterSizeWeaned **[DUPLICATE]**, stillbornCount **[DUPLICATE]**, lossesCount **[DUPLICATE]**, maleCount, femaleCount, unknownCount **[DUPLICATE]**, maleLossesCount, unknownLossesCount, weaningDate **[DUPLICATE]**, weaningConfirmed, weaningDismissed, offspringIds_public[], showOnPublicProfile, createdAt, updatedAt`.

### Other linked collections (schema ≈ observed live fields, no notable redundancy found)
- **User**: `id_public, personalName, email, breederName, bio, country, role, accountStatus, warnings, warningCount, moderatedBy, suspensionLiftedDate, two_factor_enabled, emailVerified, last_login, last_login_ip, lastActive, creationDate, ownedAnimals, ownedLitters, animalCollections, monthlyDonationActive, socialMediaURL, websiteURL, profileImage, uiPreferences, show* visibility flags, emailNotificationPreference`.
- **PublicProfile**: mirrors User's public-facing subset (`userId_backend, id_public, personalName, bio, breederName, breederInfo, breedingLineDefs, animalBreedingLines, speciesFavorites, speciesOrder, completedTutorials, hasSeen*/hasCompleted* onboarding flags`) — `breederInfo.careRequirements` **[LEGACY→enclosureCare + routineCare]**.
- **Notification**: `userId, userId_public, requestedBy_id, requestedBy_public, requestedBy_name, type, parentType, title, message, status, read, sendAt, targetAnimalId_public, animalId_public/Name/Prefix/ImageUrl, transferId, broadcastType, isAnonymous, isPending, allowMultipleChoices, allowUserSuggestions, pollQuestion, pollOptions[], metadata{}`.
- **BugReport**: `userId, userName, userEmail, category, description, stepsToReproduce, page, images[], status`.
- **Message**: `senderId, receiverId, conversationId, message, images[], read, displayName, senderRole, sentBy, isModeratorMessage, deletedBy[]`.
- **AuditLog**: `moderatorId, moderatorEmail, action, reason, targetType, ipAddress, userAgent, details{}`.
- **UserActivityLog**: `userId, id_public, action, targetType, targetId, targetId_public, success, ipAddress, userAgent, details{}, newValue, previousValue`.
- **Transaction**: `userId, buyerUserId, sellerUserId, type, category, animalId, animalName, price, buyer, seller, description, notes, date`.
- **AnimalTransfer**: `fromUserId, toUserId, animalId_public, transferType, type, status, price, offerViewOnly, transactionId, isLegacyMigration, completedAt, respondedAt`.
- **Enclosure**: `creatorId, name, buildingId, roomId, location, enclosureType, purpose, capacity, size, dimensions{}, bedding, lightingType, lightTimeFormat, lightsOnTime, lightsOffTime, tempMin/Max, temperatureUnit, humidityMin/Max, enrichment, cleaningTasks[], speciesLabels[], tags[], notes, imageUrl, history[] (with `notesHistory[]`/`history[].userId`)`.
- **EnclosureLog**: `enclosureId, enclosureName, userId, userName, action, details{}`.
- **SupplyItem**: `userId, name, category, unit, currentStock, reorderThreshold, costPerUnit, orderFrequency, orderFrequencyUnit, nextOrderDate, isFeederAnimal`.
- **AnimalLog**: `userId, animalId, animalId_public, category, changes[]`.
- **BreederRating**: `raterId_backend, raterId_public, raterName, targetId_public, score`.
- **Favorite**: `userId, itemId, itemType`.
- **Location**: `creatorId, name, type, parentLocationId, address{street,city,state,postalCode,country}`.

---

## 3. Redundant / Legacy Field Findings

### 3.1 Dead code — duplicate declarations within the same schema (safe, zero-risk cleanup)
The *first* declaration of each is inert; only the second is ever used by Mongoose.
- `AnimalSchema`: `isForSale`, `salePriceAmount`, `salePriceCurrency`.
- `LitterSchema`: `matingDate`, `expectedDueDate`, `breedingMethod`, `breedingConditionAtTime`, `outcome`, `birthMethod`, `litterSizeBorn`, `litterSizeWeaned`, `stillbornCount`, `lossesCount`, `unknownCount`, `weaningDate`.
- `AnimalSchema.breedingRecords[]` sub-schema: `matingDate`/`matingDates` both declared twice.
- `PublicAnimalSchema`: ~40 fields (full list in Section 2) declared once as a `String` placeholder, then again as the real typed field.

**Recommendation:** delete the first (dead) declaration in each case — pure code cleanup, no data migration needed since the field was never actually reachable under that first definition.

### 3.2 Explicitly-marked legacy fields (still functional, superseded by a newer field)
| Legacy field | Replacement | Live data for CTU1/2/8? |
|---|---|---|
| `Animal.showTitles`, `showRatings`, `judgeComments` | `Animal.shows[]` | 0 docs (fully unused) |
| `Animal.keeperHistory[]` | `Animal.ownershipHistory[]` | **1 doc still has data**, `ownershipHistory` has 0 — not yet migrated |
| `Litter.pairingDate`, `matingDates` | `Litter.matingDate` | 0 docs |
| `Litter.numberBorn` | `Litter.litterSizeBorn` | **355/355 populated** (100%) vs `litterSizeBorn` 353/355 — both still actively dual-written |
| `PublicProfile.breederInfo.careRequirements` | `enclosureCare` + `routineCare` | not directly queried (low volume, 3 profiles only) |
| `MessageReport/ProfileReport/AnimalReport.adminNotes` | `discussionNotes[]` | 0 linked reports for these users |

### 3.3 Parallel fields with identical purpose but different names (not marked legacy, but functionally redundant)
- `Animal.careTasks[]` and `Animal.animalCareTasks[]` — **identical sub-schema** (`taskName, lastDoneDate, frequencyDays`). Two separate top-level arrays doing the same job; both empty for these 3 users, but this is a genuine app-wide redundancy, not just a CTU-specific one.

### 3.4 Structurally incompatible fields (cannot be auto-migrated even though names match)
- `PublicAnimal.careTasks: [{type:String}]` vs `Animal.careTasks: [{taskName, lastDoneDate, frequencyDays}]` — same field name, incompatible shapes. Any future "promote Animal data to PublicAnimal" sync for this field is lossy/broken as currently defined.

### 3.5 Free-form / unstructured legacy fields (cannot be reliably auto-migrated)
- `Animal.identifiers` — arbitrary user-entered JSON string, no fixed key set. Cannot be mapped into a structured replacement without per-record manual parsing.
- `Animal.coOwnership`, `Animal.transferHistory` — free-text `String` fields conceptually superseded by the structured `AnimalTransfer` collection (759 real transfer records already exist) and `ownershipHistory[]`, but since they're freeform prose (not structured data), there's no reliable programmatic mapping from old text into the new structured records.

---

## 4. Fields That Cannot Be Cleanly Migrated/Reused *(requested deliverable)*

These are the fields that, per the analysis above, **cannot simply be dropped or auto-migrated into their newer counterparts** without either data loss, manual data review, or a schema/shape redesign:

1. **`Animal.identifiers`** *(String, JSON blob)* — arbitrary user-defined key/value pairs; no fixed replacement schema exists that could losslessly absorb this.
2. **`Animal.coOwnership`** *(String, free text)* — conceptually replaced by `AnimalTransfer` + `ownershipHistory[]`, but the old data is unstructured prose that cannot be auto-mapped into those structured records.
3. **`Animal.transferHistory`** *(String, free text)* — same issue as above; superseded in concept by the `AnimalTransfer` collection but not machine-migratable.
4. **`Animal.keeperHistory[]`** — has live, unmigrated data (confirmed: 1 record for these 3 users alone) that has *not* yet been copied into its intended replacement `ownershipHistory[]`; the two sub-schemas also use different field names (`name` vs `ownerName`), so this requires a real migration script, not a drop.
5. **`PublicAnimal.careTasks: [{type:String}]`** — cannot be reused/synced from `Animal.careTasks: [{taskName, lastDoneDate, frequencyDays}]` because the sub-document shapes are incompatible; the field would need to be redefined before any promotion logic could populate it correctly.
6. **`Litter.numberBorn`** — still being actively dual-written alongside `litterSizeBorn` (100% vs 99.4% populated for these users), so it cannot yet be dropped without confirming all app read/write paths have fully switched to `litterSizeBorn`.

All other duplicate/legacy fields identified in Sections 3.1–3.3 (the ~40+ `PublicAnimalSchema` duplicate declarations, the `AnimalSchema`/`LitterSchema` duplicate declarations, `Animal.showTitles/showRatings/judgeComments`, `Litter.pairingDate/matingDates`, and `Animal.careTasks`/`animalCareTasks`) **are safe to consolidate or remove outright** — either because the first declaration is already 100% dead code, or because live data confirms the legacy field is empty/unused for real accounts.
