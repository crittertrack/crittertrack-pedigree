const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// simple disk storage for images (adjust for S3 in production)
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
        cb(null, name);
    }
});
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
    deleteAnimal // Assuming this helper exists
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

        // If it's numeric, treat as id_public and resolve to internal _id
        if (/^\d+$/.test(value)) {
            // Need the user id to scope the lookup; if not available yet, defer
            const appUserId_backend = req.user && req.user.id;
            if (!appUserId_backend) {
                return res.status(400).json({ message: 'User context required to resolve animal id.' });
            }
            const animal = await Animal.findOne({ id_public: Number(value), ownerId: appUserId_backend }).select('_id').lean();
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


// --- Animal Route Controllers (PROTECTED) ---

// POST /api/animals
// 1. Registers a new animal under the logged-in user.
// Accepts optional multipart file field `file` and will set `imageUrl` automatically.
router.post('/', upload.single('file'), async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
            const animalData = req.body || {};

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
                const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
                let base = process.env.PUBLIC_HOST || process.env.PUBLIC_URL || process.env.DOMAIN || null;
                if (base) {
                    if (!/^https?:\/\//i.test(base)) base = `${proto}://${base}`;
                    base = base.replace(/\/$/, '');
                } else {
                    base = `${proto}://${req.get('host')}`;
                }
                const fileUrl = `${base}/uploads/${req.file.filename}`;
                animalData.imageUrl = fileUrl;
                animalData.photoUrl = animalData.photoUrl || fileUrl;
            }

        // Basic validation for required fields
        if (!animalData.name || !animalData.species) {
             return res.status(400).json({ message: 'Missing required animal fields: name and species.' });
        }

        const newAnimal = await addAnimal(appUserId_backend, animalData);

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


// GET /api/animals/:id_backend
// 3. Gets a single animal's private details.
router.get('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.resolvedAnimalId || req.params.id_backend;

        // Uses a helper that also checks ownership
        const animal = await getAnimalByIdAndUser(appUserId_backend, animalId_backend);

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
            const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
            let base = process.env.PUBLIC_HOST || process.env.PUBLIC_URL || process.env.DOMAIN || null;
            if (base) {
                if (!/^https?:\/\//i.test(base)) base = `${proto}://${base}`;
                base = base.replace(/\/$/, '');
            } else {
                base = `${proto}://${req.get('host')}`;
            }
            const fileUrl = `${base}/uploads/${req.file.filename}`;
            updates.imageUrl = fileUrl;
            updates.photoUrl = updates.photoUrl || fileUrl;
        }

        const updatedAnimal = await updateAnimal(appUserId_backend, animalId_backend, updates);

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

        await deleteAnimal(appUserId_backend, animalId_backend);

        res.status(200).json({ message: 'Animal deleted successfully.' });
    } catch (error) {
        console.error('Error deleting animal:', error);
        if (error.message.includes("not found") || error.message.includes("does not own")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during animal deletion.' });
    }
});


module.exports = router;