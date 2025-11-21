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
} = require('./models'); 

// Load environment variables (Only JWT secret and constants are read here)
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const JWT_LIFETIME = '1d';

/**
 * Utility function to get the next auto-incrementing public ID.
 */
const getNextSequence = async (name) => {
    const ret = await Counter.findByIdAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    // If we inserted (upsert: true), the first ID will be 1001, which is correct (default seq is 1000).
    return ret.seq;
};

// --- DATABASE CONNECTION ---
/**
 * Connects to the MongoDB database using the URI passed from index.js.
 * @param {string} uri - The MongoDB connection URI.
 */
const connectDB = async (uri) => { // CHANGED: Now accepts 'uri'
    if (!uri) { 
        throw new Error("MONGODB_URI not found in environment variables. Cannot connect to database.");
    }
    try {
        await mongoose.connect(uri); // CHANGED: Uses 'uri' variable
        console.log('MongoDB connection successful.');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        throw error;
    }
};


// --- USER REGISTRY FUNCTIONS ---

const registerUser = async (userData) => { 
    const { email, password, personalName, breederName, profileImage, showBreederName } = userData;

    // Get new public ID for the user
    const id_public = await getNextSequence('userId');

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the new user
    const newUser = new User({
        id_public,
        email,
        password: hashedPassword,
        personalName,
        breederName,
        profileImage,
        showBreederName
    });

    const savedUser = await newUser.save();

    // Create public profile immediately
    const publicProfileData = {
        userId_backend: savedUser._id,
        id_public: savedUser.id_public,
        personalName: savedUser.personalName,
        profileImage: savedUser.profileImage,
        breederName: savedUser.breederName,
    };
    await PublicProfile.create(publicProfileData);

    return savedUser;
};

const loginUser = async (email, password) => { 
    // Find user by email, selecting the password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new Error('User not found');
    }

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
        { id: user._id, email: user.email, id_public: user.id_public }, 
        JWT_SECRET, 
        { expiresIn: JWT_LIFETIME }
    );
    
    return token;
};

/**
 * Updates a user's profile information (private and public records).
 */
const updateUserProfile = async (userId_backend, updates) => {
    // 1. Find and update the private User record
    const user = await User.findByIdAndUpdate(userId_backend, updates, { 
        new: true, 
        runValidators: true 
    });

    if (!user) {
        throw new Error("User profile not found.");
    }

    // 2. Sync necessary fields to the PublicProfile record
    const publicUpdates = {};

    if (updates.personalName !== undefined) publicUpdates.personalName = updates.personalName;
    if (updates.profileImage !== undefined) publicUpdates.profileImage = updates.profileImage;
    if (updates.breederName !== undefined) publicUpdates.breederName = updates.breederName;

    // Note: showBreederName is handled by public profile, but the private Animal records use the latest setting, 
    // which would require a complex mass update on animal records that we will skip for now. 
    // The public profile just displays the name if available.

    
    if (Object.keys(publicUpdates).length > 0) {
        await PublicProfile.findOneAndUpdate({ userId_backend: userId_backend }, publicUpdates);
    }

    return user;
};


// --- ANIMAL REGISTRY FUNCTIONS ---

/**
 * Registers a new animal.
 */
const addAnimal = async (appUserId_backend, animalData) => {
    const fileOwner = await User.findById(appUserId_backend);
    if (!fileOwner) {
        throw new Error("File owner (app user) not found.");
    }

    // 1. Get new public ID for the animal
    const id_public = await getNextSequence('animalId');

    // 2. Set owner display info (Initial owner is the app user)
    const ownerId_public = fileOwner.id_public;
    const ownerPersonalName = fileOwner.personalName;
    const ownerBreederName = fileOwner.showBreederName ? fileOwner.breederName : null;


    const newAnimal = new Animal({
        ...animalData,
        id_public,
        appUserId_backend, 
        ownerId_public, 
        ownerPersonalName,
        ownerBreederName,
        birthDate: new Date(animalData.birthDate), 
    });

    return await newAnimal.save();
};

/**
 * Gets all animals for the logged-in user (local page).
 */
const getUsersAnimals = async (appUserId_backend, filters = {}) => {
    // Queries by the access control ID (appUserId_backend)
    const query = { appUserId_backend };
    if (filters.gender) query.gender = filters.gender;
    if (filters.status) query.status = filters.status;

    return await Animal.find(query).sort({ createdAt: -1 });
};

/**
 * Retrieves a single animal by its backend ID, ensuring it belongs to the user.
 */
const getAnimalByIdAndUser = async (appUserId_backend, animalId_backend) => {
    const animal = await Animal.findOne({ _id: animalId_backend, appUserId_backend });
    if (!animal) {
        throw new Error("Animal not found or user does not own this animal.");
    }
    return animal;
};

/**
 * Updates an existing animal record and optionally syncs the public record.
 */
const updateAnimal = async (appUserId_backend, animalId_backend, updates) => {
    // 1. Find and update the animal's private record (must check ownership)
    const animal = await Animal.findOneAndUpdate(
        { _id: animalId_backend, appUserId_backend }, 
        updates, 
        { new: true, runValidators: true }
    );

    if (!animal) {
        throw new Error("Animal not found or user does not own this animal.");
    }

    // 2. If the animal is public, we must sync the PublicAnimal record
    if (animal.showOnPublicProfile) {
        // Only update fields that are exposed in the PublicAnimal schema
        const publicUpdates = {};
        if (updates.prefix !== undefined) publicUpdates.prefix = updates.prefix;
        if (updates.name !== undefined) publicUpdates.name = updates.name;
        if (updates.gender !== undefined) publicUpdates.gender = updates.gender;
        if (updates.birthDate !== undefined) publicUpdates.birthDate = updates.birthDate;
        if (updates.color !== undefined) publicUpdates.color = updates.color;
        if (updates.coat !== undefined) publicUpdates.coat = updates.coat;
        
        // Update optional fields only if they exist in the private document
        if (animal.remarks && updates.remarks !== undefined) publicUpdates.remarks = updates.remarks;
        if (animal.geneticCode && updates.geneticCode !== undefined) publicUpdates.geneticCode = updates.geneticCode;

        // Only update if there are fields to update
        if (Object.keys(publicUpdates).length > 0) {
            await PublicAnimal.findByIdAndUpdate(animalId_backend, publicUpdates);
        }
    }
    
    return animal;
};


/**
 * Toggles an animal's visibility on the public profile.
 */
const toggleAnimalPublic = async (appUserId_backend, animalId_backend, toggleData) => {
    const { makePublic, includeRemarks = false, includeGeneticCode = false } = toggleData;

    // 1. Find and update the animal's private record (must check ownership)
    const animal = await Animal.findOne({ _id: animalId_backend, appUserId_backend });
    if (!animal) {
        throw new Error("Animal not found or user does not own this animal.");
    }

    animal.showOnPublicProfile = makePublic;
    await animal.save(); 

    // 2. Sync with PublicAnimal collection
    if (makePublic) {
        // Prepare data for public view, including optional fields based on toggleData
        const publicData = {
            _id: animal._id, // Set the public document's _id to match the private one
            id_public: animal.id_public,
            ownerId_public: animal.ownerId_public,
            prefix: animal.prefix,
            name: animal.name,
            gender: animal.gender,
            birthDate: animal.birthDate,
            color: animal.color,
            coat: animal.coat,
            // Include optional fields only if toggled
            remarks: includeRemarks ? animal.remarks : undefined,
            geneticCode: includeGeneticCode ? animal.geneticCode : undefined,
        };

        // Create or update the public-facing document
        await PublicAnimal.findOneAndUpdate({ _id: animal._id }, publicData, { upsert: true, new: true });
    } else {
        // Remove from public collection
        await PublicAnimal.findByIdAndDelete(animal._id);
    }
    return animal;
};

// --- PUBLIC ACCESS FUNCTIONS ---

/**
 * Fetches a single public profile by its public ID.
 */
const getPublicProfile = async (id_public) => {
    const profile = await PublicProfile.findOne({ id_public });
    if (!profile) {
        throw new Error('Public profile not found.');
    }
    return profile;
};

/**
 * Fetches all public animals belonging to a specific user (ownerId_public).
 */
const getPublicAnimalsByOwner = async (ownerId_public) => {
    const animals = await PublicAnimal.find({ ownerId_public }).sort({ createdAt: -1 });
    return animals;
};


// --- LITTER REGISTRY FUNCTIONS ---

/**
 * Registers a new litter.
 */
const addLitter = async (appUserId_backend, litterData) => {
    const owner = await User.findById(appUserId_backend);
    if (!owner) {
        throw new Error("Owner not found.");
    }

    const newLitter = new Litter({
        ...litterData,
        ownerId: appUserId_backend,
        birthDate: new Date(litterData.birthDate), 
        pairingDate: litterData.pairingDate ? new Date(litterData.pairingDate) : null,
    });

    return await newLitter.save();
};

/**
 * Gets all litters for the logged-in user.
 */
const getUsersLitters = async (appUserId_backend) => {
    return await Litter.find({ ownerId: appUserId_backend }).sort({ birthDate: -1 });
};

/**
 * Updates an existing litter record.
 */
const updateLitter = async (appUserId_backend, litterId_backend, updates) => {
    // 1. Find and update the litter's record (must check ownership)
    const litter = await Litter.findOneAndUpdate(
        { _id: litterId_backend, ownerId: appUserId_backend }, 
        updates, 
        { new: true, runValidators: true }
    );

    if (!litter) {
        throw new Error("Litter not found or user does not own this litter.");
    }
    
    return litter;
};


// --- PEDIGREE FUNCTIONS ---

/**
 * Recursively fetches the ancestry of an animal up to a specified depth (generations).
 * @param {number} animalId_public - The public ID of the animal to trace.
 * @param {number} depth - The number of generations (e.g., 2 for P, G1, G2).
 * @returns {Promise<object>} - A pedigree node structure.
 */
const recursivelyFetchAncestry = async (animalId_public, depth) => {
    if (depth <= 0 || !animalId_public) {
        return null;
    }

    // 1. Fetch the animal's details
    const animal = await Animal.findOne({ id_public: animalId_public }).lean();
    
    if (!animal) {
        // If animal is not found, return a basic node with the known public ID
        return {
            id_public: animalId_public,
            name: `(ID: ${animalId_public})`,
            gender: 'Unknown',
            generation: 5 - depth, // Generation 1 is the sire/dam
            sire: null,
            dam: null,
        };
    }

    // 2. Find the litter where this animal is an offspring
    const litter = await Litter.findOne({ offspringIds_public: animalId_public }).lean();
    
    let sireNode = null;
    let damNode = null;

    if (litter) {
        // Recursively fetch the parents' ancestry
        const nextDepth = depth - 1;

        // Fetch Sire (Father)
        sireNode = await recursivelyFetchAncestry(litter.sireId_public, nextDepth);
        
        // Fetch Dam (Mother)
        damNode = await recursivelyFetchAncestry(litter.damId_public, nextDepth);
    }
    
    // 3. Construct the current node's data
    const pedigreeNode = {
        id_public: animal.id_public,
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
    const rootAnimal = await getAnimalByIdAndUser(appUserId_backend, animalId_backend);
    
    // 2. Start the recursive trace
    const pedigreeTree = await recursivelyFetchAncestry(rootAnimal.id_public, maxDepth);

    return pedigreeTree;
};


module.exports = {
    connectDB,
    registerUser,
    loginUser,
    updateUserProfile, // <<< NEW
    getNextSequence,
    // Animal functions
    addAnimal,
    getUsersAnimals,
    getAnimalByIdAndUser,
    updateAnimal, 
    toggleAnimalPublic,
    // Public functions
    getPublicProfile,
    getPublicAnimalsByOwner,
    // Litter functions
    addLitter,
    getUsersLitters,
    updateLitter, 
    // Pedigree function
    generatePedigree
};