const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
 * Utility function to get the next auto-incrementing public ID.
 * @param {string} name - The identifier (e.g., 'userId' or 'animalId').
 * @returns {Promise<number>} The next sequence number.
 */
const getNextSequence = async (name) => {
    const ret = await Counter.findByIdAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    // If we inserted (upsert: true), the first ID will be 1001, which is correct (default seq is 1000).
    return ret.seq;
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
        breederName: user.breederName,
        showBreederName: user.showBreederName,
        showGeneticCodePublic: user.showGeneticCodePublic || false,
        showRemarksPublic: user.showRemarksPublic || false,
        profileImage: user.profileImage,
        createdAt: user.creationDate || new Date(), // Set member since date
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
        // Update public profile personalName simultaneously
        await PublicProfile.updateOne({ userId_backend: user._id }, { personalName: updates.personalName });
    }
    if (updates.showPersonalName !== undefined) {
        user.showPersonalName = updates.showPersonalName;
    }
    if (updates.breederName !== undefined) {
        user.breederName = updates.breederName;
        // Update public profile name simultaneously
        await PublicProfile.updateOne({ userId_backend: user._id }, { breederName: updates.breederName });
    }
    if (updates.showBreederName !== undefined) {
        user.showBreederName = updates.showBreederName;
        // Update public profile showBreederName simultaneously
        await PublicProfile.updateOne({ userId_backend: user._id }, { showBreederName: updates.showBreederName });
    }
    if (updates.websiteURL !== undefined) {
        user.websiteURL = updates.websiteURL;
    }
    if (updates.showWebsiteURL !== undefined) {
        user.showWebsiteURL = updates.showWebsiteURL;
    }
    if (updates.showEmailPublic !== undefined) {
        user.showEmailPublic = updates.showEmailPublic;
    }
    if (updates.showGeneticCodePublic !== undefined) {
        user.showGeneticCodePublic = updates.showGeneticCodePublic;
        // Update public profile showGeneticCodePublic simultaneously
        await PublicProfile.updateOne({ userId_backend: user._id }, { showGeneticCodePublic: updates.showGeneticCodePublic });
    }
    if (updates.showRemarksPublic !== undefined) {
        user.showRemarksPublic = updates.showRemarksPublic;
        // Update public profile showRemarksPublic simultaneously
        await PublicProfile.updateOne({ userId_backend: user._id }, { showRemarksPublic: updates.showRemarksPublic });
    }
    if (updates.profileImage !== undefined) {
        user.profileImage = updates.profileImage;
        // Update public profile image simultaneously
        await PublicProfile.updateOne({ userId_backend: user._id }, { profileImage: updates.profileImage });
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

    // Normalize parent fields: accept numeric public IDs or alias fields and resolve to internal _id
    const resolveParentPublicToBackend = async (pubVal) => {
        if (!pubVal) return null;
        const num = Number(pubVal);
        if (Number.isNaN(num)) return null;
        const found = await Animal.findOne({ id_public: num, ownerId: appUserId_backend }).select('_id id_public').lean();
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
                    // If candidate is numeric public id but not owned by user, still set numeric if provided
                    const num = Number(candidate);
                    if (!Number.isNaN(num)) animalData.sireId_public = num;
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
                    const numM = Number(candidateM);
                    if (!Number.isNaN(numM)) animalData.damId_public = numM;
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
        ...animalData,
        // Default visibility to private
        showOnPublicProfile: false,
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
    const query = { ownerId: appUserId_backend };

    // Apply filters from query params
    if (filters.id_public !== undefined) {
        const idNum = Number(filters.id_public);
        if (!Number.isNaN(idNum)) {
            query.id_public = idNum;
        }
    }
    if (filters.gender) query.gender = filters.gender;
    if (filters.species) query.species = filters.species;
    if (filters.status) query.status = filters.status;
    if (filters.isOwned !== undefined) {
        query.isOwned = filters.isOwned === 'true' || filters.isOwned === true;
    }
    if (filters.isPregnant !== undefined) {
        query.isPregnant = filters.isPregnant === 'true' || filters.isPregnant === true;
    }
    if (filters.isNursing !== undefined) {
        query.isNursing = filters.isNursing === 'true' || filters.isNursing === true;
    }

    // Sort by birth date descending (most recent first)
    const docs = await Animal.find(query).sort({ birthDate: -1 }).lean();
    // Provide backward-compatible alias fields expected by the frontend
    return docs.map(d => ({
        ...d,
        fatherId_public: d.sireId_public || null,
        motherId_public: d.damId_public || null,
        isDisplay: d.showOnPublicProfile || false,
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
    animal.isDisplay = animal.showOnPublicProfile || false;
    return animal;
};

/**
 * Updates a specific animal's record.
 */
const updateAnimal = async (appUserId_backend, animalId_backend, updates) => {
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
                } else {
                    const resolved = await resolveParentPublicToBackend(candidate);
                    if (resolved) {
                        updates.sireId_public = resolved.id_public;
                    } else {
                        const num = Number(candidate);
                        if (!Number.isNaN(num)) updates.sireId_public = num;
                    }
                }
            }
        }

        if (updates.damId_public === undefined) {
            const candidateM = updates.motherId_public ?? updates.motherId ?? updates.mother_id ?? updates.mother_public;
            if (candidateM !== undefined) {
                if (candidateM === null) {
                    updates.damId_public = null;
                } else {
                    const resolvedM = await resolveParentPublicToBackend(candidateM);
                    if (resolvedM) {
                        updates.damId_public = resolvedM.id_public;
                    } else {
                        const numM = Number(candidateM);
                        if (!Number.isNaN(numM)) updates.damId_public = numM;
                    }
                }
            }
        }

        // Ensure imageUrl propagates to photoUrl if provided
        if (updates.imageUrl && !updates.photoUrl) updates.photoUrl = updates.imageUrl;
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
        // Combine prefix and name for display
        name: `${animal.prefix ? animal.prefix + ' ' : ''}${animal.name}`,
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
 */
const getPublicAnimalsByOwner = async (ownerId_public) => { 
    return PublicAnimal.find({ ownerId_public }).sort({ birthDate: -1 }).lean();
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

    return;
};

module.exports = {
    connectDB,
    registerUser,
    loginUser,
    getUserProfileById,
    updateUserProfile, 
    getNextSequence,
    // Animal functions
    addAnimal,
    getUsersAnimals,
    getAnimalByIdAndUser,
    updateAnimal,
    toggleAnimalPublic,
    deleteAnimal,
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