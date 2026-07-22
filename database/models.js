﻿const mongoose = require('mongoose');

// --- 1. COUNTER SCHEMA (For Generating Unique Public Integer IDs) ---
// Note: We only export the model here. The getNextSequence function moves to db_service.js.
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // 'userId' or 'animalId'
    seq: { type: Number, default: 1000 } // Start from 1000 for cleaner public IDs
});
const Counter = mongoose.model('Counter', CounterSchema);


// --- 2. USER SCHEMA (Private/Authentication Data) ---
const UserSchema = new mongoose.Schema({
    id_public: { type: String, required: false, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Password MUST be selected manually in queries or explicitly included in update handlers
    password: { type: String, required: true, select: false }, 
    personalName: { type: String, required: true, trim: true },
    showPersonalName: { type: Boolean, default: false },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    websiteURL: { type: String, default: null },
    showWebsiteURL: { type: Boolean, default: false },
    socialMediaURL: { type: String, default: null },
    showSocialMediaURL: { type: Boolean, default: false },
    bio: { type: String, default: null, trim: true },
    showBio: { type: Boolean, default: true },
    showStatsTab: { type: Boolean, default: true },
    showEmailPublic: { type: Boolean, default: false },
    creationDate: { type: Date, default: Date.now },
    // Email verification
    emailVerified: { type: Boolean, default: false },
    verificationCode: { type: String, default: null, select: false },
    verificationCodeExpires: { type: Date, default: null, select: false },
    // Password reset
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
    // Array of internal Animal and Litter IDs owned by this user for easy lookup
    ownedAnimals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }], 
    ownedLitters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Litter' }],
    // Messaging preferences
    allowMessages: { type: Boolean, default: true },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users blocked from messaging
    // Email notification preferences
    emailNotificationPreference: { 
        type: String, 
        enum: ['none', 'all', 'requestsOnly', 'messagesOnly'],
        default: 'none' 
    },
    // User location
    country: { type: String, default: null },
    state: { type: String, default: null }, // US state code when country === 'US'
    // Breeding status for species (for breeder directory)
    breedingStatus: { 
        type: Map, 
        of: String, // Values: 'breeder', 'retired', 'hobbyist', or null
        default: new Map()
    },
    // Admin/Moderator fields for 2FA
    role: { 
        type: String, 
        enum: ['user', 'moderator', 'admin'], 
        default: 'user', 
        index: true 
    },
    adminPassword: { type: String, default: null, select: false }, // Hashed admin-only password
    last_login: { type: Date, default: null },
    last_login_ip: { type: String, default: null },
    lastActive: { type: Date, default: null, index: true }, // Updated on authenticated requests (throttled)
    two_factor_enabled: { type: Boolean, default: true },
    
    // Moderation tracking fields
    warningCount: { type: Number, default: 0 },
    warnings: [{
        date: { type: Date, default: Date.now },
        reason: { type: String, default: 'No reason specified' },
        category: { type: String, default: 'general' },
        subject: { type: String, default: null }, // e.g. animal name/id or profile description
        moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        isLifted: { type: Boolean, default: false }
    }],
    accountStatus: { 
        type: String, 
        enum: ['normal', 'suspended', 'banned'], 
        default: 'normal',
        index: true
    },
    suspensionReason: { type: String, default: null },
    suspensionDate: { type: Date, default: null },
    suspensionExpiry: { type: Date, default: null }, // When the suspension expires
    suspensionLiftedDate: { type: Date, default: null }, // Track when suspension was lifted
    banReason: { type: String, default: null },
    banDate: { type: Date, default: null },
    banType: { type: String, enum: ['banned', 'ip-ban'], default: null },
    bannedIP: { type: String, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    // Donation badge fields
    monthlyDonationActive: { type: Boolean, default: false },  // Monthly supporter badge (diamond)
    lastDonationDate: { type: Date, default: null },           // Last one-time donation (gift badge, 31 days)
    
    // Duplicate detection dismissed pairs (to avoid showing same duplicates repeatedly)
    dismissedDuplicatePairs: { type: [String], default: [] },  // Array of '{id1}|{id2}' sorted pairs

    // Animal Collections (user-defined groupings)
    animalCollections: {
        // Array of collection definitions: { id: String, name: String }
        collections: { type: mongoose.Schema.Types.Mixed, default: [] },
        // Map of animal id_public -> array of collection IDs the animal belongs to
        animalMap: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    uiPreferences: {
        defaultAnimalView: { type: String, default: 'list' },
        enclosureShowUnowned: { type: Boolean, default: true },
        enclosureShowAvailable: { type: Boolean, default: true },
        enclosureShowBooked: { type: Boolean, default: true },
        enclosureShowRehomed: { type: Boolean, default: false }
    }
});
const User = mongoose.model('User', UserSchema);


// --- 3. PUBLIC PROFILE SCHEMA (View-Only/Searchable Data) ---
const PublicProfileSchema = new mongoose.Schema({
    userId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_public: { type: String, required: true, unique: true, index: true },
    personalName: { type: String, required: true, trim: true },
    showPersonalName: { type: Boolean, default: false },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    profileImage: { type: String, default: null },
    createdAt: { type: Date, default: null }, // Member since date
    email: { type: String, default: null },
    showEmailPublic: { type: Boolean, default: false },
    websiteURL: { type: String, default: null },
    showWebsiteURL: { type: Boolean, default: false },
    socialMediaURL: { type: String, default: null },
    showSocialMediaURL: { type: Boolean, default: false },
    bio: { type: String, default: null, trim: true },
    showBio: { type: Boolean, default: true },
    showStatsTab: { type: Boolean, default: true },
    allowMessages: { type: Boolean, default: true },
    emailNotificationPreference: { 
        type: String, 
        enum: ['none', 'all', 'requestsOnly', 'messagesOnly'],
        default: 'none' 
    },
    country: { type: String, default: null },
    state: { type: String, default: null }, // US state code when country === 'US'
    breedingStatus: { 
        type: Map, 
        of: String, // Values: 'breeder', 'retired', 'hobbyist', or null
        default: new Map()
    },
    completedTutorials: { type: [String], default: [] }, // Array of completed tutorial IDs
    hasCompletedOnboarding: { type: Boolean, default: false }, // Track if user completed initial onboarding
    hasCompletedAdvancedFeatures: { type: Boolean, default: false }, // Track if user completed advanced features
    hasSeenWelcomeBanner: { type: Boolean, default: false }, // Track if user has dismissed the welcome banner
    hasSeenProfileSetupGuide: { type: Boolean, default: false }, // Track if user has seen the one-time profile setup guide
    speciesOrder: { type: [String], default: [] }, // User's custom order for species display
    speciesFavorites: { type: [String], default: [] }, // User's favorite species (starred)
    breedingLineDefs: { type: Array, default: [] },        // [{ id, name, color }]
    animalBreedingLines: { type: mongoose.Schema.Types.Mixed, default: {} }, // { animalId_public: [lineIds] }
    
    // Donation badge fields
    monthlyDonationActive: { type: Boolean, default: false },  // Monthly supporter badge (diamond)
    lastDonationDate: { type: Date, default: null },           // Last one-time donation (gift badge, 31 days)

    // Breeder Info & Adoption Rules (public-facing program info)
    breederInfo: {
        aboutProgram:       { type: String, default: '' },
        adoptionRules:      { type: String, default: '' },
        careRequirements:   { type: String, default: '' }, // legacy — kept for backward compat, replaced by two fields below
        enclosureCare:      { type: String, default: '' },
        routineCare:        { type: String, default: '' },
        healthGuarantee:    { type: String, default: '' },
        waitlistInfo:       { type: String, default: '' },
        pricingNotes:       { type: String, default: '' },
        contactPreferences: { type: String, default: '' },
        // User-defined custom fields (title + value pairs); titles are mined to inform future default fields
        customFields: [{
            title: { type: String, default: '' },
            value: { type: String, default: '' },
        }],
    },
}, { timestamps: true });
const PublicProfile = mongoose.model('PublicProfile', PublicProfileSchema, 'publicprofiles');

// --- Health Record Sub-schema (for use in AnimalSchema) ---
const HealthRecordSchema = new mongoose.Schema({
    // Generic fields to accommodate different record types
    name: { type: String },
    date: { type: Date },
    medication: { type: String },
    condition: { type: String },
    allergen: { type: String },
    reaction: { type: String },
    procedure: { type: String },
    testName: { type: String },
    result: { type: String },
    reason: { type: String },
    vetName: { type: String },
    dosage: { type: String },
    frequency: { type: String },
    status: { type: String },
    severity: { type: String },
    notes: { type: String },
}, { _id: false });

const ShowEventSchema = new mongoose.Schema({
    date: { type: Date },
    showName: { type: String }, // Event name (e.g., Westminster Dog Show 2024)
    titleEarned: { type: String }, // Title or placement (e.g., Best in Show, Champion, Reserve)
    judgeName: { type: String }, // Judge name
    score: { type: String }, // Score or ranking (e.g., 95/100, 1st Place, Champion)
    judgeComments: { type: String }, // Judge feedback or critique
}, { _id: false });

// --- 4. ANIMAL SCHEMA (Private Data) ---
const AnimalSchema = new mongoose.Schema({
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creatorId_public: { type: String, required: true }, // Denormalized public creator ID
    id_public: { type: String, required: true, unique: true, index: true }, // The unique public Animal ID
    
    // Transfer/Ownership tracking
    originalCreatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Original breeder/creator
    soldStatus: { type: String, enum: [null, 'sold'], default: null }, // null = not transferred
    // viewOnlyForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Removed from PublicAnimalSchema as it's not a public-facing concept
    viewOnlyForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // --- NEW: pendingTransferId for preventing duplicate pending transfers ---
    pendingTransferId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnimalTransfer',
        sparse: true, // Allows multiple documents to have null values
        index: true, // For efficient lookups
    },
    hiddenForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who have hidden this view-only animal
    
    // Key display data
    species: { type: String, required: true },
    prefix: { type: String, default: null },
    suffix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Intersex', 'Unknown', 'Mixed'], default: 'Unknown' },
    birthDate: { type: Date, default: Date.now },
    deceasedDate: { type: Date, default: null },
    breederAssignedId: { type: String, default: null },
    sbId: { type: String, default: null, index: true }, // SimpleBreed animal ID (immutable, set during SB import)
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    earset: { type: String, default: null },
    
    // Breeder and owner info
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder (user)
    manualBreederName: { type: String, default: null }, // Manual breeder name when no user is selected
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    archived: { type: Boolean, default: false, index: true }, // Hide from main lists but keep in pedigrees
    isPlannedMating: { type: Boolean, default: false }, // Auto-computed: has an active Litter with isPlanned=true and no mating date yet (or a future one)
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    isQuarantine: { type: Boolean, default: false }, // Animal is in quarantine/isolation
    isInTreatment: { type: Boolean, default: false }, // Animal is actively undergoing treatment

    // Feeding schedule tracking (for Management view)
    lastFedDate: { type: Date, default: null },
    feedingFrequencyDays: { type: Number, default: null }, // Feed every N days

    // Maintenance schedule tracking (for Management view)
    lastMaintenanceDate: { type: Date, default: null },
    maintenanceFrequencyDays: { type: Number, default: null }, // Maintenance every N days

    // Flexible per-animal care tasks (nail trim, weight check, health check, etc.)
    careTasks: [{
        taskName: { type: String, required: true, trim: true },
        lastDoneDate: { type: Date, default: null },
        frequencyDays: { type: Number, default: null },
    }],

    // Animal-specific care tasks (weigh, nail trim, health check, handling, etc.)
    animalCareTasks: [{
        taskName: { type: String, required: true, trim: true },
        lastDoneDate: { type: Date, default: null },
        frequencyDays: { type: Number, default: null },
    }],

    // Custom milestones — one-time or recurring events tracked per animal
    milestones: [{
        label: { type: String, required: true, trim: true },
        startDate: { type: Date, required: true },
        interval: { type: Number, default: null },       // e.g. 2 (for "every 2 weeks")
        intervalUnit: { type: String, default: null },   // 'day' | 'week' | 'month' | 'year' | null
    }],

    // Tags for local organization (lines, enclosures, etc)
    tags: [{ type: String, trim: true }],
    
    // Image URLs (optional)
    imageUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },
    extraImages: { type: [String], default: [] },

    // Lineage linking (Links to the public ID of the ancestor)
    sireId_public: { type: String, default: null },
    damId_public: { type: String, default: null },
    
    // Optional Litter link (Links to the internal ID of the litter)
    litterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Litter', default: null },

    // SENSITIVE/OPTIONAL DATA (Default to private)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
    // Tab 2: Ownership Fields
    manualownerName: { type: String, default: null }, // Free-text keeper/custodian name
    groupRole: { type: String, default: null }, // Role in group/colony (e.g., alpha, beta, omega)
    keeperHistory: [{
        name: { type: String },
        userId_public: { type: String, default: null }, // Linked CritterTrack user (optional)
        country: { type: String, default: null }
    }],
    // Structured ownership chain (replaces/extends keeperHistory with dates + ownership type)
    ownershipHistory: [{
        ownerName: { type: String, default: null },
        userId_public: { type: String, default: null }, // Linked CritterTrack user (optional)
        country: { type: String, default: null },
        startDate: { type: String, default: null },
        endDate: { type: String, default: null },
        ownershipType: { type: String, default: null }
    }],
    
    // Tab 3: Physical Profile Fields
    coatPattern: { type: String, default: null },
    lifeStage: { type: String, enum: ['Newborn', 'Juvenile', 'Sub-adult', 'Adult', 'Senior', 'Mixed', 'Unknown'], default: 'Unknown' },
    // Universal animal appearance fields
    phenotype: { type: String, default: null }, // Observable traits
    morph: { type: String, default: null }, // Mutation/Morph (esp. reptiles/invertebrates)
    markings: { type: String, default: null }, // Body markings/patterns
    eyeColor: { type: String, default: null }, // Eye color
    nailColor: { type: String, default: null }, // Nail/claw color (mammals)
    size: { type: String, default: null }, // General size description (Small, Medium, Large, etc.)
    // Current measurements (snapshot - growth records track history)
    weight: { type: String, default: null }, // Current weight
    length: { type: String, default: null }, // Current length/wingspan/snout-vent length
    // Physical measurements (Dog/Cat specific)
    heightAtWithers: { type: String, default: null },
    bodyLength: { type: String, default: null },
    chestGirth: { type: String, default: null },
    adultWeight: { type: String, default: null },
    bodyConditionScore: { type: String, default: null }, // 1-9 canine / 1-5 feline
    
    // Tab 4: Identification Fields
    microchipNumber: { type: String, default: null },
    pedigreeRegistrationId: { type: String, default: null },
    identifiers: { type: String, default: null }, // JSON string for custom identifiers
    colonyId: { type: String, default: null }, // Colony or group identifier
    breed: { type: String, default: null },
    strain: { type: String, default: null }, // "Bloodline" for dogs/cats
    // Dog/Cat specific identification
    licenseNumber: { type: String, default: null },
    licenseJurisdiction: { type: String, default: null },
    tattooId: { type: String, default: null },
    ringId: { type: String, default: null },
    eartagNumber: { type: String, default: null },
    
    // Tab 5: Lineage & Origin Fields
    origin: { type: String, default: 'Captive-bred' },
    
    // Tab 6: Reproduction & Breeding Fields
    isNeutered: { type: Boolean, default: false },
    heatStatus: { type: String, default: null },
    lastHeatDate: { type: Date, default: null },
    ovulationDate: { type: Date, default: null },
    matingDates: { type: String, default: null },
    expectedDueDate: { type: Date, default: null },
    litterCount: { type: String, default: null },
    litterSizeBorn: { type: Number, default: null }, // Number of offspring born
    litterSizeWeaned: { type: Number, default: null }, // Number of offspring successfully weaned
    stillbornCount: { type: Number, default: null }, // Number of stillborn offspring
    lossesCount: { type: Number, default: null }, // Number of offspring losses post-birth
    nursingStartDate: { type: Date, default: null },
    weaningDate: { type: Date, default: null },
    
    // Breeding History (Historical Data)
    breedingRole: { type: String, enum: ['sire', 'dam', 'both', null], default: null },
    lastMatingDate: { type: Date, default: null },
    successfulMatings: { type: Number, default: null },
    lastPregnancyDate: { type: Date, default: null },
    offspringCount: { type: Number, default: null },
    
    // Stud/Fertility fields (sire role)
    availableForBreeding: { type: Boolean, default: false },
    studFeeCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },
    fertilityStatus: { type: String, default: 'Unknown' },
    fertilityNotes: { type: String, default: null },
    
    // Dam/Fertility fields (dam role)
    damFertilityStatus: { type: String, default: 'Unknown' },
    damFertilityNotes: { type: String, default: null },
    // Dog/Cat specific reproduction fields
    estrusCycleLength: { type: Number, default: null }, // days
    gestationLength: { type: Number, default: null }, // days
    artificialInseminationUsed: { type: Boolean, default: null },
    whelpingDate: { type: Date, default: null }, // Dog delivery
    queeningDate: { type: Date, default: null }, // Cat delivery
    deliveryMethod: { type: String, default: null }, // Natural, C-section
    reproductiveComplications: { type: String, default: null },
    reproductiveClearances: { type: String, default: null },
    
    // Breeding Records Array (Stacking/Historical Records by Sex)
    breedingRecords: [{
        // ID and metadata
        id: { type: String, default: () => Date.now().toString() },
        recordDate: { type: Date, default: Date.now },
        
        // Common fields for all genders
        breedingMethod: { type: String, enum: ['Natural', 'AI', 'Assisted', 'Unknown'], default: 'Unknown' },
        breedingConditionAtTime: { type: String, enum: ['Good', 'Okay', 'Poor'], default: null },
        matingDate: { type: Date, default: null }, // Unified mating date field (replaces matingDates)
        matingDates: { type: String, default: null }, // DEPRECATED: Use matingDate instead (kept for backward compatibility)
        mate: { type: String, default: null }, // Manual text entry or selected animal name
        mateAnimalId: { type: String, default: null }, // Reference to selected animal ID if chosen from modal
        outcome: { type: String, enum: ['Successful', 'Unsuccessful', 'Unknown'], default: 'Unknown' },
        notes: { type: String, default: null },
        
        // Litter/Offspring fields (applicable based on gender and outcome)
        birthEventDate: { type: Date, default: null }, // Blank if no birth occurred
        birthMethod: { type: String, enum: ['Natural', 'C-Section', 'Assisted', 'Induced', 'Unknown'], default: null },
        litterSizeBorn: { type: Number, default: null },
        litterSizeWeaned: { type: Number, default: null },
        stillbornCount: { type: Number, default: null },
        lossesCount: { type: Number, default: null },
        
        // Link to created litter (if this breeding record resulted in a litter)
        litterId: { type: String, default: null }, // Reference to Litter.litter_id_public (CTL-ID)
        litterName: { type: String, default: null }, // User-assigned litter name (cached from breedingPairCodeName)
    }],
    
    // Sale fields
    isForSale: { type: Boolean, default: false },
    salePriceCurrency: { type: String, default: 'USD' },
    salePriceAmount: { type: Number, default: null },
    isInfertile: { type: Boolean, default: false },
    
    // Tab 7: Health & Veterinary Fields
    vaccinations: [HealthRecordSchema],
    dewormingRecords: [HealthRecordSchema],
    parasiteControl: [HealthRecordSchema],
    medicalConditions: [HealthRecordSchema],
    allergies: [HealthRecordSchema],
    medications: [HealthRecordSchema],
    medicalProcedures: [HealthRecordSchema],
    labResults: [HealthRecordSchema],
    vetVisits: [HealthRecordSchema],
    primaryVet: { type: String, default: null },
    // Dog/Cat specific health fields
    spayNeuterDate: { type: Date, default: null },
    parasitePreventionSchedule: [{
        treatment: { type: String },
        startDate: { type: String },
        interval: { type: Number },
        intervalUnit: { type: String }
    }],
    heartwormStatus: { type: String, default: null },
    hipElbowScores: { type: String, default: null },
    geneticTestResults: { type: String, default: null },
    eyeClearance: { type: String, default: null },
    sheddingRecords: { type: String, default: null },
    moltingRecords: { type: String, default: null },
    waterParameterChecks: { type: String, default: null },
    cardiacClearance: { type: String, default: null },
    dentalRecords: { type: String, default: null },
    chronicConditions: { type: String, default: null },
    healthClearances: [{
        clearanceType: { type: String },
        result: { type: String },
        dateIssued: { type: String },
        certificateId: { type: String },
        notes: { type: String }
    }],
    
    // Tab 8: Nutrition & Husbandry Fields
    dietType: { type: String, default: null },
    feedingSchedule: { type: String, default: null },
    supplements: { type: String, default: null },
    // Structured diet/supplement supply entries (either linked to a Supply record {id,name,category} or free-form manual entries)
    dietSupplies: { type: [mongoose.Schema.Types.Mixed], default: [] },
    supplementSupplies: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Structured nutrition schedule: { enabled, startDate, frequency, unit, timesPerDay, notes }
    nutritionSchedule: { type: mongoose.Schema.Types.Mixed, default: null },
    housingType: { type: String, default: null },
    enclosureId: { type: String, default: null }, // References Enclosure._id
    bedding: { type: String, default: null },
    temperatureRange: { type: String, default: null },
    humidity: { type: String, default: null },
    lastBulbChange: { type: Date, default: null },
    lighting: { type: String, default: null },
    noise: { type: String, default: null },
    enrichment: { type: String, default: null },
    // Dog/Cat specific husbandry
    exerciseRequirements: { type: String, default: null },
    dailyExerciseMinutes: { type: Number, default: null },
    groomingNeeds: { type: String, default: null },
    sheddingLevel: { type: String, default: null },
    crateTrained: { type: Boolean, default: null },
    litterTrained: { type: Boolean, default: null },
    leashTrained: { type: Boolean, default: null },
    freeFlightTrained: { type: Boolean, default: null },
    
    // Tab 9: Behavior & Welfare Fields
    temperament: { type: String, default: null },
    handlingTolerance: { type: String, default: null },
    socialStructure: { type: String, default: null },
    activityCycle: { type: String, default: null },
    // Dog/Cat specific training & behavior
    trainingLevel: { type: String, default: null },
    trainingDisciplines: { type: String, default: null },
    certifications: { type: String, default: null },
    workingRole: { type: String, default: null },
    behavioralIssues: { type: String, default: null },
    biteHistory: { type: String, default: null },
    reactivityNotes: { type: String, default: null },
    // Temperament Assessment (1-5 scale sliders)
    aggressionLevel: { type: Number, default: 3 },
    aggressionTriggers: { type: String, default: null },
    fearAnxietyLevel: { type: Number, default: 3 },
    specificFears: { type: String, default: null },
    boldnessLevel: { type: Number, default: 3 },
    sociabilityLevel: { type: Number, default: 3 },
    independenceLevel: { type: Number, default: 3 },
    // Escape & flight risk
    escapeRiskLevel: { type: String, default: 'Low' },
    escapeBehavior: { type: String, default: null },
    // Stereotypic & stress behaviors
    stereotypicBehaviors: { type: String, default: null },
    stressIndicators: { type: String, default: null },
    // Specialized behavioral traits
    preyDriveLevel: { type: String, default: 'Unknown' },
    huntingBehavior: { type: String, default: null },
    foodAggressionLevel: { type: String, default: 'None' },
    eatingSpeed: { type: String, default: 'Normal' },
    foodPreferences: { type: String, default: null },
    attachmentStyle: { type: String, default: 'Unknown' },
    bondingBehavior: { type: String, default: null },
    // Sensory sensitivities
    noiseSensitivity: { type: String, default: 'Normal' },
    touchSensitivity: { type: String, default: 'Normal' },
    lightSensitivity: { type: String, default: 'Normal' },
    sensoryNotes: { type: String, default: null },
    
    // Tab 10: Show Tab (Universal for all species)
    shows: [ShowEventSchema], // Array of individual show events with full details
    showTitles: { type: String, default: null }, // Legacy field for backward compatibility
    showRatings: { type: String, default: null }, // Legacy field
    judgeComments: { type: String, default: null }, // Legacy field
    workingTitles: { type: String, default: null },
    performanceScores: { type: String, default: null },
    
    // Tab 11: End of Life & Legal Fields
    causeOfDeath: { type: String, default: null },
    necropsyResults: { type: String, default: null },
    insurance: { type: String, default: null },
    legalStatus: { type: String, default: null },
    endOfLifeCareNotes: { type: String, default: null }, // Dog/Cat specific
    // Legal & Ownership extensions (Dog/Cat specific)
    coOwnership: { type: String, default: null },
    transferHistory: { type: String, default: null },
    breedingRestrictions: { type: String, default: null },
    exportRestrictions: { type: String, default: null },
    // Purchase & Sale Records
    purchaseDate: { type: Date, default: null },
    purchaseLocation: { type: String, default: null },
    purchasePrice: { type: Number, default: null },
    purchasePriceCurrency: { type: String, default: 'USD' },
    sellerName: { type: String, default: null },
    sellerContact: { type: String, default: null },
    saleDate: { type: Date, default: null },
    salePrice: { type: Number, default: null },
    salePriceCurrency: { type: String, default: 'USD' },
    buyerName: { type: String, default: null },
    buyerContact: { type: String, default: null },
    breedingRightsPurchased: { type: String, default: null },
    showRightsPurchased: { type: String, default: null },
    exportRightsPurchased: { type: String, default: null },
    studServicesAllowed: { type: String, default: null },
    resaleRestrictions: { type: String, default: null },
    breederBuybackClause: { type: String, default: null },
    // Legal documents (PDF, DOC, DOCX)
    legalDocuments: [{
        id: { type: String },
        filename: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: String }, // userId_public
    }],
    
    // Growth tracking
    growthRecords: [{ 
        id: { type: String },
        date: { type: String },
        weight: { type: String },
        length: { type: String },
        height: { type: String },
        chestGirth: { type: String },
        bcs: { type: String },
        notes: { type: String }
    }],
    measurementUnits: {
        weight: { type: String, default: 'g' },
        length: { type: String, default: 'cm' }
    },

    // Timeline notes (annotations attached to timeline events) & pinned event IDs
    timelineNotes: [{
        id: { type: String },
        eventId: { type: String },
        noteText: { type: String },
        dateAdded: { type: String }
    }],
    pinnedEvents: [{ type: String }],
    
    // Inbreeding coefficient (cached value)
    inbreedingCoefficient: { type: Number, default: null },

    // Manual Pedigree (Beta) — free-text ancestor entries not linked to registered animals
    manualPedigree: { type: mongoose.Schema.Types.Mixed, default: null },
    
    // Public visibility toggles
    showOnPublicProfile: { type: Boolean, default: false, index: true },
    isDisplay: { type: Boolean, default: false }, // Main toggle for public profile visibility
    
    // Availability for sale/stud (for showcase)
    isForSale: { type: Boolean, default: false },
    salePriceCurrency: { type: String, default: 'USD' },
    salePriceAmount: { type: Number, default: null },
    availableForBreeding: { type: Boolean, default: false },
    studFeeCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },

}, { timestamps: true });
const Animal = mongoose.model('Animal', AnimalSchema);


// --- 5. PUBLIC ANIMAL SCHEMA (Shared/View-Only Data) ---
const PublicAnimalSchema = new mongoose.Schema({
    creatorId_public: { type: String, required: true, index: true }, // The public creator link
    id_public: { type: String, required: true, unique: true, index: true }, // The unique public Animal ID
    
    // Key display data
    species: { type: String, required: true },
    prefix: { type: String, default: null },
    suffix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Intersex', 'Unknown', 'Mixed'] },
    birthDate: { type: Date },
    deceasedDate: { type: Date, default: null },
    breederAssignedId: { type: String, default: null },
    sbId: { type: String, default: null, index: true }, // SimpleBreed animal ID (immutable)
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    coatPattern: { type: String, default: null },
    earset: { type: String, default: null },
    lifeStage: { type: String, enum: ['Newborn', 'Juvenile', 'Sub-adult', 'Adult', 'Senior', 'Mixed', 'Unknown'], default: 'Unknown' },
    carrierTraits: { type: String, default: null }, // Genetic traits the animal carries
    // Universal animal appearance fields
    phenotype: { type: String, default: null },
    morph: { type: String, default: null },
    markings: { type: String, default: null },
    eyeColor: { type: String, default: null },
    nailColor: { type: String, default: null },
    size: { type: String, default: null }, // General size description (Small, Medium, Large, etc.)
    // Current measurements
    weight: { type: String, default: null },
    length: { type: String, default: null },
    
    // Breeder info (public)
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder
    manualBreederName: { type: String, default: null }, // Manual breeder name when no user is selected
    
    // Ownership and breeding status
    manualownerName: { type: String, default: null }, // Free-text keeper/custodian name
    groupRole: { type: String, default: null }, // Role in group/colony
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    isQuarantine: { type: Boolean, default: false }, // Animal is in quarantine/isolation
    isInTreatment: { type: Boolean, default: false }, // Animal is actively undergoing treatment

    // Feeding schedule tracking (for Management view)
    lastFedDate: { type: Date, default: null },
    feedingFrequencyDays: { type: Number, default: null },

    // Maintenance schedule tracking (for Management view)
    lastMaintenanceDate: { type: Date, default: null },
    maintenanceFrequencyDays: { type: Number, default: null },
    
    // Availability for sale/stud (for showcase)
    isForSale: { type: Boolean, default: false },
    salePriceCurrency: { type: String, default: 'USD' },
    salePriceAmount: { type: Number, default: null },
    availableForBreeding: { type: Boolean, default: false },
    studFeeCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },
    
    // Tags for local organization (lines, enclosures, etc)
    tags: [{ type: String, trim: true }],

    // Public-facing image URLs
    imageUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },

    // Lineage linking (Links to the public ID of the ancestor)
    sireId_public: { type: String, default: null },
    damId_public: { type: String, default: null },
    
    // SENSITIVE/OPTIONAL DATA (Copied if toggled on)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
    // Identification fields
    microchipNumber: { type: String, default: null },
    pedigreeRegistrationId: { type: String, default: null },
    identifiers: { type: String, default: null }, // JSON string for custom identifiers
    ringId: { type: String, default: null },
    eartagNumber: { type: String, default: null },
    colonyId: { type: String, default: null }, // Colony or group identifier
    breed: { type: String, default: null },
    strain: { type: String, default: null },
    
    // Origin field
    origin: { type: String, default: null },
    
    // Reproduction fields
    isNeutered: { type: Boolean, default: false },
    heatStatus: { type: String, default: null },
    lastHeatDate: { type: Date, default: null },
    ovulationDate: { type: Date, default: null },
    matingDates: { type: Date, default: null },
    expectedDueDate: { type: Date, default: null },
    litterCount: { type: Number, default: null },
    litterSizeBorn: { type: Number, default: null }, // Number of offspring born
    litterSizeWeaned: { type: Number, default: null }, // Number of offspring successfully weaned
    stillbornCount: { type: Number, default: null }, // Number of stillborn offspring
    lossesCount: { type: Number, default: null }, // Number of offspring losses post-birth
    nursingStartDate: { type: Date, default: null },
    weaningDate: { type: Date, default: null },
    
    // Growth and measurement data
    growthRecords: { type: [mongoose.Schema.Types.Mixed], default: [] },
    measurementUnits: { 
        weight: { type: String, default: 'g' },
        length: { type: String, default: 'cm' }
    },
    
    // Nutrition/Husbandry/Environment fields
    dietType: { type: String, default: null },
    feedingSchedule: { type: String, default: null },
    supplements: { type: String, default: null },
    housingType: { type: String, default: null },
    enclosureId: { type: String, default: null }, // References Enclosure._id
    bedding: { type: String, default: null },
    enrichment: { type: String, default: null },
    temperatureRange: { type: String, default: null },
    lastBulbChange: { type: Date, default: null },
    humidity: { type: String, default: null },
    lighting: { type: String, default: null },
    noise: { type: String, default: null },
    
    // Health Records (stored as JSON strings)
    vaccinations: { type: String, default: null },
    dewormingRecords: { type: String, default: null },
    parasiteControl: { type: String, default: null },
    medicalConditions: { type: String, default: null },
    allergies: { type: String, default: null },
    medications: { type: String, default: null },
    medicalProcedures: { type: String, default: null },
    labResults: { type: String, default: null },
    vetVisits: { type: String, default: null },
    sheddingRecords: { type: String, default: null },
    moltingRecords: { type: String, default: null },
    waterParameterChecks: { type: String, default: null },
    primaryVet: { type: String, default: null },
    
    // Behavior fields
    temperament: { type: String, default: null },
    handlingTolerance: { type: String, default: null },
    socialStructure: { type: String, default: null },
    activityCycle: { type: String, default: null },
    
    // End of Life fields
    causeOfDeath: { type: String, default: null },
    necropsyResults: { type: String, default: null },
    insurance: { type: String, default: null },
    legalStatus: { type: String, default: null },
    
    // --- PROMOTED TO PUBLIC: Health Records ---
    vaccinations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    medications: { type: [mongoose.Schema.Types.Mixed], default: [] },
    medicalConditions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    allergies: { type: [mongoose.Schema.Types.Mixed], default: [] },
    labResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    vetVisits: { type: [mongoose.Schema.Types.Mixed], default: [] },
    parasiteControl: { type: [mongoose.Schema.Types.Mixed], default: [] },
    dewormingRecords: { type: [mongoose.Schema.Types.Mixed], default: [] },
    healthClearances: { type: [mongoose.Schema.Types.Mixed], default: [] },
    parasitePreventionSchedule: { type: [mongoose.Schema.Types.Mixed], default: [] },
    spayNeuterDate: { type: Date, default: null },
    isNeutered: { type: Boolean, default: false },
    heartwormStatus: { type: String, default: null },
    hipElbowScores: { type: String, default: null },
    geneticTestResults: { type: String, default: null },
    eyeClearance: { type: String, default: null },
    cardiacClearance: { type: String, default: null },
    
    // --- PROMOTED TO PUBLIC: Behavior & Safety ---
    aggressionLevel: { type: Number, default: 3 },
    aggressionTriggers: { type: String, default: null },
    fearAnxietyLevel: { type: Number, default: 3 },
    preyDriveLevel: { type: String, default: 'Unknown' },
    biteHistory: { type: String, default: null },
    foodAggressionLevel: { type: String, default: 'None' },
    reactivityNotes: { type: String, default: null },
    
    // --- PROMOTED TO PUBLIC: Training & Certifications ---
    trainingLevel: { type: String, default: null },
    trainingDisciplines: { type: String, default: null },
    certifications: { type: String, default: null },
    workingRole: { type: String, default: null },
    
    // --- PROMOTED TO PUBLIC: Reproduction & Breeding ---
    breedingRole: { type: String, enum: ['sire', 'dam', 'both', null], default: null },
    lastMatingDate: { type: Date, default: null },
    successfulMatings: { type: Number, default: null },
    lastPregnancyDate: { type: Date, default: null },
    offspringCount: { type: Number, default: null },
    fertilityStatus: { type: String, default: 'Unknown' },
    fertilityNotes: { type: String, default: null },
    damFertilityStatus: { type: String, default: 'Unknown' },
    damFertilityNotes: { type: String, default: null },
    breedingRecords: { type: [mongoose.Schema.Types.Mixed], default: [] },
    artificialInseminationUsed: { type: Boolean, default: null },
    reproductiveClearances: { type: String, default: null },
    
    // --- PROMOTED TO PUBLIC: Care & Husbandry ---
    housingType: { type: String, default: null },
    bedding: { type: String, default: null },
    temperatureRange: { type: String, default: null },
    humidity: { type: String, default: null },
    lighting: { type: String, default: null },
    exerciseRequirements: { type: String, default: null },
    dailyExerciseMinutes: { type: Number, default: null },
    groomingNeeds: { type: String, default: null },
    sheddingLevel: { type: String, default: null },
    crateTrained: { type: Boolean, default: null },
    litterTrained: { type: Boolean, default: null },
    leashTrained: { type: Boolean, default: null },
    
    // --- PROMOTED TO PUBLIC: Show & Awards ---
    shows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    workingTitles: { type: String, default: null },
    
    // --- PROMOTED TO PUBLIC: Legal & Restrictions ---
    breedingRestrictions: { type: String, default: null },
    exportRestrictions: { type: String, default: null },
    breederBuybackClause: { type: String, default: null },
    
    // --- MARKETPLACE LISTING (PUBLIC) ---
    // Availability & Pricing (part of public listing when animal is for sale/breeding)
    isForSale: { type: Boolean, default: false },
    availableForBreeding: { type: Boolean, default: false },
    salePriceAmount: { type: Number, default: null },
    salePriceCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },
    studFeeCurrency: { type: String, default: 'USD' },
    
    // --- ADDITIONAL PUBLIC: List 3 Fields (Collaboration Features) ---
    // Care Tasks and Maintenance
    careTasks: [{ type: String }],
    // Public-facing remarks (separate from private notes)
    publicRemarks: { type: String, default: null },
    // Tags for categorization
    tags: [{ type: String, trim: true }],
    // Original breeder information for pedigree clarity
    originalCreatorId_public: { type: String, default: null },
    originalBreederName: { type: String, default: null },
    
    // Public display settings
    isDisplay: { type: Boolean, default: false }, // Main public visibility toggle
    
    // Inbreeding coefficient (cached value)
    inbreedingCoefficient: { type: Number, default: null },
}, { timestamps: true });
const PublicAnimal = mongoose.model('PublicAnimal', PublicAnimalSchema, 'publicanimals');


// --- 6. LITTER SCHEMA ---
const LitterSchema = new mongoose.Schema({
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // System-assigned litter ID (e.g., CTL1001) - used for system linkage to breeding records
    litter_id_public: { type: String, unique: true, sparse: true, index: true, default: null },
    
    // User-friendly breeding pair code name (optional, e.g., "Disney's Hakuna Matata", "Breeding Project A")
    breedingPairCodeName: { type: String, default: null }, 
    
    // Sire/Dam data links to PublicAnimal records for lineage
    sireId_public: { type: String, default: null },
    sirePrefixName: { type: String, default: null }, // Denormalized for display
    damId_public: { type: String, default: null },
    damPrefixName: { type: String, default: null }, // Denormalized for display
    
    // Enhanced breeding information (aligned with breeding records)
    breedingMethod: { type: String, enum: ['Natural', 'AI', 'Assisted', 'Unknown'], default: 'Unknown' },
    breedingConditionAtTime: { type: String, enum: ['Good', 'Okay', 'Poor'], default: null },
    matingDate: { type: Date, default: null }, // Unified mating date field (replaces pairingDate and matingDates)
    pregnancyDate: { type: Date, default: null }, // Date when litter transitioned to pregnant state
    expectedDueDate: { type: Date, default: null },
    outcome: { type: String, enum: ['Successful', 'Unsuccessful', 'Unknown'], default: 'Unknown' },
    
    // Birth and offspring details
    pairingDate: { type: Date, default: null }, // DEPRECATED: Use matingDate instead (kept for backward compatibility)
    matingDates: { type: String, default: null }, // DEPRECATED: Use matingDate instead (kept for backward compatibility)
    birthDate: { type: Date, default: null },
    birthMethod: { type: String, enum: ['Natural', 'C-Section', 'Assisted', 'Induced', 'Unknown'], default: null },
    
    // Comprehensive offspring counts
    litterSizeBorn: { type: Number, default: null }, // Total number born (replaces numberBorn)
    numberBorn: { type: Number, required: false, min: 0, default: null }, // Legacy field (will sync with litterSizeBorn)
    litterSizeWeaned: { type: Number, default: null }, // Total number weaned
    stillbornCount: { type: Number, default: null }, // Number of stillborn
    lossesCount: { type: Number, default: null }, // Number of losses
    weaningDate: { type: Date, default: null },
    
    // Optional administrative breakdown of males/females/unknown  
    maleCount: { type: Number, default: null },
    femaleCount: { type: Number, default: null },
    unknownCount: { type: Number, default: null },
    
    // Stillborn breakdown by sex
    maleStillbornCount: { type: Number, default: null },
    femaleStillbornCount: { type: Number, default: null },
    unknownStillbornCount: { type: Number, default: null },
    
    // Losses breakdown by sex
    maleLossesCount: { type: Number, default: null },
    femaleLossesCount: { type: Number, default: null },
    unknownLossesCount: { type: Number, default: null },
    
    // Public IDs of offspring animals that came from this litter
    offspringIds_public: { type: [String], default: [] }, 
    
    // Inbreeding coefficient for this pairing (cached value)
    inbreedingCoefficient: { type: Number, default: null },
    
    // Remarks specific to the litter
    notes: { type: String, default: '' },

    // Enhanced breeding record fields
    matingDate: { type: Date, default: null },
    expectedDueDate: { type: Date, default: null },
    breedingMethod: { type: String, default: null },
    breedingConditionAtTime: { type: String, default: null },
    outcome: { type: String, default: null },
    birthMethod: { type: String, default: null },
    litterSizeBorn: { type: Number, default: null },
    litterSizeWeaned: { type: Number, default: null },
    stillbornCount: { type: Number, default: null },
    lossesCount: { type: Number, default: null },
    unknownCount: { type: Number, default: null },
    weaningDate: { type: Date, default: null },

    // Planned mating flag — true until a birthDate is set
    isPlanned: { type: Boolean, default: false, index: true },
    // Whether this litter is shown on the breeder's public profile
    showOnPublicProfile: { type: Boolean, default: false, index: true },
    // Tracks whether the mating-day reminder notification has already been sent
    matingReminderSent: { type: Boolean, default: false },
    // Tracks whether the user has permanently dismissed the weaning notification for this litter
    weaningDismissed: { type: Boolean, default: false },
    
    // Pregnancy loss tracking — for confirmed pregnancies that resulted in no live offspring
    // (e.g., mom cannibalized litter, all stillborn, reabsorbed, etc.)
    pregnancyLost: { type: Boolean, default: false },
    pregnancyLostReason: { type: String, enum: ['Cannibalized', 'All Stillborn', 'Reabsorbed', 'Unknown', null], default: null },
    pregnancyLostNotes: { type: String, default: null },

    // Litter photo gallery (born litters only)
    images: [{ url: { type: String }, r2Key: { type: String } }],
    
}, { timestamps: true });
const Litter = mongoose.model('Litter', LitterSchema);


// --- 6. NOTIFICATION SCHEMA ---
const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId_public: { type: String, index: true },
    type: { type: String, required: true, enum: ['breeder_request', 'parent_request', 'link_request', 'transfer_request', 'transfer_accepted', 'transfer_declined', 'transfer_cancelled', 'animal_returned', 'animal_recalled', 'moderator_warning', 'moderator_message', 'account_suspended', 'account_banned', 'content_edited', 'broadcast', 'announcement', 'marketplace_inquiry', 'litter_assignment', 'mating_reminder', 'new_rating'], index: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'read', 'declined', 'cancelled', 'returned'], default: 'pending', index: true }, // Added 'returned' for consistency
    
    // Request details
    requestedBy_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedBy_public: { type: String },
    requestedBy_name: { type: String, default: '' }, // Requester's personal or breeder name
    animalId_public: { type: String },
    animalName: { type: String },
    animalPrefix: { type: String, default: '' }, // Animal prefix
    animalImageUrl: { type: String, default: '' }, // Animal thumbnail
    
    // For parent requests: which parent (sire/dam)
    parentType: { type: String, enum: ['sire', 'dam', null], default: null },
    targetAnimalId_public: { type: String, default: null }, // The animal being used as parent
    
    // For transfer notifications
    transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnimalTransfer', default: null },
    
    // Broadcast-specific fields
    title: { type: String, default: null },
    broadcastType: { type: String, enum: ['info', 'warning', 'alert', 'announcement', 'poll', null], default: null },
    sendAt: { type: Date, default: null },
    isPending: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    
    // Poll-specific fields
    pollQuestion: { type: String, default: null },
    pollOptions: [{
        text: { type: String, required: true },
        votes: { type: Number, default: 0 },
        voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    pollEndsAt: { type: Date, default: null },
    allowMultipleChoices: { type: Boolean, default: false },
    allowUserSuggestions: { type: Boolean, default: false }, // Users can add their own poll options
    isAnonymous: { type: Boolean, default: false },
    userVote: { type: mongoose.Schema.Types.Mixed, default: null }, // For user-specific vote tracking
    
    // Metadata
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    message: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
    
}, { timestamps: true });
const Notification = mongoose.model('Notification', NotificationSchema);


// --- 7. GENETICS FEEDBACK SCHEMA ---
const GeneticsFeedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    phenotype: { type: String, required: true },
    genotype: { type: String, required: true },
    feedback: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    adminNotes: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const GeneticsFeedback = mongoose.model('GeneticsFeedback', GeneticsFeedbackSchema);


// --- 8. BUG REPORT SCHEMA ---
const BugReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['Bug', 'Feature Request', 'General Feedback'], 
        required: true 
    },
    description: { type: String, required: true },
    stepsToReproduce: { type: String, default: null },
    images: [{ type: String }], // Array of image URLs from uploads
    browserInfo: {
        userAgent: { type: String, default: null },
        platform: { type: String, default: null },
        language: { type: String, default: null },
        screenResolution: { type: String, default: null },
    },
    page: { type: String, default: null },
    status: { 
        type: String, 
        enum: ['pending', 'in-progress', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    adminNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const BugReport = mongoose.model('BugReport', BugReportSchema);


// --- 9. FEEDBACK SCHEMA (General Feedback: Species, UI, etc.) ---
const FeedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userIdPublic: { type: String, required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    species: { type: String, default: null },
    feedback: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['species-customization', 'ui-feedback', 'feature-request', 'general'], 
        default: 'general' 
    },
    status: { 
        type: String, 
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    adminNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Feedback = mongoose.model('Feedback', FeedbackSchema);


// --- 9B. BETA SURVEY SCHEMA ---
const BetaSurveySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userIdPublic: { type: String, required: true }, // CTUID
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    
    // Questions 1-14: Linear scales (1-5)
    q1_overall_satisfaction: { type: Number, min: 1, max: 5, required: true }, // Very dissatisfied to Very satisfied
    q2_visual_design: { type: Number, min: 1, max: 5, required: true }, // Visual design satisfaction
    
    // Question 3: Multiple choice - what do you use most for
    q3_primary_use: { type: [String], required: true }, // Array of selected options
    
    // Question 4: Multiple choice - features used most often
    q4_features_used: { type: [String], required: true }, // Array of selected options
    
    q5_find_animals: { type: Number, min: 1, max: 5, required: true }, // Very difficult to Very easy
    q6_litter_family_tree: { type: Number, min: 1, max: 5, required: true }, // Very difficult to Very easy
    q7_genetics_tools: { type: Number, min: 1, max: 5, required: true }, // Not useful to Very useful
    q8_animal_profile_clarity: { type: Number, min: 1, max: 5, required: true }, // Very unclear to Very clear
    q9_litter_tracking: { type: Number, min: 1, max: 5, required: true }, // Not well to Very well
    q10_ownership_management: { type: Number, min: 1, max: 5, required: true }, // Not well to Very well
    q11_profile_settings: { type: Number, min: 1, max: 5, required: true }, // Very hard to Very easy
    q12_breeder_directory: { type: Number, min: 1, max: 5, required: true }, // Not helpful to Very helpful
    q13_visibility_comfort: { type: Number, min: 1, max: 5, required: true }, // Very uncomfortable to Very comfortable
    q14_marketplace_utility: { type: Number, min: 1, max: 5, required: true }, // Not useful to Very useful
    
    // Question 15: Free text feedback
    q15_improvements: { type: String, default: null },
    
    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
const BetaSurvey = mongoose.model('BetaSurvey', BetaSurveySchema);


// --- 10. MESSAGE SCHEMA ---
const MessageSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, index: true }, // Format: "userId1_userId2" (sorted)
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, default: '' }, // Text message (can be empty if only images)
    images: [{ type: String }], // Array of image URLs
    read: { type: Boolean, default: false, index: true },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who have deleted this message
    // Moderator message fields
    isModeratorMessage: { type: Boolean, default: false, index: true }, // Flag for admin/mod initiated conversations
    senderRole: { type: String, enum: ['user', 'moderator', 'admin', null], default: null }, // Role of sender if mod/admin
    sentBy: { type: String, default: null }, // Public ID of sender for internal logging (CTU-XXX)
    displayName: { type: String, default: null }, // What users see: "Admin" or "Moderator"
}, { timestamps: true });
const Message = mongoose.model('Message', MessageSchema);


// --- 10. MESSAGE REPORT SCHEMA ---
const MessageReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }, // For single message reports
    conversationMessages: [{ // For conversation reports - stores messages from last 24 hours
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: { type: String },
        createdAt: { type: Date }
    }],
    reportType: { type: String, enum: ['message', 'conversation'], default: 'message' },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    // Assignment fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null }, // Legacy single note field
    discussionNotes: [{
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null }
    }],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const MessageReport = mongoose.model('MessageReport', MessageReportSchema);


// --- 11. PROFILE REPORT SCHEMA ---
const ProfileReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    // Assignment fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null }, // Legacy single note field
    discussionNotes: [{
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null }
    }],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const ProfileReport = mongoose.model('ProfileReport', ProfileReportSchema);


// --- 12. ANIMAL REPORT SCHEMA ---
const AnimalReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedAnimalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true, index: true },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    // Assignment fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null }, // Legacy single note field
    discussionNotes: [{
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null }
    }],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const AnimalReport = mongoose.model('AnimalReport', AnimalReportSchema);


// --- 13. AUDIT LOG SCHEMA ---
const AuditLogSchema = new mongoose.Schema({
    moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    moderatorEmail: { type: String, default: null },
    action: { type: String, required: true }, // e.g., 'suspend_user', 'delete_animal_image'
    targetType: { type: String, required: true }, // e.g., 'User', 'Animal', 'Message', 'system'
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // Can be null for system actions
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    targetAnimalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', default: null, index: true },
    targetName: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g., { reason: 'Inappropriate content' }
    reason: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null }
}, { timestamps: true });
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);


// --- 14. USER ACTIVITY LOG SCHEMA (separate from mod audit logs) ---
const UserActivityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    id_public: { type: String, index: true }, // User's public ID for quick lookup
    action: { type: String, required: true, index: true }, // e.g., 'login', 'animal_create', 'profile_update'
    targetType: { type: String, default: null }, // e.g., 'animal', 'profile', 'litter'
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    targetId_public: { type: String, default: null }, // Public ID of target (animal, etc.)
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // Action-specific details
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null }, // For edit actions
    newValue: { type: mongoose.Schema.Types.Mixed, default: null }, // For edit actions
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    success: { type: Boolean, default: true }
}, { timestamps: true });
// Index for efficient queries by user and time
UserActivityLogSchema.index({ userId: 1, createdAt: -1 });
UserActivityLogSchema.index({ action: 1, createdAt: -1 });
const UserActivityLog = mongoose.model('UserActivityLog', UserActivityLogSchema);


// --- 14.5. FIELD TEMPLATE SCHEMA ---
// Defines reusable field configurations for species forms
// This separates biological taxonomy from UI field requirements
const FieldTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true, trim: true }, // e.g., 'Full Mammal Template', 'Small Mammal Template'
    description: { type: String, default: null }, // Description of what this template is for
    isDefault: { type: Boolean, default: false, index: true }, // System default templates vs custom
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // User who created custom template
    
    // Field configuration - defines what fields appear in forms and with what labels/requirements
    // Structure: { enabled: Boolean, label: String, required: Boolean }
    fields: {
        // ===== TAB 1: Dashboard / IDENTITY =====
        // Core identity fields (always required, not configurable)
        prefix: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Prefix' },
            required: { type: Boolean, default: false }
        },
        suffix: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Suffix' },
            required: { type: Boolean, default: false }
        },
        breederAssignedId: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breeder Assigned ID' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 2: OWNERSHIP =====
        manualownerName: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Keeper Name' },
            required: { type: Boolean, default: false }
        },
        keeperHistory: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Keeper History' },
            required: { type: Boolean, default: false }
        },
        isOwned: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Owned by Me' },
            required: { type: Boolean, default: false }
        },
        manualBreederName: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breeder Name (Manual)' },
            required: { type: Boolean, default: false }
        },

        
        // ===== TAB 3: PHYSICAL PROFILE =====
        color: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Color' },
            required: { type: Boolean, default: false }
        },
        coat: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Coat Type' },
            required: { type: Boolean, default: false }
        },
        earset: { 
            enabled: { type: Boolean, default: false }, // Specific to rats/mice
            label: { type: String, default: 'Earset' },
            required: { type: Boolean, default: false }
        },
        coatPattern: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Pattern' },
            required: { type: Boolean, default: false }
        },
        eyeColor: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Eye Color' },
            required: { type: Boolean, default: false }
        },
        nailColor: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Nail/Claw Color' },
            required: { type: Boolean, default: false }
        },
        lifeStage: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Life Stage' },
            required: { type: Boolean, default: false }
        },
        heightAtWithers: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats/horses
            label: { type: String, default: 'Height at Withers' },
            required: { type: Boolean, default: false }
        },
        bodyLength: { 
            enabled: { type: Boolean, default: false },
            label: { type: String, default: 'Body Length' },
            required: { type: Boolean, default: false }
        },
        chestGirth: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Chest Girth' },
            required: { type: Boolean, default: false }
        },
        adultWeight: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Adult Weight' },
            required: { type: Boolean, default: false }
        },
        bodyConditionScore: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Body Condition Score' },
            required: { type: Boolean, default: false }
        },
        weight: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Weight' },
            required: { type: Boolean, default: false }
        },
        length: { 
            enabled: { type: Boolean, default: false }, // Reptiles, fish
            label: { type: String, default: 'Length' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 4: IDENTIFICATION =====
        microchipNumber: { 
            enabled: { type: Boolean, default: false }, // Larger mammals
            label: { type: String, default: 'Microchip Number' },
            required: { type: Boolean, default: false }
        },
        pedigreeRegistrationId: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Pedigree Registration' },
            required: { type: Boolean, default: false }
        },
        colonyId: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Colony ID' },
            required: { type: Boolean, default: false }
        },
        breed: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breed' },
            required: { type: Boolean, default: false }
        },
        strain: { 
            enabled: { type: Boolean, default: false }, // Lab animals/rodents
            label: { type: String, default: 'Strain' },
            required: { type: Boolean, default: false }
        },
        licenseNumber: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'License Number' },
            required: { type: Boolean, default: false }
        },
        licenseJurisdiction: { 
            enabled: { type: Boolean, default: false },
            label: { type: String, default: 'License Jurisdiction' },
            required: { type: Boolean, default: false }
        },
        tattooId: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Tattoo ID' },
            required: { type: Boolean, default: false }
        },
        ringId: {
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Ring ID' },
            required: { type: Boolean, default: false }
        },
        eartagNumber: {
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Eartag Number' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 5: LINEAGE & ORIGIN =====
        origin: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Origin' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 6: REPRODUCTION & BREEDING =====
        isNeutered: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Neutered/Spayed' },
            required: { type: Boolean, default: false }
        },
        spayNeuterDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Spay/Neuter Date' },
            required: { type: Boolean, default: false }
        },
        heatStatus: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Heat Status' },
            required: { type: Boolean, default: false }
        },
        lastHeatDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Last Heat Date' },
            required: { type: Boolean, default: false }
        },
        ovulationDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Ovulation Date' },
            required: { type: Boolean, default: false }
        },
        matingDates: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Mating Dates' },
            required: { type: Boolean, default: false }
        },
        expectedDueDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Expected Due Date' },
            required: { type: Boolean, default: false }
        },
        litterCount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Litter Count' },
            required: { type: Boolean, default: false }
        },
        nursingStartDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Nursing Start Date' },
            required: { type: Boolean, default: false }
        },
        weaningDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Weaning Date' },
            required: { type: Boolean, default: false }
        },
        breedingRole: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breeding Role' },
            required: { type: Boolean, default: false }
        },
        lastMatingDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Last Mating Date' },
            required: { type: Boolean, default: false }
        },
        successfulMatings: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Successful Matings' },
            required: { type: Boolean, default: false }
        },
        lastPregnancyDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Last Pregnancy Date' },
            required: { type: Boolean, default: false }
        },
        offspringCount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Offspring Count' },
            required: { type: Boolean, default: false }
        },
        isStudAnimal: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Stud Animal' },
            required: { type: Boolean, default: false }
        },
        availableForBreeding: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Available for Breeding' },
            required: { type: Boolean, default: false }
        },
        studFeeCurrency: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Stud Fee Currency' },
            required: { type: Boolean, default: false }
        },
        studFeeAmount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Stud Fee Amount' },
            required: { type: Boolean, default: false }
        },
        fertilityStatus: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Fertility Status' },
            required: { type: Boolean, default: false }
        },
        fertilityNotes: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Fertility Notes' },
            required: { type: Boolean, default: false }
        },
        isDamAnimal: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Dam Animal' },
            required: { type: Boolean, default: false }
        },
        damFertilityStatus: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Dam Fertility Status' },
            required: { type: Boolean, default: false }
        },
        damFertilityNotes: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Dam Fertility Notes' },
            required: { type: Boolean, default: false }
        },
        estrusCycleLength: { 
            enabled: { type: Boolean, default: false }, // Mammals
            label: { type: String, default: 'Estrus Cycle Length (days)' },
            required: { type: Boolean, default: false }
        },
        gestationLength: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Gestation Length (days)' },
            required: { type: Boolean, default: false }
        },
        artificialInseminationUsed: { 
            enabled: { type: Boolean, default: false }, // Larger mammals
            label: { type: String, default: 'Artificial Insemination Used' },
            required: { type: Boolean, default: false }
        },
        whelpingDate: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Whelping Date' },
            required: { type: Boolean, default: false }
        },
        queeningDate: { 
            enabled: { type: Boolean, default: false }, // Cats
            label: { type: String, default: 'Queening Date' },
            required: { type: Boolean, default: false }
        },
        deliveryMethod: { 
            enabled: { type: Boolean, default: false }, // Larger mammals
            label: { type: String, default: 'Delivery Method' },
            required: { type: Boolean, default: false }
        },
        reproductiveComplications: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Reproductive Complications' },
            required: { type: Boolean, default: false }
        },
        reproductiveClearances: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Reproductive Clearances' },
            required: { type: Boolean, default: false }
        },
        isForSale: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'For Sale' },
            required: { type: Boolean, default: false }
        },
        salePriceCurrency: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Sale Price Currency' },
            required: { type: Boolean, default: false }
        },
        salePriceAmount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Sale Price Amount' },
            required: { type: Boolean, default: false }
        },
        isInfertile: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Infertile' },
            required: { type: Boolean, default: false }
        },
        isPregnant: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Pregnant' },
            required: { type: Boolean, default: false }
        },
        isNursing: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Nursing' },
            required: { type: Boolean, default: false }
        },
        isInMating: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'In Mating' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 7: HEALTH & VETERINARY =====
        vaccinations: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Vaccinations' },
            required: { type: Boolean, default: false }
        },
        dewormingRecords: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Deworming Records' },
            required: { type: Boolean, default: false }
        },
        parasiteControl: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Parasite Control' },
            required: { type: Boolean, default: false }
        },
        medicalConditions: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Medical Conditions' },
            required: { type: Boolean, default: false }
        },
        allergies: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Allergies' },
            required: { type: Boolean, default: false }
        },
        medications: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Medications' },
            required: { type: Boolean, default: false }
        },
        medicalProcedures: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Medical Procedures' },
            required: { type: Boolean, default: false }
        },
        labResults: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Lab Results' },
            required: { type: Boolean, default: false }
        },
        vetVisits: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Vet Visits' },
            required: { type: Boolean, default: false }
        },
        primaryVet: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Primary Veterinarian' },
            required: { type: Boolean, default: false }
        },
        parasitePreventionSchedule: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Parasite Prevention Schedule' },
            required: { type: Boolean, default: false }
        },
        heartwormStatus: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Heartworm Status' },
            required: { type: Boolean, default: false }
        },
        hipElbowScores: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Hip/Elbow Scores' },
            required: { type: Boolean, default: false }
        },
        geneticTestResults: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Genetic Test Results' },
            required: { type: Boolean, default: false }
        },
        eyeClearance: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Eye Clearance' },
            required: { type: Boolean, default: false }
        },
        cardiacClearance: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Cardiac Clearance' },
            required: { type: Boolean, default: false }
        },
        dentalRecords: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Dental Records' },
            required: { type: Boolean, default: false }
        },
        chronicConditions: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Chronic Conditions' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 8: NUTRITION & HUSBANDRY =====
        dietType: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Diet Type' },
            required: { type: Boolean, default: false }
        },
        feedingSchedule: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Feeding Schedule' },
            required: { type: Boolean, default: false }
        },
        supplements: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Supplements' },
            required: { type: Boolean, default: false }
        },
        housingType: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Housing Type' },
            required: { type: Boolean, default: false }
        },
        bedding: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Bedding' },
            required: { type: Boolean, default: false }
        },
        temperatureRange: { 
            enabled: { type: Boolean, default: false }, // Reptiles/exotics
            label: { type: String, default: 'Temperature Range' },
            required: { type: Boolean, default: false }
        },
        humidity: { 
            enabled: { type: Boolean, default: false }, // Reptiles/amphibians
            label: { type: String, default: 'Humidity' },
            required: { type: Boolean, default: false }
        },
        lighting: { 
            enabled: { type: Boolean, default: false }, // Reptiles/exotics
            label: { type: String, default: 'Lighting' },
            required: { type: Boolean, default: false }
        },
        noise: { 
            enabled: { type: Boolean, default: false },
            label: { type: String, default: 'Noise Levels' },
            required: { type: Boolean, default: false }
        },
        enrichment: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Enrichment' },
            required: { type: Boolean, default: false }
        },
        exerciseRequirements: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Exercise Requirements' },
            required: { type: Boolean, default: false }
        },
        dailyExerciseMinutes: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Daily Exercise (minutes)' },
            required: { type: Boolean, default: false }
        },
        groomingNeeds: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Grooming Needs' },
            required: { type: Boolean, default: false }
        },
        sheddingLevel: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Shedding Level' },
            required: { type: Boolean, default: false }
        },
        crateTrained: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Crate Trained' },
            required: { type: Boolean, default: false }
        },
        litterTrained: { 
            enabled: { type: Boolean, default: false }, // Cats
            label: { type: String, default: 'Litter Trained' },
            required: { type: Boolean, default: false }
        },
        leashTrained: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Leash Trained' },
            required: { type: Boolean, default: false }
        },
        freeFlightTrained: { 
            enabled: { type: Boolean, default: false }, // Birds
            label: { type: String, default: 'Free Flight Trained' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 9: BEHAVIOR & WELFARE =====
        temperament: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Temperament' },
            required: { type: Boolean, default: false }
        },
        handlingTolerance: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Handling Tolerance' },
            required: { type: Boolean, default: false }
        },
        socialStructure: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Social Structure' },
            required: { type: Boolean, default: false }
        },
        activityCycle: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Activity Cycle' },
            required: { type: Boolean, default: false }
        },
        trainingLevel: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Training Level' },
            required: { type: Boolean, default: false }
        },
        trainingDisciplines: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Training Disciplines' },
            required: { type: Boolean, default: false }
        },
        certifications: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Certifications' },
            required: { type: Boolean, default: false }
        },
        workingRole: { 
            enabled: { type: Boolean, default: false }, // Working dogs
            label: { type: String, default: 'Working Role' },
            required: { type: Boolean, default: false }
        },
        behavioralIssues: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Behavioral Issues' },
            required: { type: Boolean, default: false }
        },
        biteHistory: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Bite History' },
            required: { type: Boolean, default: false }
        },
        reactivityNotes: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Reactivity Notes' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 10: SHOW =====
        showTitles: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Show Titles' },
            required: { type: Boolean, default: false }
        },
        showRatings: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Show Ratings' },
            required: { type: Boolean, default: false }
        },
        judgeComments: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Judge Comments' },
            required: { type: Boolean, default: false }
        },
        workingTitles: { 
            enabled: { type: Boolean, default: false }, // Working dogs
            label: { type: String, default: 'Working Titles' },
            required: { type: Boolean, default: false }
        },
        performanceScores: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Performance Scores' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 11: END OF LIFE & LEGAL =====
        causeOfDeath: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Cause of Death' },
            required: { type: Boolean, default: false }
        },
        necropsyResults: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Necropsy Results' },
            required: { type: Boolean, default: false }
        },
        insurance: { 
            enabled: { type: Boolean, default: false }, // Larger animals
            label: { type: String, default: 'Insurance' },
            required: { type: Boolean, default: false }
        },
        legalStatus: { 
            enabled: { type: Boolean, default: false }, // Exotic animals
            label: { type: String, default: 'Legal Status' },
            required: { type: Boolean, default: false }
        },
        endOfLifeCareNotes: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'End of Life Care Notes' },
            required: { type: Boolean, default: false }
        },
        coOwnership: { 
            enabled: { type: Boolean, default: false }, // Larger animals
            label: { type: String, default: 'Co-Ownership' },
            required: { type: Boolean, default: false }
        },
        transferHistory: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Transfer History' },
            required: { type: Boolean, default: false }
        },
        breedingRestrictions: { 
            enabled: { type: Boolean, default: false }, // Purebred animals
            label: { type: String, default: 'Breeding Restrictions' },
            required: { type: Boolean, default: false }
        },
        exportRestrictions: { 
            enabled: { type: Boolean, default: false }, // Regulated species
            label: { type: String, default: 'Export Restrictions' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 12: GENETICS & NOTES =====
        geneticCode: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Genetic Code' },
            required: { type: Boolean, default: false }
        },
        phenotype: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Phenotype' },
            required: { type: Boolean, default: false }
        },
        morph: { 
            enabled: { type: Boolean, default: false }, // Reptiles
            label: { type: String, default: 'Morph' },
            required: { type: Boolean, default: false }
        },
        markings: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Markings' },
            required: { type: Boolean, default: false }
        },
        carrierTraits: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Carrier Traits' },
            required: { type: Boolean, default: false }
        },
        remarks: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Notes/Remarks' },
            required: { type: Boolean, default: false }
        }
    },
    
    // Metadata
    version: { type: Number, default: 1 }, // For template versioning
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
const FieldTemplate = mongoose.model('FieldTemplate', FieldTemplateSchema);


// --- 15. SPECIES SCHEMA ---
const SpeciesSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true, trim: true },
    latinName: { type: String, default: null, trim: true },
    category: { type: String, required: true, index: true }, // e.g., 'Mammal', 'Reptile', 'Bird', 'Amphibian', 'Fish', 'Invertebrate', 'Other'
    fieldTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldTemplate', default: null, index: true }, // Reference to field template
    isDefault: { type: Boolean, default: false, index: true }, // Built-in species vs user-added
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // User who added custom species
    createdAt: { type: Date, default: Date.now, index: true }
});
const Species = mongoose.model('Species', SpeciesSchema);


// --- 15. SYSTEM SETTINGS SCHEMA ---
const SystemSettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be string, boolean, number, etc.
    type: { type: String, enum: ['string', 'boolean', 'number', 'object', 'array'], required: true },
    category: { type: String, default: 'general', index: true }, // e.g., 'maintenance', 'security', 'general'
    description: { type: String, default: null },
    lastModified: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema);


// --- 16. TRANSACTION SCHEMA (for budget tracking) ---
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['sale', 'purchase', 'expense', 'income', 'gift'], required: true, index: true }, // Added 'gift' for completeness
    animalId: { type: String, default: null }, // id_public of the animal
    animalName: { type: String, default: null },
    price: { type: Number, required: true, default: 0 },
    date: { type: Date, required: true, index: true },
    buyer: { type: String, default: null },
    seller: { type: String, default: null },
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    category: { type: String, default: null }, // For expenses/income: food, equipment, other, etc.
    description: { type: String, default: null }, // For expenses/income
    notes: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Transaction = mongoose.model('Transaction', TransactionSchema);


// --- 17. ANIMAL TRANSFER SCHEMA ---
// --- ANIMAL TRANSFER SCHEMA (REFINED) ---
const AnimalTransferSchema = new mongoose.Schema(
    {
        fromUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        toUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        animalId_public: {
            type: String,
            required: true,
            index: true,
        },
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null,
        },
        transferType: {
            type: String,
            enum: ['sale', 'purchase', 'gift', 'recall', 'return'], // Added enum for validation
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'cancelled'], // Added enum for validation
            default: 'pending',
            index: true,
        },
        respondedAt: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        price: { type: Number, default: 0 }, // Added for transfer price
        notes: { type: String, default: '' }, // Notes/description for the transfer
        type: { type: String, enum: ['ownership', 'view_only_grant'], default: 'ownership' }, // New field to distinguish transfer types
        isLegacyMigration: { type: Boolean, default: false }, // New field to mark legacy migrations
    },
    {
        timestamps: true, // creates createdAt + updatedAt automatically
    }
);

// --- INDEXES (important for performance + preventing duplicates) ---
AnimalTransferSchema.index({ animalId_public: 1, status: 1 });
AnimalTransferSchema.index({ toUserId: 1, status: 1 });
AnimalTransferSchema.index({ fromUserId: 1, status: 1 });

// --- MODEL ---
const AnimalTransfer = mongoose.model('AnimalTransfer', AnimalTransferSchema);

module.exports = AnimalTransfer;


// --- 18. MOD CHAT SCHEMA ---
const ModChatSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, maxlength: 2000 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
const ModChat = mongoose.model('ModChat', ModChatSchema);


// --- 21. SPECIES CONFIG SCHEMA (field replacements per species) ---
const SpeciesConfigSchema = new mongoose.Schema({
    speciesName: { type: String, required: true, unique: true, index: true }, // e.g., 'Mouse', 'Rat'
    // Field label replacements for this species
    fieldReplacements: {
        type: Map,
        of: String,
        default: new Map()
        // Example: { "Coat Color": "Fur Pattern", "Eye Color": "Eye Type" }
    },
    // Custom fields specific to this species
    customFields: [{
        name: { type: String, required: true },
        type: { type: String, enum: ['text', 'select', 'number', 'boolean'], default: 'text' },
        options: [{ type: String }], // For select type fields
        required: { type: Boolean, default: false },
        order: { type: Number, default: 0 }
    }],
    // Hidden fields for this species
    hiddenFields: [{ type: String }],
    // Notes for admins
    adminNotes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
const SpeciesConfig = mongoose.model('SpeciesConfig', SpeciesConfigSchema);


// --- 22. GENETICS DATA SCHEMA (calculator data per species) ---
const GeneticsDataSchema = new mongoose.Schema({
    speciesName: { type: String, required: true, index: true }, // e.g., 'Mouse', 'Rat'
    isPublished: { type: Boolean, default: false, index: true }, // Draft vs Published
    version: { type: Number, default: 1 },
    // Gene loci for this species
    genes: [{
        symbol: { type: String, required: true }, // e.g., 'A', 'B', 'C' - the locus symbol
        name: { type: String, required: true }, // e.g., 'Agouti', 'Brown', 'Albino' - the locus name
        description: { type: String, default: null },
        order: { type: Number, default: 0 },
        // Individual alleles for this locus
        alleles: [{
            symbol: { type: String, required: true }, // e.g., 'A', 'a', 'at', 'ay'
            name: { type: String, default: null }, // e.g., 'Agouti', 'Non-agouti', 'Tan-belly' (optional)
            phenotype: { type: String, default: null }, // What this allele contributes (optional)
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        // Gene combinations (pairs of alleles)
        combinations: [{
            notation: { type: String, required: true }, // e.g., 'A/A', 'A/a', 'a/a'
            phenotype: { type: String, default: null }, // e.g., 'Agouti', 'Black'
            carrier: { type: String, default: null }, // e.g., 'Black' - what this carries (for heterozygous)
            isLethal: { type: Boolean, default: false }, // e.g., Ay/Ay
            order: { type: Number, default: 0 }
        }]
    }],
    // Phenotype calculation rules (for complex interactions)
    phenotypeRules: [{
        name: { type: String, required: true }, // e.g., 'Black'
        conditions: { type: mongoose.Schema.Types.Mixed }, // JSON conditions
        priority: { type: Number, default: 0 }
    }],
    // Marking genes (separate category)
    markingGenes: [{
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        alleles: [{
            symbol: { type: String, required: true },
            name: { type: String, default: null },
            phenotype: { type: String, default: null },
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        combinations: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            carrier: { type: String, default: null },
            isLethal: { type: Boolean, default: false },
            order: { type: Number, default: 0 }
        }]
    }],
    // Coat/Texture genes (separate category)
    coatGenes: [{
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        alleles: [{
            symbol: { type: String, required: true },
            name: { type: String, default: null },
            phenotype: { type: String, default: null },
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        combinations: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            carrier: { type: String, default: null },
            isLethal: { type: Boolean, default: false },
            order: { type: Number, default: 0 }
        }]
    }],
    // Other genes (ear type, tail type, etc.)
    otherGenes: [{
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        alleles: [{
            symbol: { type: String, required: true },
            name: { type: String, default: null },
            phenotype: { type: String, default: null },
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        combinations: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            carrier: { type: String, default: null },
            isLethal: { type: Boolean, default: false },
            order: { type: Number, default: 0 }
        }]
    }],
    // Admin notes and metadata
    adminNotes: { type: String, default: null },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
// Compound index for species + published status
GeneticsDataSchema.index({ speciesName: 1, isPublished: 1 });
const GeneticsData = mongoose.model('GeneticsData', GeneticsDataSchema);

// ── Animal Changelog ────────────────────────────────────────────────────────
const AnimalLogSchema = new mongoose.Schema({
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true, index: true },
    animalId_public: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: ['care', 'field', 'feeding'], required: true },
    changes: [{
        field:    { type: String },
        label:    { type: String },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
    }],
}, { timestamps: true });
AnimalLogSchema.index({ animalId: 1, createdAt: -1 });
const AnimalLog = mongoose.model('AnimalLog', AnimalLogSchema);

// ── Supply Item ──────────────────────────────────────────────────────────────
const SupplyItemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['Food', 'Bedding', 'Medication', 'Other'], default: 'Other' },
    currentStock: { type: Number, default: 0 },
    unit: { type: String, default: '', trim: true },
    reorderThreshold: { type: Number, default: null },
    notes: { type: String, default: '', trim: true },
    // Feeder animal fields (Food category only)
    isFeederAnimal: { type: Boolean, default: false },
    feederType: { type: String, default: '', trim: true },  // e.g. Mice, Rats, Crickets
    feederSize: { type: String, default: '', trim: true },  // e.g. Pinky, Fuzzy, Adult
    costPerUnit: { type: Number, default: null },           // cost per individual unit/animal
    // Schedule-based reorder (for bulk/timed items independent of stock count)
    nextOrderDate: { type: Date, default: null },           // when to place the next order
    orderFrequency: { type: Number, default: null },        // repeat interval number
    orderFrequencyUnit: { type: String, enum: ['days', 'weeks', 'months'], default: 'months' },
}, { timestamps: true });
const SupplyItem = mongoose.model('SupplyItem', SupplyItemSchema);

// ── Enclosure ─────────────────────────────────────────────────────────────────
const EnclosureSchema = new mongoose.Schema({
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    enclosureType: { type: String, default: '', trim: true }, // e.g. Tank, Cage, Vivarium, Pond
    size: { type: String, default: '', trim: true },           // e.g. 40 gallon, 48x24x24
    dimensions: {
        length: { type: String, default: '' },
        width: { type: String, default: '' },
        height: { type: String, default: '' },
        unit: { type: String, default: 'cm', enum: ['cm', 'in'] }
    },
    notes: { type: String, default: '', maxlength: 500 },
    purpose: { type: String, enum: ['general', 'reproduction', 'health', ''], default: 'general' }, // which tab this enclosure belongs to
    // Flexible cleaning/maintenance tasks for the enclosure (spot clean, full clean, bulb change, etc.)
    cleaningTasks: [{
        taskName: { type: String, required: true, trim: true },
        lastDoneDate: { type: Date, default: null },
        frequencyDays: { type: Number, default: null },
    }],
}, { timestamps: true });
const Enclosure = mongoose.model('Enclosure', EnclosureSchema);

// --- BREEDER RATING SCHEMA ---
const BreederRatingSchema = new mongoose.Schema({
    raterId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    raterId_public:  { type: String, required: true, index: true },
    raterName:       { type: String, default: '' }, // display name snapshot
    targetId_public: { type: String, required: true, index: true },
    score:           { type: Number, required: true, min: 1, max: 5 },
    comment:         { type: String, default: '', maxlength: 1000, trim: true },
}, { timestamps: true });
// One rating per rater per target
BreederRatingSchema.index({ raterId_backend: 1, targetId_public: 1 }, { unique: true });
const BreederRating = mongoose.model('BreederRating', BreederRatingSchema);

// --- RATING REPORT SCHEMA ---
const RatingReportSchema = new mongoose.Schema({
    reporterId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ratingId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BreederRating', required: true, index: true },
    targetId_public: { type: String, required: true, index: true }, // breeder whose profile was rated
    reason:        { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending',
        index: true
    },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt:  { type: Date, default: null },
    adminNotes:  { type: String, default: null },
    discussionNotes: [{
        text:       { type: String, required: true },
        authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt:  { type: Date, default: Date.now },
        editedAt:   { type: Date, default: null }
    }],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const RatingReport = mongoose.model('RatingReport', RatingReportSchema);

// --- FAVORITE SCHEMA ---
const FavoriteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemType: { 
        type: String, 
        enum: ['animal', 'user'], 
        required: true, 
        index: true 
    },
    itemId: { type: String, required: true, index: true }, // id_public of animal or user
    createdAt: { type: Date, default: Date.now, index: true }
});

// Compound index to ensure a user can favorite an item only once
FavoriteSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

const Favorite = mongoose.model('Favorite', FavoriteSchema);

// --- HIGH-PRIORITY COMPOUND INDEXES (Audit Step 2.2) ---
// These optimize critical security checks and frequently-accessed queries
// Expected improvement: 40-60% faster queries for these operations

// 1. Animal permission checks (security-critical)
AnimalSchema.index({ id_public: 1, creatorId: 1 });

// 2. Public display filtering  
AnimalSchema.index({ creatorId: 1, isDisplay: 1 });

// 3. Message unread filtering (dashboard badge counts)
MessageSchema.index({ conversationId: 1, read: 1 }); // Already present

// 4. Notification filtering (dashboard display)
NotificationSchema.index({ userId: 1, status: 1 });

// 5. Litter breeding timeline filtering
LitterSchema.index({ creatorId: 1, isPlanned: 1 });

// 6. Transaction financial reporting (future use)
TransactionSchema.index({ userId: 1, date: -1 }); // Uncommented and applied

// Note: These indexes are created on application startup via Mongoose
// If running for the first time, MongoDB will build these indexes in the background

// --- EXPORTS ---
module.exports = {
    Counter,
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Notification,
    GeneticsFeedback,
    BugReport,
    Feedback,
    BetaSurvey,
    Message,
    MessageReport,
    ProfileReport,
    AnimalReport,
    AuditLog,
    UserActivityLog,
    SystemSettings,
    FieldTemplate,
    Species,
    SpeciesConfig,
    GeneticsData,
    Transaction,
    AnimalTransfer,
    ModChat,
    Enclosure,
    SupplyItem,
    AnimalLog,
    BreederRating,
    RatingReport,
    Favorite,
};