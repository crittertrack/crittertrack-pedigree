const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Counter
} = require('./models.js'); // Finds /app/database/models.js 

// Load environment variables (Only JWT secret and constants are read here)
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';
const SALT_ROUNDS = 10;
const JWT_LIFETIME = '1d';

/**
 * Utility function to get the next auto-incrementing public ID with prefix.
 * @param {string} name - The identifier (e.g., 'userId' or 'animalId').
 * @returns {Promise<string>} The next sequence ID with prefix (CTU for users, CTC for animals).
 */
const getNextSequence = async (name) => {
    const ret = await Counter.findByIdAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    // If we inserted (upsert: true), the first ID will be 1001, which is correct (default seq is 1000).
    const prefix = name === 'userId' ? 'CTU' : 'CTC';
    return prefix + ret.seq;
};

// --- DATABASE CONNECTION ---
/**
 * Connects to the MongoDB database using the URI passed from index.js.
 * @param {string} uri - The MongoDB connection URI.
 */
const connectDB = async (uri) => { 
    if (!uri) { 
        throw new Error("MONGODB_URI not found in environment variables. Cannot connect to database.");
    }
    try {
        await mongoose.connect(uri, {
            // These options are now default in Mongoose 6+ but helpful to keep in mind
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });
        console.log('MongoDB Connected successfully!');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        // Exit process with failure
        process.exit(1);
    }
};


// --- AUTHENTICATION & USER SERVICE FUNCTIONS ---

/**
 * Registers a new user.
 */
const registerUser = async (userData) => {
    // 1. Hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // 2. Get next public ID for the user
    const id_public = await getNextSequence('userId');

    // 3. Create User record (private data)
    const user = new User({
        id_public,
        email: userData.email,
        password: hashedPassword,
        personalName: userData.personalName,
        breederName: userData.breederName || userData.personalName,
        showBreederName: userData.showBreederName || false,
    });
    await user.save();

    // 4. Create PublicProfile record (public data)
    const publicProfile = new PublicProfile({
        userId_backend: user._id,
        id_public: user.id_public,
        personalName: user.personalName,
        showPersonalName: user.showPersonalName !== undefined ? user.showPersonalName : true,
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        showGeneticCodePublic: user.showGeneticCodePublic || false,
        showRemarksPublic: user.showRemarksPublic || false,
        profileImage: user.profileImage,
        createdAt: user.creationDate || new Date(), // Set member since date
        email: user.email,
        showEmailPublic: user.showEmailPublic || false,
        websiteURL: user.websiteURL || null,
        showWebsiteURL: user.showWebsiteURL || false,
    });
    await publicProfile.save();

    // 5. Generate JWT Token
    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_LIFETIME });

    // Return the token and a safe version of the user profile
    const userProfile = {
        id_public: user.id_public,
        email: user.email,
        personalName: user.personalName,
        showPersonalName: user.showPersonalName,
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        websiteURL: user.websiteURL,
        showWebsiteURL: user.showWebsiteURL,
        showEmailPublic: user.showEmailPublic,
        showGeneticCodePublic: user.showGeneticCodePublic,
        showRemarksPublic: user.showRemarksPublic,
        profileImage: user.profileImage,
        creationDate: user.creationDate,
    };
    
    return { token, userProfile };
};

/**
 * Logs in a user.
 */
const loginUser = async (email, password) => {
    // 1. Find user by email, explicitly requesting the password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new Error('Invalid credentials: User not found.');
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new Error('Invalid credentials: Password mismatch.');
    }

    // 3. Generate JWT Token
    const payload = { user: { id: user.id } }; // Use user.id (internal _id)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_LIFETIME });

    // 4. Return the token and a safe version of the user profile
    const userProfile = await getUserProfileById(user.id);

    return { token, userProfile };
};

/**
 * Fetches user profile data by internal MongoDB _id.
 */
const getUserProfileById = async (appUserId_backend) => {
    // We do NOT select the password here as it is marked as `select: false` in the schema
    const user = await User.findById(appUserId_backend);

    if (!user) {
        throw new Error('User profile not found.');
    }

    // Return a clean, non-sensitive object
    return {
        id_public: user.id_public,
        email: user.email,
        personalName: user.personalName,
        showPersonalName: user.showPersonalName,
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        websiteURL: user.websiteURL,
        showWebsiteURL: user.showWebsiteURL,
        showEmailPublic: user.showEmailPublic,
        showGeneticCodePublic: user.showGeneticCodePublic,
        showRemarksPublic: user.showRemarksPublic,
        profileImage: user.profileImage,
        creationDate: user.creationDate,
        ownedAnimals: user.ownedAnimals, // Array of internal animal IDs
        ownedLitters: user.ownedLitters, // Array of internal litter IDs
    };
};

/**
 * Updates a user's profile information.
 */
const updateUserProfile = async (appUserId_backend, updates) => {
    // Find the user by ID
    const user = await User.findById(appUserId_backend);

    if (!user) {
        throw new Error('User not found.');
    }

    // Apply allowed updates
    if (updates.personalName !== undefined) {
        user.personalName = updates.personalName;
        // Update public profile personalName simultaneously - use id_public to match correct record
        await PublicProfile.updateOne({ id_public: user.id_public }, { personalName: updates.personalName });
    }
    if (updates.showPersonalName !== undefined) {
        user.showPersonalName = updates.showPersonalName;
        // Update public profile showPersonalName simultaneously - use id_public to match correct record
        await PublicProfile.updateOne({ id_public: user.id_public }, { showPersonalName: updates.showPersonalName });
    }
    if (updates.breederName !== undefined) {
        user.breederName = updates.breederName;
        // Update public profile name simultaneously - use id_public to match correct record
        await PublicProfile.updateOne({ id_public: user.id_public }, { breederName: updates.breederName });
    }
    if (updates.showBreederName !== undefined) {
        console.log('[updateUserProfile] Setting showBreederName to:', updates.showBreederName, 'Type:', typeof updates.showBreederName);
        console.log('[updateUserProfile] User._id:', user._id, 'User id_public:', user.id_public);
        user.showBreederName = updates.showBreederName;
        // Update public profile showBreederName simultaneously - use id_public to match the correct record
        const publicUpdateResult = await PublicProfile.updateOne(
            { id_public: user.id_public }, 
            { showBreederName: updates.showBreederName }
        );
        console.log('[updateUserProfile] PublicProfile update result:', publicUpdateResult);
        
        // Verify the update
        const verifyProfile = await PublicProfile.findOne({ id_public: user.id_public }).lean();
        console.log('[updateUserProfile] Verified PublicProfile showBreederName:', verifyProfile?.showBreederName, 'id_public:', verifyProfile?.id_public);
    }
    if (updates.websiteURL !== undefined) {
        user.websiteURL = updates.websiteURL;
        // Update public profile websiteURL simultaneously
        await PublicProfile.updateOne({ id_public: user.id_public }, { websiteURL: updates.websiteURL });
    }
    if (updates.showWebsiteURL !== undefined) {
        user.showWebsiteURL = updates.showWebsiteURL;
        // Update public profile showWebsiteURL simultaneously
        await PublicProfile.updateOne({ id_public: user.id_public }, { showWebsiteURL: updates.showWebsiteURL });
    }
    if (updates.showEmailPublic !== undefined) {
        user.showEmailPublic = updates.showEmailPublic;
        // Update public profile showEmailPublic and email simultaneously
        await PublicProfile.updateOne({ id_public: user.id_public }, { 
            showEmailPublic: updates.showEmailPublic,
            email: user.email // Also sync the email field
        });
    }
    if (updates.showGeneticCodePublic !== undefined) {
        user.showGeneticCodePublic = updates.showGeneticCodePublic;
        // Update public profile showGeneticCodePublic simultaneously - use id_public to match correct record
        await PublicProfile.updateOne({ id_public: user.id_public }, { showGeneticCodePublic: updates.showGeneticCodePublic });
    }
    if (updates.showRemarksPublic !== undefined) {
        user.showRemarksPublic = updates.showRemarksPublic;
        // Update public profile showRemarksPublic simultaneously - use id_public to match correct record
        await PublicProfile.updateOne({ id_public: user.id_public }, { showRemarksPublic: updates.showRemarksPublic });
    }
    if (updates.profileImage !== undefined) {
        user.profileImage = updates.profileImage;
        // Update public profile image simultaneously - use id_public to match correct record
        await PublicProfile.updateOne({ id_public: user.id_public }, { profileImage: updates.profileImage });
    }

    // Note: Password update would require a separate, secure endpoint that handles current password verification.
    
    await user.save();

    // Return the updated, clean profile
    return getUserProfileById(user.id);
};


// --- ANIMAL SERVICE FUNCTIONS ---

/**
 * Adds a new animal to the user's private collection.
 */
const addAnimal = async (appUserId_backend, animalData) => {
    const id_public = await getNextSequence('animalId');

    // Normalize parent fields: accept public IDs (string or numeric) and resolve to check ownership
    const resolveParentPublicToBackend = async (pubVal) => {
        if (!pubVal) return null;
        // Try to find by id_public (handles both string CTC1001 and legacy numeric)
        const found = await Animal.findOne({ id_public: pubVal, ownerId: appUserId_backend }).select('_id id_public').lean();
        return found ? { backendId: found._id.toString(), id_public: found.id_public } : null;
    };

    try {
        // Map parent aliases to schema fields: the schema uses sireId_public/damId_public
        // Accept frontend aliases like fatherId_public / fatherId / father_id and map them
        if (!animalData.sireId_public) {
            const candidate = animalData.fatherId_public || animalData.fatherId || animalData.father_id || animalData.father_public || animalData.sireId_public;
            if (candidate) {
                const resolved = await resolveParentPublicToBackend(candidate);
                if (resolved) {
                    animalData.sireId_public = resolved.id_public;
                } else {
                    // If not owned by user, still set the value as-is (for linkage to other users' animals)
                    animalData.sireId_public = candidate;
                }
            }
        }

        if (!animalData.damId_public) {
            const candidateM = animalData.motherId_public || animalData.motherId || animalData.mother_id || animalData.mother_public || animalData.damId_public;
            if (candidateM) {
                const resolvedM = await resolveParentPublicToBackend(candidateM);
                if (resolvedM) {
                    animalData.damId_public = resolvedM.id_public;
                } else {
                    // If not owned by user, still set the value as-is (for linkage to other users' animals)
                    animalData.damId_public = candidateM;
                }
            }
        }

        // Ensure image fields propagate
        if (animalData.imageUrl && !animalData.photoUrl) {
            animalData.photoUrl = animalData.imageUrl;
        }

    } catch (err) {
        console.warn('Parent normalization failed in addAnimal:', err && err.message ? err.message : err);
    }

    const newAnimal = new Animal({
        ownerId: appUserId_backend,
        id_public,
        // Default visibility to private if not specified
        showOnPublicProfile: false,
        ...animalData,
    });
    console.log('[addAnimal] Creating animal with:', JSON.stringify({ breederyId: newAnimal.breederyId, geneticCode: newAnimal.geneticCode, remarks: newAnimal.remarks }));
    await newAnimal.save();

    // Update the User's ownedAnimals array
    await User.findByIdAndUpdate(appUserId_backend, { $push: { ownedAnimals: newAnimal._id } });

    // Return a plain object with backward-compatible alias fields
    const saved = newAnimal.toObject();
    saved.fatherId_public = saved.sireId_public || null;
    saved.motherId_public = saved.damId_public || null;
    return saved;
};

/**
 * Gets a list of animals owned by the logged-in user.
 */
const getUsersAnimals = async (appUserId_backend, filters = {}) => {
    // Check if user wants only owned animals (not view-only)
    const onlyOwned = filters.isOwned === 'true' || filters.isOwned === true;
    
    // Start with base query
    let baseQuery;
    if (onlyOwned) {
        // Only animals actually owned by the user (exclude view-only)
        baseQuery = {
            ownerId: appUserId_backend
        };
    } else {
        // All animals: owned OR view-only (but not hidden ones)
        baseQuery = {
            $or: [
                { ownerId: appUserId_backend },
                { 
                    viewOnlyForUsers: appUserId_backend,
                    hiddenForUsers: { $ne: appUserId_backend } // Exclude hidden view-only animals
                }
            ]
        };
    }

    const query = { ...baseQuery };

    // Apply filters from query params
    if (filters.id_public !== undefined) {
        // Handle both string (CTC1001) and legacy numeric IDs
        query.id_public = filters.id_public;
    }
    if (filters.name) {
        // Search in both name and prefix fields (case-insensitive)
        // Combine with base $or using $and
        const nameQuery = {
            $or: [
                { name: { $regex: filters.name, $options: 'i' } },
                { prefix: { $regex: filters.name, $options: 'i' } }
            ]
        };
        query.$and = [baseQuery, nameQuery];
        delete query.$or; // Remove the top-level $or since we're using $and
    }
    if (filters.gender) query.gender = filters.gender;
    if (filters.species) query.species = filters.species;
    if (filters.status) query.status = filters.status;
    // Remove the isOwned filter since it's already handled in baseQuery
    if (filters.isPregnant !== undefined) {
        query.isPregnant = filters.isPregnant === 'true' || filters.isPregnant === true;
    }
    if (filters.isNursing !== undefined) {
        query.isNursing = filters.isNursing === 'true' || filters.isNursing === true;
    }
    if (filters.birthdateBefore) {
        // Only show animals born before/on the specified date (for parent selection)
        const dt = new Date(filters.birthdateBefore);
        if (!isNaN(dt.getTime())) {
            query.birthDate = { $lte: dt.toISOString().split('T')[0] };
        }
    }

    // Sort by birth date descending (most recent first)
    const docs = await Animal.find(query).sort({ birthDate: -1 }).lean();
    // Provide backward-compatible alias fields expected by the frontend
    // Also add isViewOnly flag to identify view-only animals
    return docs.map(d => ({
        ...d,
        fatherId_public: d.sireId_public || null,
        motherId_public: d.damId_public || null,
        isDisplay: d.showOnPublicProfile ?? false,
        isViewOnly: d.ownerId.toString() !== appUserId_backend.toString(),
    }));
};

/**
 * Helper to find an animal by internal ID and verify ownership.
 */
const getAnimalByIdAndUser = async (appUserId_backend, animalId_backend) => {
    const animal = await Animal.findOne({ _id: animalId_backend, ownerId: appUserId_backend }).lean();
    if (!animal) {
        throw new Error('Animal not found or does not belong to user.');
    }
    // Backwards-compatible alias fields for older frontend keys
    animal.fatherId_public = animal.sireId_public || null;
    animal.motherId_public = animal.damId_public || null;
    animal.isDisplay = animal.showOnPublicProfile ?? false;
    return animal;
};

/**
 * Updates a specific animal's record.
 */
const updateAnimal = async (appUserId_backend, animalId_backend, updates) => {
    // Fetch the original animal to check for changes
    const originalAnimal = await Animal.findOne({ _id: animalId_backend, ownerId: appUserId_backend }).lean();
    
    if (!originalAnimal) {
        throw new Error('Animal not found or user does not own this animal.');
    }
    
    // Track if birthdate or parents are being changed
    let shouldRemoveLitterLink = false;
    
    // Check if birthdate is being changed
    if (updates.birthDate !== undefined) {
        const originalDate = originalAnimal.birthDate ? new Date(originalAnimal.birthDate).getTime() : null;
        const newDate = updates.birthDate ? new Date(updates.birthDate).getTime() : null;
        if (originalDate !== newDate) {
            shouldRemoveLitterLink = true;
        }
    }
    
    // Normalize parent fields on update: accept numeric public IDs and resolve to internal _id
    const resolveParentPublicToBackend = async (pubVal) => {
        if (!pubVal) return null;
        const num = Number(pubVal);
        if (Number.isNaN(num)) return null;
        const found = await Animal.findOne({ id_public: num, ownerId: appUserId_backend }).select('_id id_public').lean();
        return found ? { backendId: found._id.toString(), id_public: found.id_public } : null;
    };

    try {
        // Map isDisplay to showOnPublicProfile (frontend sends isDisplay, backend uses showOnPublicProfile)
        if (updates.isDisplay !== undefined) {
            updates.showOnPublicProfile = updates.isDisplay;
        }

        // Map parent alias fields to schema's sireId_public/damId_public
        // Use === undefined to allow null values through (for clearing parents)
        if (updates.sireId_public === undefined) {
            const candidate = updates.fatherId_public ?? updates.fatherId ?? updates.father_id ?? updates.father_public;
            if (candidate !== undefined) {
                if (candidate === null) {
                    updates.sireId_public = null;
                    if (originalAnimal.sireId_public !== null) {
                        shouldRemoveLitterLink = true;
                    }
                } else {
                    const resolved = await resolveParentPublicToBackend(candidate);
                    if (resolved) {
                        updates.sireId_public = resolved.id_public;
                        if (originalAnimal.sireId_public !== resolved.id_public) {
                            shouldRemoveLitterLink = true;
                        }
                    } else {
                        const num = Number(candidate);
                        if (!Number.isNaN(num)) {
                            updates.sireId_public = num;
                            if (originalAnimal.sireId_public !== num) {
                                shouldRemoveLitterLink = true;
                            }
                        }
                    }
                }
            }
        }

        if (updates.damId_public === undefined) {
            const candidateM = updates.motherId_public ?? updates.motherId ?? updates.mother_id ?? updates.mother_public;
            if (candidateM !== undefined) {
                if (candidateM === null) {
                    updates.damId_public = null;
                    if (originalAnimal.damId_public !== null) {
                        shouldRemoveLitterLink = true;
                    }
                } else {
                    const resolvedM = await resolveParentPublicToBackend(candidateM);
                    if (resolvedM) {
                        updates.damId_public = resolvedM.id_public;
                        if (originalAnimal.damId_public !== resolvedM.id_public) {
                            shouldRemoveLitterLink = true;
                        }
                    } else {
                        const numM = Number(candidateM);
                        if (!Number.isNaN(numM)) {
                            updates.damId_public = numM;
                            if (originalAnimal.damId_public !== numM) {
                                shouldRemoveLitterLink = true;
                            }
                        }
                    }
                }
            }
        }

        // If birthdate or parents changed, remove litter link
        if (shouldRemoveLitterLink && originalAnimal.litterId) {
            updates.litterId = null;
            console.log(`[updateAnimal] Removing litter link for animal ${originalAnimal.id_public} due to birthdate/parent change`);
        }

        // Ensure imageUrl propagates to photoUrl if provided
        if (updates.imageUrl && !updates.photoUrl) updates.photoUrl = updates.imageUrl;
        
        // If parents are being updated, invalidate the COI so it recalculates
        if (updates.sireId_public !== undefined || updates.damId_public !== undefined) {
            updates.inbreedingCoefficient = null;
        }
    } catch (err) {
        console.warn('Parent normalization failed in updateAnimal:', err && err.message ? err.message : err);
    }

    // Use findOneAndUpdate to ensure ownership and get the updated document
    console.log('[updateAnimal] Updating with:', JSON.stringify({ breederyId: updates.breederyId, geneticCode: updates.geneticCode, remarks: updates.remarks }));
    const updatedAnimal = await Animal.findOneAndUpdate(
        { _id: animalId_backend, ownerId: appUserId_backend },
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!updatedAnimal) {
        throw new Error('Animal not found or user does not own this animal.');
    }

    // If the animal is public, update or create the corresponding PublicAnimal record
    if (updatedAnimal.showOnPublicProfile) {
        // Fetch owner's privacy settings
        const owner = await User.findById(appUserId_backend);
        const showGeneticCodePublic = owner?.showGeneticCodePublic ?? false;
        const showRemarksPublic = owner?.showRemarksPublic ?? false;

        // Prepare public updates
        const publicUpdates = {
            ownerId_public: updatedAnimal.ownerId_public,
            id_public: updatedAnimal.id_public,
            species: updatedAnimal.species,
            prefix: updatedAnimal.prefix,
            suffix: updatedAnimal.suffix,
            name: updatedAnimal.name,
            gender: updatedAnimal.gender,
            birthDate: updatedAnimal.birthDate,
            color: updatedAnimal.color,
            coat: updatedAnimal.coat,
            status: updatedAnimal.status || null,
            breederId_public: updatedAnimal.breederId_public || null,
            // Ensure public record includes image URLs if present
            imageUrl: updatedAnimal.imageUrl || null,
            photoUrl: updatedAnimal.photoUrl || null,
            // Ensure sire/dam public ids are stored for pedigree lookup
            sireId_public: updatedAnimal.sireId_public || null,
            damId_public: updatedAnimal.damId_public || null,
            // Include status fields for offspring display
            isOwned: updatedAnimal.isOwned || false,
            isPregnant: updatedAnimal.isPregnant || false,
            isNursing: updatedAnimal.isNursing || false,
            // Include remarks/genetic code based on owner's privacy settings
            remarks: showRemarksPublic ? (updatedAnimal.remarks || '') : '',
            geneticCode: showGeneticCodePublic ? (updatedAnimal.geneticCode || null) : null,
        };

        // Use upsert to create if doesn't exist, update if it does
        await PublicAnimal.updateOne(
            { id_public: updatedAnimal.id_public },
            { $set: publicUpdates },
            { upsert: true }
        );
    } else {
        // If showOnPublicProfile is false, remove from PublicAnimal
        await PublicAnimal.deleteOne({ id_public: updatedAnimal.id_public });
    }

    // Add backward-compatible alias fields before returning
    updatedAnimal.fatherId_public = updatedAnimal.sireId_public || null;
    updatedAnimal.motherId_public = updatedAnimal.damId_public || null;
    return updatedAnimal;
};


/**
 * Toggles an animal's public visibility and updates the PublicAnimal collection.
 * @param {string} appUserId_backend - The user's internal ID.
 * @param {string} animalId_backend - The animal's internal ID.
 * @param {object} toggleData - { makePublic: boolean, includeRemarks: boolean, includeGeneticCode: boolean }
 */
const toggleAnimalPublic = async (appUserId_backend, animalId_backend, toggleData) => {
    const animal = await getAnimalByIdAndUser(appUserId_backend, animalId_backend);
    
    // 1. Update the private animal's public status and settings
    animal.showOnPublicProfile = toggleData.makePublic;
    animal.includeRemarks = toggleData.includeRemarks;
    animal.includeGeneticCode = toggleData.includeGeneticCode;
    await animal.save();

    // 2. Manage the PublicAnimal collection record
    if (toggleData.makePublic) {
        // Create or update the public record
        const publicAnimalData = {
            ownerId_public: animal.ownerId_public,
            id_public: animal.id_public,
            species: animal.species,
            prefix: animal.prefix,
            suffix: animal.suffix,
            name: animal.name,
            gender: animal.gender,
            birthDate: animal.birthDate,
            color: animal.color,
            coat: animal.coat,
            // Copy image URLs into the public record as well
            imageUrl: animal.imageUrl || null,
            photoUrl: animal.photoUrl || null,
            // Include sire/dam public ids for pedigree tracing
            sireId_public: animal.sireId_public || null,
            damId_public: animal.damId_public || null,
            // Include status fields for offspring display
            isOwned: animal.isOwned || false,
            isPregnant: animal.isPregnant || false,
            isNursing: animal.isNursing || false,
            status: animal.status || null,
            breederId_public: animal.breederId_public || null,
            // Include sensitive data based on settings
            remarks: toggleData.includeRemarks ? animal.remarks : '',
            geneticCode: toggleData.includeGeneticCode ? animal.geneticCode : null,
            // Store toggle settings on the public record for update purposes
            includeRemarks: toggleData.includeRemarks,
            includeGeneticCode: toggleData.includeGeneticCode,
        };

        // Use upsert to create or replace the record
        await PublicAnimal.findOneAndUpdate(
            { id_public: animal.id_public },
            { $set: publicAnimalData },
            { upsert: true, new: true, runValidators: true }
        );
    } else {
        // If making private, delete the public record
        await PublicAnimal.deleteOne({ id_public: animal.id_public });
    }

    return animal; // Return the updated private record
};


// --- LITTER SERVICE FUNCTIONS ---

/**
 * Registers a new litter and links it to the owner.
 */
const addLitter = async (appUserId_backend, litterData) => {
    // Validate that both parents exist and are the same species
    if (litterData.sireId_public && litterData.damId_public) {
        const sire = await Animal.findOne({ id_public: litterData.sireId_public });
        const dam = await Animal.findOne({ id_public: litterData.damId_public });
        
        if (sire && dam && sire.species !== dam.species) {
            throw new Error('Parents must be the same species');
        }
    }
    
    const newLitter = new Litter({
        ownerId: appUserId_backend,
        ...litterData,
    });
    await newLitter.save();

    // Link the litter to the user's profile
    await User.findByIdAndUpdate(appUserId_backend, { $push: { ownedLitters: newLitter._id } });

    return newLitter;
};

/**
 * Gets a list of litters owned by the logged-in user.
 */
const getUsersLitters = async (appUserId_backend) => {
    // Sort by birth date descending (most recent first)
    return Litter.find({ ownerId: appUserId_backend }).sort({ birthDate: -1 }).lean();
};

/**
 * Updates a specific litter's record.
 */
const updateLitter = async (appUserId_backend, litterId_backend, updates) => {
    const updatedLitter = await Litter.findOneAndUpdate(
        { _id: litterId_backend, ownerId: appUserId_backend },
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!updatedLitter) {
        throw new Error('Litter not found or user does not own this litter.');
    }

    return updatedLitter;
};


// --- PEDIGREE SERVICE FUNCTIONS ---

/**
 * Recursive function to fetch an animal's ancestry up to a specified depth.
 * This function is designed to work ONLY with the PublicAnimal records.
 * The PublicAnimal records contain enough denormalized data (id_public for sire/dam) to trace the lineage
 * without needing to access the private Animal records, which simplifies the logic
 * and is the correct approach for a view-only pedigree.
 */
const recursivelyFetchAncestry = async (animalId_public, depth) => {
    // Base case: Stop recursion when depth reaches 0
    if (depth === 0 || !animalId_public) {
        return null;
    }

    // 1. Fetch the PublicAnimal record
    // Note: We use PublicAnimal here because we need to be able to trace ancestors
    // even if the root animal is private, as long as its ancestors were made public
    // at some point by their respective owners.
    const animal = await PublicAnimal.findOne({ id_public: animalId_public }).lean();

    if (!animal) {
        // Ancestor not found (either never registered or never made public)
        return { 
            id_public: animalId_public,
            isPlaceholder: true,
            generation: 5 - depth // Set generation relative to max depth of 5
        }; 
    }

    // 2. Recursive calls for sire and dam
    const sireNode = await recursivelyFetchAncestry(animal.sireId_public, depth - 1);
    const damNode = await recursivelyFetchAncestry(animal.damId_public, depth - 1);

    // 3. Construct the current node object
    const pedigreeNode = {
        id_public: animal.id_public,
        ownerId_public: animal.ownerId_public,
        species: animal.species,
        prefix: animal.prefix,
        suffix: animal.suffix,
        // Combine prefix and name for display
        name: `${animal.prefix ? animal.prefix + ' ' : ''}${animal.name}${animal.suffix ? ' ' + animal.suffix : ''}`,
        gender: animal.gender,
        birthDate: animal.birthDate,
        color: animal.color,
        // Calculate generation based on depth (5 is max depth we support here)
        generation: 5 - depth, 
        sire: sireNode,
        dam: damNode,
    };
    
    return pedigreeNode;
};


/**
 * Generates a full pedigree chart for a given animal up to 4 generations (5 levels).
 */
const generatePedigree = async (appUserId_backend, animalId_backend, generations = 4) => {
    const maxDepth = Math.min(generations, 4) + 1; // 4 generations is 5 levels (P + 4 ancestors)
    
    // 1. Get the starting animal to find its public ID
    // We must ensure the user owns the root animal first using the private collection
    const rootAnimal = await getAnimalByIdAndUser(appUserId_backend, animalId_backend);
    
    // 2. Start the recursive trace using the root animal's public ID
    // Note: The root animal's full data comes from the private record since the user owns it.
    const pedigreeTree = await recursivelyFetchAncestry(rootAnimal.id_public, maxDepth);

    return pedigreeTree;
};


// --- PUBLIC FUNCTIONS ---

/**
 * Retrieves a public profile for display.
 */
const getPublicProfile = async (id_public) => { 
    const profile = await PublicProfile.findOne({ id_public }).lean();
    if (!profile) {
        throw new Error(`Public profile with ID ${id_public} not found.`);
    }
    return profile;
};

/**
 * Retrieves all publicly shared animals owned by a user.
 * Only returns animals actually owned by the user (not borrowed/bred to).
 */
const getPublicAnimalsByOwner = async (ownerId_public) => { 
    return PublicAnimal.find({ ownerId_public, isOwned: true }).sort({ birthDate: -1 }).lean();
};


/**
 * Deletes an animal owned by the user and cleans up related records.
 */
const deleteAnimal = async (appUserId_backend, animalId_backend) => {
    // Verify ownership and existence
    const animal = await Animal.findOne({ _id: animalId_backend, ownerId: appUserId_backend });
    if (!animal) {
        throw new Error('Animal not found or does not own this animal.');
    }

    // Check if this is a transferred animal (has originalOwnerId and it's not the current owner)
    if (animal.originalOwnerId && animal.originalOwnerId.toString() !== appUserId_backend.toString()) {
        console.log(`[deleteAnimal] Reverting transferred animal ${animal.id_public} back to original owner`);
        
        // Revert ownership back to original owner
        const originalOwner = await User.findById(animal.originalOwnerId).select('id_public');
        
        if (originalOwner) {
            // Update animal ownership
            animal.ownerId = animal.originalOwnerId;
            animal.ownerId_public = originalOwner.id_public;
            animal.soldStatus = null; // Clear sold status
            
            // Remove current owner from viewOnlyForUsers if present
            animal.viewOnlyForUsers = animal.viewOnlyForUsers.filter(
                userId => userId.toString() !== appUserId_backend.toString()
            );
            
            // Add current owner to viewOnlyForUsers (they can still view after "deleting")
            if (!animal.viewOnlyForUsers.includes(appUserId_backend)) {
                animal.viewOnlyForUsers.push(appUserId_backend);
            }
            
            await animal.save();
            
            // Update user ownedAnimals arrays
            await User.findByIdAndUpdate(appUserId_backend, {
                $pull: { ownedAnimals: animal._id }
            });
            
            await User.findByIdAndUpdate(animal.originalOwnerId, {
                $addToSet: { ownedAnimals: animal._id }
            });
            
            // Create notification for original owner
            const { Notification, PublicProfile } = require('./models');
            const originalOwnerProfile = await PublicProfile.findOne({ userId_backend: animal.originalOwnerId });
            await Notification.create({
                userId: animal.originalOwnerId,
                userId_public: originalOwnerProfile?.id_public || '',
                type: 'animal_returned',
                animalId_public: animal.id_public,
                animalName: animal.name,
                animalImageUrl: animal.imageUrl || '',
                message: `Animal ${animal.name} (${animal.id_public}) has been returned to you.`,
                metadata: {
                    animalId: animal.id_public,
                    animalName: animal.name,
                    fromUserId: appUserId_backend
                }
            });
            
            console.log(`[deleteAnimal] Animal ${animal.id_public} reverted to original owner ${originalOwner.id_public}`);
            return { reverted: true, message: 'Animal returned to original owner.' };
        }
    }

    // Normal deletion for non-transferred animals
    // Remove the private animal record
    await Animal.deleteOne({ _id: animalId_backend });

    // Remove from the owner's ownedAnimals array
    await User.findByIdAndUpdate(appUserId_backend, { $pull: { ownedAnimals: animal._id } });

    // If a public record exists for this animal, remove it
    try {
        await PublicAnimal.deleteOne({ id_public: animal.id_public });
    } catch (e) {
        // Non-fatal: log and continue
        console.warn('Failed to delete public animal record for id_public', animal.id_public, e && e.message ? e.message : e);
    }

    return { reverted: false, message: 'Animal deleted successfully.' };
};

/**
 * Hides a view-only animal from a user's list (soft delete for view-only animals)
 */
const hideViewOnlyAnimal = async (appUserId_backend, animalId_public) => {
    // Find the animal
    const animal = await Animal.findOne({ id_public: animalId_public });
    if (!animal) {
        throw new Error('Animal not found.');
    }

    // Check if user has view-only access
    const hasViewOnlyAccess = animal.viewOnlyForUsers.some(
        userId => userId.toString() === appUserId_backend.toString()
    );

    // Check if user is the owner (owners can't hide their own animals, only delete)
    const isOwner = animal.ownerId.toString() === appUserId_backend.toString();

    if (isOwner) {
        throw new Error('You cannot hide animals you own. Use delete instead.');
    }

    if (!hasViewOnlyAccess) {
        throw new Error('You do not have view-only access to this animal.');
    }

    // Add user to hiddenForUsers array
    if (!animal.hiddenForUsers.includes(appUserId_backend)) {
        animal.hiddenForUsers.push(appUserId_backend);
        await animal.save();
    }

    return { message: 'View-only animal hidden successfully.' };
};

/**
 * Restores a hidden view-only animal to a user's list
 */
const restoreViewOnlyAnimal = async (appUserId_backend, animalId_public) => {
    // Find the animal
    const animal = await Animal.findOne({ id_public: animalId_public });
    if (!animal) {
        throw new Error('Animal not found.');
    }

    // Check if user has view-only access
    const hasViewOnlyAccess = animal.viewOnlyForUsers.some(
        userId => userId.toString() === appUserId_backend.toString()
    );

    if (!hasViewOnlyAccess) {
        throw new Error('You do not have view-only access to this animal.');
    }

    // Remove user from hiddenForUsers array
    animal.hiddenForUsers = animal.hiddenForUsers.filter(
        userId => userId.toString() !== appUserId_backend.toString()
    );
    await animal.save();

    return { message: 'View-only animal restored successfully.' };
};

/**
 * Gets all hidden view-only animals for a user
 */
const getHiddenViewOnlyAnimals = async (appUserId_backend) => {
    const animals = await Animal.find({
        viewOnlyForUsers: appUserId_backend,
        hiddenForUsers: appUserId_backend
    }).sort({ birthDate: -1 }).lean();

    return animals.map(d => ({
        ...d,
        fatherId_public: d.sireId_public || null,
        motherId_public: d.damId_public || null,
        isDisplay: d.showOnPublicProfile ?? false,
        isViewOnly: true,
        isHidden: true,
    }));
};

/**
 * Request email verification - generates a 6-digit code and stores it with expiry
 * Does NOT create the account yet
 */
const requestEmailVerification = async (email, personalName, breederName, showBreederName, password) => {
    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified) {
        throw new Error('Email already registered and verified');
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Hash the password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existingUser) {
        // Update existing unverified user
        existingUser.password = hashedPassword;
        existingUser.personalName = personalName;
        existingUser.breederName = breederName || personalName;
        existingUser.showBreederName = showBreederName || false;
        existingUser.verificationCode = verificationCode;
        existingUser.verificationCodeExpires = verificationCodeExpires;
        await existingUser.save();
    } else {
        // Create new unverified user (no id_public yet)
        const user = new User({
            email,
            password: hashedPassword,
            personalName,
            breederName: breederName || personalName,
            showBreederName: showBreederName || false,
            emailVerified: false,
            verificationCode,
            verificationCodeExpires
        });
        await user.save();
    }

    return { email, verificationCode };
};

/**
 * Verify email code and complete registration
 */
const verifyEmailAndRegister = async (email, code) => {
    // Find user with verification code
    const user = await User.findOne({ 
        email,
        verificationCode: code 
    }).select('+verificationCode +verificationCodeExpires');

    if (!user) {
        throw new Error('Invalid verification code');
    }

    // Check if code has expired
    if (user.verificationCodeExpires < new Date()) {
        throw new Error('Verification code has expired');
    }

    // Check if already verified
    if (user.emailVerified) {
        throw new Error('Email already verified');
    }

    // Get next public ID
    const id_public = await getNextSequence('userId');

    // Update user with verification and public ID
    user.emailVerified = true;
    user.id_public = id_public;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Create PublicProfile
    const publicProfile = new PublicProfile({
        userId_backend: user._id,
        id_public: user.id_public,
        personalName: user.personalName,
        showPersonalName: user.showPersonalName !== undefined ? user.showPersonalName : true,
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        showGeneticCodePublic: user.showGeneticCodePublic || false,
        showRemarksPublic: user.showRemarksPublic || false,
        profileImage: user.profileImage,
        createdAt: user.creationDate || new Date(),
    });
    await publicProfile.save();

    // Generate JWT Token
    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_LIFETIME });

    // Return token and user profile
    const userProfile = {
        id_public: user.id_public,
        email: user.email,
        personalName: user.personalName,
        showPersonalName: user.showPersonalName,
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        websiteURL: user.websiteURL,
        showWebsiteURL: user.showWebsiteURL,
        showEmailPublic: user.showEmailPublic,
        showGeneticCodePublic: user.showGeneticCodePublic,
        showRemarksPublic: user.showRemarksPublic,
        profileImage: user.profileImage,
        creationDate: user.creationDate,
    };

    return { token, userProfile };
};

/**
 * Request password reset - generates token and stores it with expiry
 */
const requestPasswordReset = async (email) => {
    const user = await User.findOne({ email });
    
    if (!user) {
        // Don't reveal if email exists or not for security
        throw new Error('If the email exists, a reset link has been sent');
    }

    if (!user.emailVerified) {
        throw new Error('Email not verified. Please verify your email first');
    }

    // Generate secure reset token (32 bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token before storing (same pattern as passwords)
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedToken = await bcrypt.hash(resetToken, salt);

    // Set expiry to 1 hour from now
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    return { resetToken, email };
};

/**
 * Reset password with valid token
 */
const resetPassword = async (email, token, newPassword) => {
    const user = await User.findOne({ 
        email,
        resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user || !user.resetPasswordToken) {
        throw new Error('Invalid or expired reset token');
    }

    // Verify the token
    const isValidToken = await bcrypt.compare(token, user.resetPasswordToken);
    
    if (!isValidToken) {
        throw new Error('Invalid reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return { message: 'Password reset successful' };
};

module.exports = {
    connectDB,
    registerUser,
    loginUser,
    getUserProfileById,
    updateUserProfile, 
    getNextSequence,
    requestEmailVerification,
    verifyEmailAndRegister,
    requestPasswordReset,
    resetPassword,
    // Animal functions
    addAnimal,
    getUsersAnimals,
    getAnimalByIdAndUser,
    updateAnimal,
    toggleAnimalPublic,
    deleteAnimal,
    hideViewOnlyAnimal,
    restoreViewOnlyAnimal,
    getHiddenViewOnlyAnimals,
    // Litter functions
    addLitter,
    getUsersLitters,
    updateLitter,
    // Pedigree functions
    generatePedigree,
    // Public functions
    getPublicProfile,
    getPublicAnimalsByOwner,
};