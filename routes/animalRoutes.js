const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Notification, User, PublicProfile, PublicAnimal } = require('../database/models');
const fs = require('fs');
const { calculateInbreedingCoefficient, calculatePairingInbreeding } = require('../utils/inbreeding');
const { ProfanityError } = require('../utils/profanityFilter');
const { logUserActivity, USER_ACTIONS } = require('../utils/userActivityLogger');
// simple disk storage for images (adjust for S3 in production)
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
// If running with Cloudflare R2 (or other remote storage), use memory storage
const useR2 = (process.env.STORAGE_PROVIDER || '').toUpperCase() === 'R2';
let storage;
if (useR2) {
    storage = multer.memoryStorage();
} else {
    storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname) || '';
            const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
            cb(null, name);
        }
    });
}
// Enforce a strict server-side per-file upload limit to protect payload size.
// Also restrict accepted file types to PNG/JPEG only.
const imageFileFilter = (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    const err = new Error('INVALID_FILE_TYPE');
    err.status = 415;
    return cb(err, false);
};

const upload = multer({ storage, limits: { fileSize: 500 * 1024 }, fileFilter: imageFileFilter });

const { 
    addAnimal, 
    getUsersAnimals, 
    updateAnimal, 
    toggleAnimalPublic,
    getAnimalByIdAndUser, // Assuming this helper exists
    deleteAnimal, // Assuming this helper exists
    hideViewOnlyAnimal,
    restoreViewOnlyAnimal,
    getHiddenViewOnlyAnimals
} = require('../database/db_service');

// Resolve internal Animal _id when routes receive either a backend ObjectId
// or a numeric public id (id_public). This avoids Mongoose CastError when
// the client passes a public id like "4" instead of the 24-char ObjectId.
const { Animal } = require('../database/models');

router.param('id_backend', async (req, res, next, value) => {
    try {
        // If the param already looks like a MongoDB ObjectId, accept it
        if (/^[0-9a-fA-F]{24}$/.test(value)) {
            req.resolvedAnimalId = value;
            return next();
        }

        // If it's numeric or starts with CTC (public ID format), resolve to internal _id
        if (/^\d+$/.test(value) || /^CTC\d+$/i.test(value)) {
            // Need the user id to scope the lookup; if not available yet, defer
            const appUserId_backend = req.user && req.user.id;
            if (!appUserId_backend) {
                return res.status(400).json({ message: 'User context required to resolve animal id.' });
            }
            const animal = await Animal.findOne({ id_public: value, ownerId: appUserId_backend }).select('_id').lean();
            if (!animal) return res.status(404).json({ message: 'Animal not found.' });
            req.resolvedAnimalId = animal._id.toString();
            return next();
        }

        return res.status(400).json({ message: 'Invalid animal id format.' });
    } catch (err) {
        next(err);
    }
});
// This router requires authMiddleware to be applied in index.js


// Helper: Create notification for breeder/parent requests
async function createLinkageNotification(targetUserId_public, requestedBy_id, requestedBy_public, animalId_public, animalName, type, parentType = null, targetAnimalId_public = null) {
    try {
        console.log(`[Notification] Creating ${type} notification for user CT${targetUserId_public}`);
        
        // Find the target user's backend ID
        const targetUser = await User.findOne({ id_public: targetUserId_public });
        if (!targetUser) {
            console.log(`[Notification] Target user CT${targetUserId_public} not found`);
            return;
        }
        
        // Fetch requester's name from PublicProfile
        const requester = await PublicProfile.findOne({ id_public: requestedBy_public });
        let requesterName = `User CT${requestedBy_public}`;
        if (requester) {
            const hasPersonalName = requester.showPersonalName && requester.personalName;
            const hasBreederName = requester.breederName;
            if (hasPersonalName && hasBreederName) {
                requesterName = `${requester.personalName} (${requester.breederName})`;
            } else if (hasPersonalName) {
                requesterName = requester.personalName;
            } else if (hasBreederName) {
                requesterName = requester.breederName;
            }
        }
        
        // Fetch animal details (prefix and image)
        const animal = await PublicAnimal.findOne({ id_public: animalId_public });
        const animalPrefix = animal?.prefix || '';
        const animalImageUrl = animal?.imageUrl || '';
        const fullAnimalName = animalPrefix ? `${animalPrefix} ${animalName}` : animalName;
        
        // Check if notification already exists for this exact request (within last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existing = await Notification.findOne({
            userId: targetUser._id,
            animalId_public,
            type,
            parentType: parentType || null,
            targetAnimalId_public: targetAnimalId_public || null,
            createdAt: { $gte: oneDayAgo }
        });
        
        if (existing) {
            console.log(`[Notification] Duplicate notification exists (created: ${existing.createdAt}), skipping`);
            return; // Don't create duplicate notifications
        }
        
        // Create notification with improved message
        let message = '';
        if (type === 'breeder_request') {
            // Only add CT prefix if id_public doesn't already start with CT
            const animalIdDisplay = animalId_public.startsWith('CT') ? animalId_public : `CT${animalId_public}`;
            message = `${requesterName} has set you as the breeder for ${fullAnimalName} (${animalIdDisplay})`;
        } else if (type === 'parent_request') {
            const parentLabel = parentType === 'sire' ? 'sire (father)' : 'dam (mother)';
            
            // Fetch target animal details for display name
            const targetAnimal = await PublicAnimal.findOne({ id_public: targetAnimalId_public });
            const targetAnimalPrefix = targetAnimal?.prefix || '';
            const targetAnimalName = targetAnimal?.name || '';
            const fullTargetAnimalName = targetAnimalPrefix ? `${targetAnimalPrefix} ${targetAnimalName}` : targetAnimalName;
            // Only add CT prefix if id_public doesn't already start with CT
            const targetIdDisplay = targetAnimalId_public.startsWith('CT') ? targetAnimalId_public : `CT${targetAnimalId_public}`;
            const targetAnimalDisplay = fullTargetAnimalName ? `${fullTargetAnimalName} (${targetIdDisplay})` : targetIdDisplay;
            
            const animalIdDisplay = animalId_public.startsWith('CT') ? animalId_public : `CT${animalId_public}`;
            message = `${requesterName} has used your animal ${targetAnimalDisplay} as ${parentLabel} for ${fullAnimalName} (${animalIdDisplay})`;
        }
        
        const notification = await Notification.create({
            userId: targetUser._id,
            userId_public: targetUserId_public,
            type,
            status: 'pending',
            requestedBy_id,
            requestedBy_public,
            requestedBy_name: requesterName,
            animalId_public,
            animalName,
            animalPrefix,
            animalImageUrl,
            parentType,
            targetAnimalId_public,
            message,
            read: false
        });
        console.log(`[Notification] Successfully created notification ID ${notification._id}`);
    } catch (error) {
        console.error('Error creating linkage notification:', error);
    }
}


// --- Animal Route Controllers (PROTECTED) ---

// POST /api/animals
// 1. Registers a new animal under the logged-in user.
// Accepts optional multipart file field `file` and will set `imageUrl` automatically.
router.post('/', upload.single('file'), async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
            const animalData = req.body || {};
            console.log('[POST /api/animals] Received data:', JSON.stringify({ breederyId: animalData.breederyId, geneticCode: animalData.geneticCode, remarks: animalData.remarks }));

            // Accept image URL from JSON body using several common keys (frontend compatibility)
            const incomingImage = animalData.imageUrl || animalData.photoUrl || animalData.profileImage || animalData.profileImageUrl || animalData.image_path || animalData.photo || animalData.image_url;
            if (incomingImage) {
                // Normalize to https to avoid mixed-content issues
                let url = incomingImage;
                if (typeof url === 'string' && url.startsWith('http://')) {
                    url = url.replace(/^http:\/\//i, 'https://');
                }
                animalData.imageUrl = url;
                if (!animalData.photoUrl) animalData.photoUrl = url;
            }

            // If a file was uploaded via multipart, attach a public URL (multipart takes precedence)
            if (req.file) {
                if (useR2) {
                    // Upload buffer to R2 via storage client
                    try {
                        const r2 = require('../storage/r2_client');
                        const ext = path.extname(req.file.originalname) || '';
                        const key = `animals/${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
                        const url = await r2.uploadBuffer(key, req.file.buffer, req.file.mimetype);
                        animalData.imageUrl = url;
                        animalData.photoUrl = animalData.photoUrl || url;
                        // Attach filename for potential cleanup compatibility
                        animalData._uploadedFilename = key;
                    } catch (r2err) {
                        console.error('R2 upload failed:', r2err);
                        // Fall back to not setting image URL (frontend will handle)
                    }
                } else {
                    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
                    let base = process.env.PUBLIC_HOST || process.env.PUBLIC_URL || process.env.DOMAIN || null;
                    if (base) {
                        if (!/^https?:\/\//i.test(base)) base = `${proto}://${base}`;
                        base = base.replace(/\/$/, '');
                    } else {
                        base = `${proto}://${req.get('host')}`;
                    }
                    const fileUrl = `${base}/api/uploads/${req.file.filename}`;
                    animalData.imageUrl = fileUrl;
                    animalData.photoUrl = animalData.photoUrl || fileUrl;
                }
            }

            // Normalize parent fields: if frontend provided public IDs (fatherId_public, fatherId, etc.)
            // resolve them to check ownership and validate
            // Helper: resolve a public id to both backend _id and id_public
            const resolveParentPublicToBackend = async (pubVal) => {
                if (!pubVal) return null;
                // Handle both string (CTC1001) and legacy numeric IDs
                const found = await Animal.findOne({ id_public: pubVal, ownerId: appUserId_backend }).select('_id id_public').lean();
                return found ? { backendId: found._id.toString(), id_public: found.id_public } : null;
            };

            // Map parent alias fields into the schema's sireId_public/damId_public
            // Check if explicitly provided (even if null) to allow clearing
            if (animalData.sireId_public === undefined) {
                const candidate = animalData.fatherId_public ?? animalData.fatherId ?? animalData.father_id ?? animalData.father_public;
                if (candidate !== undefined) {
                    if (candidate === null) {
                        animalData.sireId_public = null;
                    } else {
                        try {
                            const resolved = await resolveParentPublicToBackend(candidate);
                            if (resolved) {
                                animalData.sireId_public = resolved.id_public;
                            } else {
                                // Not owned by user, but still valid - set as-is
                                animalData.sireId_public = candidate;
                            }
                        } catch (e) { /* ignore resolution errors */ }
                    }
                }
            }

            if (animalData.damId_public === undefined) {
                const candidateM = animalData.motherId_public ?? animalData.motherId ?? animalData.mother_id ?? animalData.mother_public;
                if (candidateM !== undefined) {
                    if (candidateM === null) {
                        animalData.damId_public = null;
                    } else {
                        try {
                            const resolvedM = await resolveParentPublicToBackend(candidateM);
                            if (resolvedM) {
                                animalData.damId_public = resolvedM.id_public;
                            } else {
                                // Not owned by user, but still valid - set as-is
                                animalData.damId_public = candidateM;
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            }

            // Basic validation for required fields
        if (!animalData.name || !animalData.species) {
             return res.status(400).json({ message: 'Missing required animal fields: name and species.' });
        }
        
        // Map frontend field names to backend schema
        if (animalData.isDisplay !== undefined) {
            animalData.showOnPublicProfile = animalData.isDisplay;
        }

        // IMPORTANT: Animal is saved with breeder/parent links immediately.
        // Notifications are created AFTER the save, but the links remain active.
        // Links are only removed if the breeder/parent owner explicitly rejects via notification.
        const newAnimal = await addAnimal(appUserId_backend, animalData);

        // Create notifications for breeder and parent linkages (if targeting other users' data)
        const currentUserPublicId = req.user.id_public;
        
        // Check if this animal was transferred (has originalOwnerId)
        const isTransferred = !!newAnimal.originalOwnerId;
        let originalOwnerPublicId = null;
        if (isTransferred) {
            const originalOwner = await User.findById(newAnimal.originalOwnerId).select('id_public');
            originalOwnerPublicId = originalOwner?.id_public;
            console.log(`[Notification Check] Animal was transferred, original owner: CT${originalOwnerPublicId}`);
        }
        
        // Check if breeder was set and it's not the current user
        if (newAnimal.breederId_public && newAnimal.breederId_public !== currentUserPublicId) {
            console.log(`Checking breeder notification: breederId_public=${newAnimal.breederId_public}, currentUserPublicId=${currentUserPublicId}`);
            // Check if this user owns an animal with that ID (local ownership check)
            const localCheck = await Animal.findOne({ id_public: newAnimal.breederId_public, ownerId: appUserId_backend });
            console.log(`Local check for breeder animal: ${localCheck ? 'found' : 'not found'}`);
            if (!localCheck) {
                // Skip notification if animal was transferred and breeder is the original owner
                const isOriginalOwnerAsBreeder = isTransferred && newAnimal.breederId_public === originalOwnerPublicId;
                if (isOriginalOwnerAsBreeder) {
                    console.log(`[Notification Skip] Breeder is original owner of transferred animal - skipping notification`);
                } else {
                    // It's someone else's user ID - create notification
                    console.log(`Creating breeder notification for user CT${newAnimal.breederId_public}`);
                    await createLinkageNotification(
                        newAnimal.breederId_public,
                        req.user.id,
                        currentUserPublicId,
                        newAnimal.id_public,
                        newAnimal.name,
                        'breeder_request'
                    );
                }
            }
        }
        
        // Check if sire was set and it's not owned by current user
        if (newAnimal.sireId_public) {
            const localSire = await Animal.findOne({ id_public: newAnimal.sireId_public, ownerId: appUserId_backend });
            if (!localSire) {
                // It's someone else's animal - create notification
                const sireOwner = await Animal.findOne({ id_public: newAnimal.sireId_public }).populate('ownerId', 'id_public');
                if (sireOwner && sireOwner.ownerId && sireOwner.ownerId.id_public) {
                    // Skip notification if animal was transferred and sire owner is the original owner
                    const isOriginalOwnerAsSireOwner = isTransferred && sireOwner.ownerId.id_public === originalOwnerPublicId;
                    if (isOriginalOwnerAsSireOwner) {
                        console.log(`[Notification Skip] Sire owner is original owner of transferred animal - skipping notification`);
                    } else {
                        await createLinkageNotification(
                            sireOwner.ownerId.id_public,
                            req.user.id,
                            currentUserPublicId,
                            newAnimal.id_public,
                            newAnimal.name,
                            'parent_request',
                            'sire',
                            newAnimal.sireId_public
                        );
                    }
                }
            }
        }
        
        // Check if dam was set and it's not owned by current user
        if (newAnimal.damId_public) {
            const localDam = await Animal.findOne({ id_public: newAnimal.damId_public, ownerId: appUserId_backend });
            if (!localDam) {
                // It's someone else's animal - create notification
                const damOwner = await Animal.findOne({ id_public: newAnimal.damId_public }).populate('ownerId', 'id_public');
                if (damOwner && damOwner.ownerId && damOwner.ownerId.id_public) {
                    // Skip notification if animal was transferred and dam owner is the original owner
                    const isOriginalOwnerAsDamOwner = isTransferred && damOwner.ownerId.id_public === originalOwnerPublicId;
                    if (isOriginalOwnerAsDamOwner) {
                        console.log(`[Notification Skip] Dam owner is original owner of transferred animal - skipping notification`);
                    } else {
                        await createLinkageNotification(
                            damOwner.ownerId.id_public,
                            req.user.id,
                            currentUserPublicId,
                            newAnimal.id_public,
                            newAnimal.name,
                            'parent_request',
                            'dam',
                            newAnimal.damId_public
                        );
                    }
                }
            }
        }

        // Sync to publicanimals collection
        const { syncAnimalToPublic } = require('../utils/syncPublicAnimals');
        await syncAnimalToPublic(newAnimal);

        // Log user activity
        logUserActivity({
            userId: appUserId_backend,
            id_public: req.user.id_public,
            action: USER_ACTIONS.ANIMAL_CREATE,
            targetType: 'animal',
            targetId: newAnimal._id,
            targetId_public: newAnimal.id_public,
            details: { name: newAnimal.name, species: newAnimal.species },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            message: 'Animal registered successfully!',
            id_public: newAnimal.id_public,
            animalId_backend: newAnimal._id
        });
    } catch (error) {
        console.error('Error registering animal:', error && error.stack ? error.stack : error);
        if (error && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Uploaded file exceeds 500KB limit.' });
        }
        if (error && error.message === 'INVALID_FILE_TYPE') {
            return res.status(415).json({ message: 'Unsupported file type. Only PNG and JPEG images are allowed.' });
        }
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during animal registration.', error: error && error.message ? error.message : String(error) });
    }
});

// GET /api/animals
// 2. Gets all animals for the logged-in user (private list).
router.get('/', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        // Optionally pass query filters (e.g., ?gender=Male)
        const filters = req.query; 

        const animals = await getUsersAnimals(appUserId_backend, filters);

        res.status(200).json(animals);
    } catch (error) {
        console.error('Error fetching user animals:', error);
        res.status(500).json({ message: 'Internal server error while fetching animals.' });
    }
});


// GET /api/animals/any/:id_public
// Fetch ANY animal by id_public (authenticated users can view any animal's basic info)
// This is for displaying parents/offspring that user doesn't own
// If viewFromNotification=true, allows access to animals mentioned in breeder/parent notifications
// Returns: owned animals OR public animals OR animals related to user's animals (as parent/offspring) OR animals from notifications
router.get('/any/:id_public', async (req, res) => {
    try {
        const id_public = req.params.id_public; // Keep as string (supports CTC format)
        const userId = req.user.id;
        const viewFromNotification = req.query.viewFromNotification === 'true';

        // First check if user owns this animal
        let animal = await Animal.findOne({ id_public, ownerId: userId }).lean();
        
        if (animal) {
            // User owns it, return full data
            return res.status(200).json(animal);
        }
        
        // Not owned by user, check if it's public
        animal = await PublicAnimal.findOne({ id_public }).lean();
        
        if (animal) {
            return res.status(200).json(animal);
        }

        // Not public either, check if animal is related to user's animals
        // (i.e., user owns one of the parents or offspring)
        animal = await Animal.findOne({ id_public }).lean();
        
        if (animal) {
            // If viewing from notification, always allow access to the animal details
            if (viewFromNotification) {
                console.log(`[viewFromNotification] Allowing user to view animal ${id_public} from notification`);
                return res.status(200).json(animal);
            }

            // Check if any of the user's animals are parents of this animal
            const userAnimals = await Animal.find({ ownerId: userId }).select('id_public').lean();
            const userAnimalIds = userAnimals.map(a => a.id_public);
            
            // Check if this animal has user's animal as parent
            const hasUserParent = [
                animal.fatherId_public,
                animal.motherId_public,
                animal.sireId_public,
                animal.damId_public
            ].some(parentId => parentId && userAnimalIds.includes(parentId));
            
            // Check if this animal is offspring of user's animal
            const isOffspringOfUser = await Animal.findOne({
                ownerId: userId,
                $or: [
                    { sireId_public: id_public },
                    { damId_public: id_public },
                    { fatherId_public: id_public },
                    { motherId_public: id_public }
                ]
            }).lean();
            
            // Check if this animal is the OTHER PARENT of an offspring that has user's animal as parent
            // (e.g., user owns the father, this is the mother of the same offspring)
            const isOtherParentOfSharedOffspring = await Animal.findOne({
                $or: [
                    // This animal is sire/father, user's animal is dam/mother
                    { 
                        $or: [
                            { sireId_public: id_public },
                            { fatherId_public: id_public }
                        ],
                        $or: [
                            { damId_public: { $in: userAnimalIds } },
                            { motherId_public: { $in: userAnimalIds } }
                        ]
                    },
                    // This animal is dam/mother, user's animal is sire/father
                    { 
                        $or: [
                            { damId_public: id_public },
                            { motherId_public: id_public }
                        ],
                        $or: [
                            { sireId_public: { $in: userAnimalIds } },
                            { fatherId_public: { $in: userAnimalIds } }
                        ]
                    }
                ]
            }).lean();
            
            if (hasUserParent || isOffspringOfUser || isOtherParentOfSharedOffspring) {
                // User has relationship to this animal, allow access
                return res.status(200).json(animal);
            }
        }
        
        // Animal not found or not accessible
        return res.status(404).json({ message: 'Animal not found or not accessible.' });
    } catch (error) {
        console.error('Error fetching animal:', error);
        res.status(500).json({ message: 'Internal server error while fetching animal details.' });
    }
});

// GET /api/animals/:id_backend
// 3. Gets a single animal's private details.
// If viewFromNotification=true and animal exists, return it regardless of ownership (for notification recipients to view animals mentioned in breeder/parent notifications)
router.get('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.resolvedAnimalId || req.params.id_backend;
        const viewFromNotification = req.query.viewFromNotification === 'true';

        // If viewing from notification, allow access to any animal's data
        if (viewFromNotification) {
            const animal = await Animal.findById(animalId_backend)
                .populate('ownerId', 'id_public')
                .lean();
            
            if (!animal) {
                return res.status(404).json({ message: 'Animal not found.' });
            }
            
            console.log(`[viewFromNotification] Allowing user to view animal ${animal.id_public} for notification purposes`);
            return res.status(200).json(animal);
        }

        // Uses a helper that also checks ownership
        const animal = await getAnimalByIdAndUser(appUserId_backend, animalId_backend);

        // Debug: Log health records being returned
        console.log(`[GET /api/animals/:id] Returning animal ${animal.id_public} with health records:`, {
            vaccinations: animal.vaccinations ? `${animal.vaccinations.length} bytes` : 'null',
            dewormingRecords: animal.dewormingRecords ? `${animal.dewormingRecords.length} bytes` : 'null',
            parasiteControl: animal.parasiteControl ? `${animal.parasiteControl.length} bytes` : 'null',
            medicalProcedures: animal.medicalProcedures ? `${animal.medicalProcedures.length} bytes` : 'null',
            labResults: animal.labResults ? `${animal.labResults.length} bytes` : 'null'
        });

        res.status(200).json(animal);
    } catch (error) {
        console.error('Error fetching single animal:', error);
        if (error.message.includes("not found") || error.message.includes("does not belong to user")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error while fetching animal details.' });
    }
});


// PUT /api/animals/:id_backend
// 4. Updates an existing animal's record.
// Accepts optional multipart file field `file` and will set `imageUrl` automatically.
router.put('/:id_backend', upload.single('file'), async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.resolvedAnimalId || req.params.id_backend;
        const updates = req.body || {};
        console.log('[PUT /api/animals/:id] Request received for animal:', animalId_backend);
        console.log('[PUT /api/animals/:id] Health records in request:', {
            vaccinations: updates.vaccinations,
            dewormingRecords: updates.dewormingRecords,
            parasiteControl: updates.parasiteControl,
            medicalProcedures: updates.medicalProcedures,
            labResults: updates.labResults
        });
        console.log('[PUT /api/animals/:id] Updates:', JSON.stringify({ 
            breederId_public: updates.breederId_public,
            breederyId: updates.breederyId, 
            geneticCode: updates.geneticCode, 
            remarks: updates.remarks 
        }));

        // Normalize parent fields on update as well (accept public numeric IDs)
        const resolveParentPublicToBackend = async (pubVal) => {
            if (!pubVal) return null;
            const num = Number(pubVal);
            if (Number.isNaN(num)) return null;
            const found = await Animal.findOne({ id_public: num, ownerId: appUserId_backend }).select('_id id_public').lean();
            return found ? { backendId: found._id.toString(), id_public: found.id_public } : null;
        };

        // Map alias parent fields into schema's sireId_public/damId_public on update
        // Check if explicitly provided (even if null) to allow clearing
        if (updates.sireId_public === undefined) {
            const candidate = updates.fatherId_public ?? updates.fatherId ?? updates.father_id ?? updates.father_public;
            if (candidate !== undefined) {
                if (candidate === null) {
                    updates.sireId_public = null;
                } else {
                    try {
                        const resolved = await resolveParentPublicToBackend(candidate);
                        if (resolved) {
                            updates.sireId_public = resolved.id_public;
                        } else {
                            const num = Number(candidate);
                            if (!Number.isNaN(num)) updates.sireId_public = num;
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        }

        if (updates.damId_public === undefined) {
            const candidateM = updates.motherId_public ?? updates.motherId ?? updates.mother_id ?? updates.mother_public;
            if (candidateM !== undefined) {
                if (candidateM === null) {
                    updates.damId_public = null;
                } else {
                    try {
                        const resolvedM = await resolveParentPublicToBackend(candidateM);
                        if (resolvedM) {
                            updates.damId_public = resolvedM.id_public;
                        } else {
                            const numM = Number(candidateM);
                            if (!Number.isNaN(numM)) updates.damId_public = numM;
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        }

        // Accept image URL from JSON body (compatibility with upload-then-save flow)
        const incImg = updates.imageUrl || updates.photoUrl || updates.profileImage || updates.profileImageUrl || updates.image_path || updates.photo || updates.image_url;
        if (incImg) {
            let url = incImg;
            if (typeof url === 'string' && url.startsWith('http://')) {
                url = url.replace(/^http:\/\//i, 'https://');
            }
            updates.imageUrl = url;
            if (!updates.photoUrl) updates.photoUrl = url;
        }

        // If a multipart file was uploaded directly with the animal update, set image URL from file
        if (req.file) {
            if (useR2) {
                try {
                    const r2 = require('../storage/r2_client');
                    const ext = path.extname(req.file.originalname) || '';
                    const key = `animals/${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
                    const url = await r2.uploadBuffer(key, req.file.buffer, req.file.mimetype);
                    updates.imageUrl = url;
                    updates.photoUrl = updates.photoUrl || url;
                    updates._uploadedFilename = key;
                } catch (r2err) {
                    console.error('R2 upload failed (update):', r2err);
                }
            } else {
                const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
                let base = process.env.PUBLIC_HOST || process.env.PUBLIC_URL || process.env.DOMAIN || null;
                if (base) {
                    if (!/^https?:\/\//i.test(base)) base = `${proto}://${base}`;
                    base = base.replace(/\/$/, '');
                } else {
                    base = `${proto}://${req.get('host')}`;
                }
                const fileUrl = `${base}/api/uploads/${req.file.filename}`;
                updates.imageUrl = fileUrl;
                updates.photoUrl = updates.photoUrl || fileUrl;
            }
        }

        // Map frontend field names to backend schema
        if (updates.isDisplay !== undefined) {
            updates.showOnPublicProfile = updates.isDisplay;
        }

        // Get original animal data to compare for changes before sending notifications
        const originalAnimal = await Animal.findOne({ _id: animalId_backend, ownerId: appUserId_backend }).select('breederId_public sireId_public damId_public').lean();
        
        // IMPORTANT: Animal is saved with breeder/parent links immediately.
        // Notifications are created AFTER the save, but the links remain active.
        // Links are only removed if the breeder/parent owner explicitly rejects via notification.
        const updatedAnimal = await updateAnimal(appUserId_backend, animalId_backend, updates);

        // Create notifications for breeder and parent linkages (if targeting other users' data)
        const currentUserPublicId = req.user.id_public;
        console.log(`[UPDATE] Current user public ID from req.user: ${currentUserPublicId}`);
        
        // Check if this animal was transferred (has originalOwnerId)
        const isTransferred = !!updatedAnimal.originalOwnerId;
        let originalOwnerPublicId = null;
        if (isTransferred) {
            const originalOwner = await User.findById(updatedAnimal.originalOwnerId).select('id_public');
            originalOwnerPublicId = originalOwner?.id_public;
            console.log(`[UPDATE][Notification Check] Animal was transferred, original owner: CT${originalOwnerPublicId}`);
        }
        
        // Check if breeder was actually changed (only send notification if it's a new breeder)
        const breederChanged = originalAnimal?.breederId_public !== updatedAnimal.breederId_public;
        if (breederChanged && updatedAnimal.breederId_public && updatedAnimal.breederId_public !== currentUserPublicId) {
            console.log(`[UPDATE] Breeder changed from ${originalAnimal?.breederId_public || 'null'} to ${updatedAnimal.breederId_public}`);
            // Check if this user owns an animal with that ID (local ownership check)
            const localCheck = await Animal.findOne({ id_public: updatedAnimal.breederId_public, ownerId: appUserId_backend });
            console.log(`[UPDATE] Local check for breeder animal: ${localCheck ? 'found' : 'not found'}`);
            if (!localCheck) {
                // Skip notification if animal was transferred and breeder is the original owner
                const isOriginalOwnerAsBreeder = isTransferred && updatedAnimal.breederId_public === originalOwnerPublicId;
                if (isOriginalOwnerAsBreeder) {
                    console.log(`[UPDATE][Notification Skip] Breeder is original owner of transferred animal - skipping notification`);
                } else {
                    // It's someone else's user ID - create notification
                    console.log(`[UPDATE] Creating breeder notification for user CT${updatedAnimal.breederId_public}`);
                    await createLinkageNotification(
                        updatedAnimal.breederId_public,
                        req.user.id,
                        currentUserPublicId,
                        updatedAnimal.id_public,
                        updatedAnimal.name,
                        'breeder_request'
                    );
                }
            }
        }
        
        // Check if sire (father) was actually changed (only send notification if it's a new sire)
        const sireChanged = originalAnimal?.sireId_public !== updatedAnimal.sireId_public;
        if (sireChanged && updatedAnimal.sireId_public) {
            console.log(`[UPDATE] Sire changed from ${originalAnimal?.sireId_public || 'null'} to ${updatedAnimal.sireId_public}`);
            const localSire = await Animal.findOne({ id_public: updatedAnimal.sireId_public, ownerId: appUserId_backend });
            if (!localSire) {
                // It's someone else's animal - create notification
                // Find who owns this animal
                const sireOwner = await Animal.findOne({ id_public: updatedAnimal.sireId_public }).populate('ownerId', 'id_public');
                if (sireOwner && sireOwner.ownerId && sireOwner.ownerId.id_public) {
                    // Skip notification if animal was transferred and sire owner is the original owner
                    const isOriginalOwnerAsSireOwner = isTransferred && sireOwner.ownerId.id_public === originalOwnerPublicId;
                    if (isOriginalOwnerAsSireOwner) {
                        console.log(`[UPDATE][Notification Skip] Sire owner is original owner of transferred animal - skipping notification`);
                    } else {
                        await createLinkageNotification(
                            sireOwner.ownerId.id_public,
                            req.user.id,
                            currentUserPublicId,
                            updatedAnimal.id_public,
                            updatedAnimal.name,
                            'parent_request',
                            'sire',
                            updatedAnimal.sireId_public
                        );
                    }
                }
            }
        }
        
        // Check if dam (mother) was actually changed (only send notification if it's a new dam)
        const damChanged = originalAnimal?.damId_public !== updatedAnimal.damId_public;
        if (damChanged && updatedAnimal.damId_public) {
            console.log(`[UPDATE] Dam changed from ${originalAnimal?.damId_public || 'null'} to ${updatedAnimal.damId_public}`);
            const localDam = await Animal.findOne({ id_public: updatedAnimal.damId_public, ownerId: appUserId_backend });
            if (!localDam) {
                // It's someone else's animal - create notification
                // Find who owns this animal
                const damOwner = await Animal.findOne({ id_public: updatedAnimal.damId_public }).populate('ownerId', 'id_public');
                if (damOwner && damOwner.ownerId && damOwner.ownerId.id_public) {
                    // Skip notification if animal was transferred and dam owner is the original owner
                    const isOriginalOwnerAsDamOwner = isTransferred && damOwner.ownerId.id_public === originalOwnerPublicId;
                    if (isOriginalOwnerAsDamOwner) {
                        console.log(`[UPDATE][Notification Skip] Dam owner is original owner of transferred animal - skipping notification`);
                    } else {
                        await createLinkageNotification(
                            damOwner.ownerId.id_public,
                            req.user.id,
                            currentUserPublicId,
                            updatedAnimal.id_public,
                            updatedAnimal.name,
                            'parent_request',
                            'dam',
                            updatedAnimal.damId_public
                        );
                    }
                }
            }
        }

        // Sync to publicanimals collection
        const { syncAnimalToPublic } = require('../utils/syncPublicAnimals');
        await syncAnimalToPublic(updatedAnimal);

        // Log user activity
        logUserActivity({
            userId: appUserId_backend,
            id_public: req.user.id_public,
            action: USER_ACTIONS.ANIMAL_UPDATE,
            targetType: 'animal',
            targetId: updatedAnimal._id,
            targetId_public: updatedAnimal.id_public,
            details: { name: updatedAnimal.name, fieldsUpdated: Object.keys(updates) },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            message: 'Animal updated successfully!',
            animal: updatedAnimal
        });
    } catch (error) {
        console.error('Error updating animal:', error && error.stack ? error.stack : error);
        // Multer file size exceed or invalid file handling
        if (error && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Uploaded file exceeds 500KB limit.' });
        }
        if (error && error.message === 'INVALID_FILE_TYPE') {
            return res.status(415).json({ message: 'Unsupported file type. Only PNG and JPEG images are allowed.' });
        }
        // Use 404 if the animal isn't found or doesn't belong to the user
        if (error && (error.message.includes("not found") || error.message.includes("does not own"))) {
            return res.status(404).json({ message: error.message });
        }
        if (error instanceof ProfanityError) {
            return res.status(error.statusCode || 400).json({ message: error.message });
        }

        // Return error message to assist debugging (remove in production)
        res.status(500).json({ message: 'Internal server error during animal update.', error: error && error.message ? error.message : String(error) });
    }
});


// PUT /api/animals/:id_backend/toggle
// 5. Toggles an animal's public visibility.
router.put('/:id_backend/toggle', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.resolvedAnimalId || req.params.id_backend;
        // Expected body: { makePublic: true, includeRemarks: false, includeGeneticCode: true }
        const toggleData = req.body; 

        const updatedAnimal = await toggleAnimalPublic(appUserId_backend, animalId_backend, toggleData);

        res.status(200).json({
            message: `Animal visibility set to ${updatedAnimal.showOnPublicProfile ? 'public' : 'private'}`,
            showOnPublicProfile: updatedAnimal.showOnPublicProfile
        });
    } catch (error) {
        console.error('Error toggling animal public status:', error);
        // Use 404 if the animal isn't found or doesn't belong to the user
        if (error.message.includes("not found")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during public toggle.' });
    }
});


// DELETE /api/animals/:id_backend
// 6. Deletes an animal from the user's collection.
router.delete('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.resolvedAnimalId || req.params.id_backend;

        const result = await deleteAnimal(appUserId_backend, animalId_backend);

        // Log user activity
        logUserActivity({
            userId: appUserId_backend,
            id_public: req.user.id_public,
            action: USER_ACTIONS.ANIMAL_DELETE,
            targetType: 'animal',
            targetId: animalId_backend,
            details: { reverted: result?.reverted || false },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({ 
            message: result?.message || 'Animal deleted successfully.',
            reverted: result?.reverted || false
        });
    } catch (error) {
        console.error('Error deleting animal:', error);
        if (error.message.includes("not found") || error.message.includes("does not own")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during animal deletion.' });
    }
});


// GET /api/animals/:id_public/offspring
// 7. Get all offspring for a specific animal (AUTHENTICATED - shows ALL offspring)
// This is the private/local version that requires authentication
router.get('/:id_public/offspring', async (req, res) => {
    try {
        const { id_public } = req.params;
        const animalIdPublic = id_public; // Keep as string (supports CTC format)

        const { Litter } = require('../database/models');
        const authenticatedUserId = req.user.id;

        // For authenticated users: get ALL offspring across entire database (not just owned)
        const allOffspring = await Animal.find({
            $or: [
                { sireId_public: animalIdPublic },
                { damId_public: animalIdPublic },
                { fatherId_public: animalIdPublic },
                { motherId_public: animalIdPublic }
            ]
            // Removed ownerId filter - search ALL animals globally
        }).lean();

        // Group offspring by litter (based on birthDate and other parent)
        const litterGroups = new Map();

        for (const offspring of allOffspring) {
            // Determine the other parent ID
            const isSire = offspring.sireId_public === animalIdPublic || offspring.fatherId_public === animalIdPublic;
            const otherParentId = isSire 
                ? (offspring.damId_public || offspring.motherId_public)
                : (offspring.sireId_public || offspring.fatherId_public);
            const otherParentType = isSire ? 'dam' : 'sire';

            // Create a unique key for the litter based on birthDate and other parent
            const birthDate = offspring.birthDate ? new Date(offspring.birthDate).toISOString().split('T')[0] : 'unknown';
            const litterKey = `${birthDate}_${otherParentId || 'none'}`;

            if (!litterGroups.has(litterKey)) {
                litterGroups.set(litterKey, {
                    birthDate: offspring.birthDate,
                    otherParentId: otherParentId,
                    otherParentType: otherParentType,
                    offspring: []
                });
            }

            litterGroups.get(litterKey).offspring.push(offspring);
        }

        // Convert to array and fetch additional data for each litter
        const littersWithOffspring = await Promise.all(
            Array.from(litterGroups.values()).map(async (group) => {
                // Try to find a matching litter record
                let litterRecord = null;
                if (group.birthDate && group.otherParentId) {
                    litterRecord = await Litter.findOne({
                        birthDate: group.birthDate,
                        $or: [
                            { sireId_public: animalIdPublic, damId_public: group.otherParentId },
                            { sireId_public: group.otherParentId, damId_public: animalIdPublic }
                        ]
                    }).lean();
                }

                // Fetch other parent data - search globally (user's animals first, then any other animal)
                let otherParent = null;
                if (group.otherParentId) {
                    // Try user's animals first
                    otherParent = await Animal.findOne({ 
                        id_public: group.otherParentId,
                        ownerId: authenticatedUserId 
                    }).lean();
                    
                    // If not owned by user, search all animals globally
                    if (!otherParent) {
                        otherParent = await Animal.findOne({ 
                            id_public: group.otherParentId 
                        }).lean();
                    }
                }

                return {
                    litterId: litterRecord?._id || null,
                    litterName: litterRecord?.breedingPairCodeName || null,
                    birthDate: group.birthDate,
                    sireId_public: group.otherParentType === 'dam' ? animalIdPublic : group.otherParentId,
                    damId_public: group.otherParentType === 'sire' ? animalIdPublic : group.otherParentId,
                    otherParent: otherParent,
                    otherParentType: group.otherParentType,
                    offspring: group.offspring,
                    numberBorn: group.offspring.length
                };
            })
        );

        // Sort by birth date (most recent first)
        littersWithOffspring.sort((a, b) => {
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            return new Date(b.birthDate) - new Date(a.birthDate);
        });

        res.status(200).json(littersWithOffspring);
    } catch (error) {
        console.error('Error fetching offspring:', error);
        res.status(500).json({ message: 'Internal server error while fetching offspring.' });
    }
});

// --- CALCULATE INBREEDING COEFFICIENT FOR AN ANIMAL ---
router.get('/:id_public/inbreeding', async (req, res) => {
    try {
        const { id_public } = req.params;
        const generations = parseInt(req.query.generations) || 50;

        // Fetch animal function that works with both owned and public animals
        const fetchAnimal = async (animalId) => {
            let animal = await Animal.findOne({ id_public: animalId }).lean();
            if (!animal) {
                animal = await PublicAnimal.findOne({ id_public: animalId }).lean();
            }
            return animal;
        };

        const coefficient = await calculateInbreedingCoefficient(
            id_public,
            fetchAnimal,
            generations
        );

        // Update cached value if this is an owned animal
        const animal = await Animal.findOne({ id_public });
        if (animal) {
            animal.inbreedingCoefficient = coefficient;
            await animal.save();

            // Update public animal if it exists
            const publicAnimal = await PublicAnimal.findOne({ id_public });
            if (publicAnimal) {
                publicAnimal.inbreedingCoefficient = coefficient;
                await publicAnimal.save();
            }
        }

        res.status(200).json({ 
            id_public,
            inbreedingCoefficient: coefficient 
        });
    } catch (error) {
        console.error('Error calculating inbreeding:', error);
        res.status(500).json({ message: 'Internal server error while calculating inbreeding.' });
    }
});

// --- CALCULATE INBREEDING COEFFICIENT FOR A PAIRING ---
router.get('/inbreeding/pairing', async (req, res) => {
    try {
        const { sireId, damId, generations } = req.query;

        if (!sireId || !damId) {
            return res.status(400).json({ message: 'Both sireId and damId are required' });
        }

        const fetchAnimal = async (animalId) => {
            let animal = await Animal.findOne({ id_public: animalId }).lean();
            if (!animal) {
                animal = await PublicAnimal.findOne({ id_public: animalId }).lean();
            }
            return animal;
        };

        const coefficient = await calculatePairingInbreeding(
            sireId,
            damId,
            fetchAnimal,
            parseInt(generations) || 50
        );

        res.status(200).json({ 
            sireId,
            damId,
            inbreedingCoefficient: coefficient 
        });
    } catch (error) {
        console.error('Error calculating pairing inbreeding:', error);
        res.status(500).json({ message: 'Internal server error while calculating pairing inbreeding.' });
    }
});

// POST /api/animals/:id_public/hide
// Hide a view-only animal from user's list
router.post('/:id_public/hide', async (req, res) => {
    try {
        const id_public = req.params.id_public;
        const appUserId_backend = req.user.id;

        const result = await hideViewOnlyAnimal(appUserId_backend, id_public);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error hiding view-only animal:', error);
        res.status(400).json({ message: error.message || 'Failed to hide animal.' });
    }
});

// POST /api/animals/:id_public/restore
// Restore a hidden view-only animal to user's list
router.post('/:id_public/restore', async (req, res) => {
    try {
        const id_public = req.params.id_public;
        const appUserId_backend = req.user.id;

        const result = await restoreViewOnlyAnimal(appUserId_backend, id_public);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error restoring view-only animal:', error);
        res.status(400).json({ message: error.message || 'Failed to restore animal.' });
    }
});

// GET /api/animals/hidden
// Get all hidden view-only animals for the user
router.get('/hidden/list', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;

        const animals = await getHiddenViewOnlyAnimals(appUserId_backend);

        res.status(200).json(animals);
    } catch (error) {
        console.error('Error fetching hidden animals:', error);
        res.status(500).json({ message: 'Internal server error while fetching hidden animals.' });
    }
});

// POST /api/animals/bulk-publish
// Bulk publish all user's animals (make them public and create PublicAnimal records)
router.post('/bulk-publish', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        
        // Get all user's animals
        const animals = await getUsersAnimals(appUserId_backend);
        
        let publishedCount = 0;
        let alreadyPublicCount = 0;
        
        for (const animal of animals) {
            if (animal.showOnPublicProfile) {
                alreadyPublicCount++;
                continue;
            }
            
            // Make animal public with default settings (no remarks/genetic code)
            await toggleAnimalPublic(appUserId_backend, animal._id, {
                makePublic: true,
                includeRemarks: false,
                includeGeneticCode: false
            });
            
            publishedCount++;
        }
        
        res.status(200).json({
            message: 'Bulk publish completed',
            publishedCount,
            alreadyPublicCount,
            totalAnimals: animals.length
        });
    } catch (error) {
        console.error('Error bulk publishing animals:', error);
        res.status(500).json({ message: 'Internal server error during bulk publish' });
    }
});

module.exports = router;