const express = require('express');
const router = express.Router();
const { Species, SpeciesConfig, GeneticsData, Animal, User, PublicProfile } = require('../database/models');

// Middleware to check admin/moderator access
const requireAdmin = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const user = await User.findById(userId).select('role');
        if (!user || !['admin', 'moderator'].includes(user.role)) {
            return res.status(403).json({ error: 'Admin or moderator access required' });
        }
        
        req.adminUser = user;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

// ============================================
// SPECIES MANAGEMENT ROUTES
// ============================================

// GET /api/admin/species - Get all species with stats
router.get('/species', requireAdmin, async (req, res) => {
    try {
        const species = await Species.find({}).sort({ isDefault: -1, name: 1 });
        
        // Get animal counts per species
        const speciesCounts = await Animal.aggregate([
            { $group: { _id: '$species', count: { $sum: 1 } } }
        ]);
        const countMap = {};
        speciesCounts.forEach(s => { countMap[s._id] = s.count; });
        
        // Get species configs
        const configs = await SpeciesConfig.find({});
        const configMap = {};
        configs.forEach(c => { configMap[c.speciesName] = c; });
        
        // Get user information for custom species
        const userIds = species.filter(s => s.userId).map(s => s.userId);
        const publicProfiles = await PublicProfile.find({ userId_backend: { $in: userIds } });
        const userMap = {};
        publicProfiles.forEach(p => { 
            userMap[p.userId_backend.toString()] = {
                id_public: p.id_public,
                personalName: p.personalName,
                breederName: p.breederName,
                showBreederName: p.showBreederName
            };
        });
        
        const result = species.map(s => ({
            _id: s._id,
            name: s.name,
            latinName: s.latinName,
            category: s.category,
            isDefault: s.isDefault,
            userId: s.userId,
            createdBy: s.userId ? userMap[s.userId.toString()] : null,
            createdAt: s.createdAt,
            animalCount: countMap[s.name] || 0,
            hasConfig: !!configMap[s.name],
            config: configMap[s.name] || null
        }));
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching species:', error);
        res.status(500).json({ error: 'Failed to fetch species' });
    }
});

// POST /api/admin/species - Add a new species (admin only)
router.post('/species', requireAdmin, async (req, res) => {
    try {
        const { name, latinName, category, isDefault } = req.body;
        
        if (!name || !category) {
            return res.status(400).json({ error: 'Name and category are required' });
        }
        
        // Check if species already exists
        const existing = await Species.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            return res.status(409).json({ error: 'Species already exists' });
        }
        
        const newSpecies = new Species({
            name: name.trim(),
            latinName: latinName?.trim() || null,
            category,
            isDefault: isDefault || false,
            userId: req.user.userId
        });
        
        await newSpecies.save();
        res.status(201).json(newSpecies);
    } catch (error) {
        console.error('Error creating species:', error);
        res.status(500).json({ error: 'Failed to create species' });
    }
});

// PATCH /api/admin/species/:id - Update a species
router.patch('/species/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, latinName, category, isDefault } = req.body;
        
        const species = await Species.findById(id);
        if (!species) {
            return res.status(404).json({ error: 'Species not found' });
        }
        
        // If renaming, update all animals with this species
        if (name && name !== species.name) {
            const oldName = species.name;
            await Animal.updateMany(
                { species: oldName },
                { $set: { species: name.trim() } }
            );
            
            // Update species config if exists
            await SpeciesConfig.updateOne(
                { speciesName: oldName },
                { $set: { speciesName: name.trim() } }
            );
            
            // Update genetics data if exists
            await GeneticsData.updateMany(
                { speciesName: oldName },
                { $set: { speciesName: name.trim() } }
            );
        }
        
        if (name) species.name = name.trim();
        if (latinName !== undefined) species.latinName = latinName?.trim() || null;
        if (category) species.category = category;
        if (isDefault !== undefined) species.isDefault = isDefault;
        
        await species.save();
        res.json(species);
    } catch (error) {
        console.error('Error updating species:', error);
        res.status(500).json({ error: 'Failed to update species' });
    }
});

// DELETE /api/admin/species/:id - Delete a species (only if no animals use it)
router.delete('/species/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { replacementSpecies } = req.query; // Optional: species name to migrate animals to
        
        const species = await Species.findById(id);
        if (!species) {
            return res.status(404).json({ error: 'Species not found' });
        }
        
        // Check if any animals use this species
        const animalCount = await Animal.countDocuments({ species: species.name });
        
        // If replacement species is provided, migrate animals
        if (animalCount > 0) {
            if (!replacementSpecies) {
                return res.status(400).json({ 
                    error: `Cannot delete: ${animalCount} animals are using this species`,
                    animalCount,
                    requiresReplacement: true
                });
            }
            
            // Verify replacement species exists
            const replacementExists = await Species.findOne({ name: replacementSpecies });
            if (!replacementExists) {
                return res.status(400).json({ error: 'Replacement species not found' });
            }
            
            // Migrate all animals to the replacement species
            await Animal.updateMany(
                { species: species.name },
                { $set: { species: replacementSpecies } }
            );
        }
        
        // Delete associated config and genetics data
        await SpeciesConfig.deleteOne({ speciesName: species.name });
        await GeneticsData.deleteMany({ speciesName: species.name });
        
        await Species.findByIdAndDelete(id);
        res.json({ 
            message: 'Species deleted successfully',
            animalsMigrated: animalCount,
            migratedTo: replacementSpecies || null
        });
    } catch (error) {
        console.error('Error deleting species:', error);
        res.status(500).json({ error: 'Failed to delete species' });
    }
});

// ============================================
// SPECIES CONFIG ROUTES (Field Replacements)
// ============================================

// GET /api/admin/species-config/:speciesName - Get config for a species
router.get('/species-config/:speciesName', requireAdmin, async (req, res) => {
    try {
        const { speciesName } = req.params;
        
        let config = await SpeciesConfig.findOne({ speciesName });
        
        if (!config) {
            // Return empty config structure
            config = {
                speciesName,
                fieldReplacements: {},
                customFields: [],
                hiddenFields: [],
                adminNotes: null,
                isActive: true
            };
        }
        
        res.json(config);
    } catch (error) {
        console.error('Error fetching species config:', error);
        res.status(500).json({ error: 'Failed to fetch species config' });
    }
});

// PUT /api/admin/species-config/:speciesName - Create or update config
router.put('/species-config/:speciesName', requireAdmin, async (req, res) => {
    try {
        const { speciesName } = req.params;
        const { fieldReplacements, customFields, hiddenFields, adminNotes, isActive } = req.body;
        
        let config = await SpeciesConfig.findOne({ speciesName });
        
        if (config) {
            // Update existing
            if (fieldReplacements !== undefined) config.fieldReplacements = fieldReplacements;
            if (customFields !== undefined) config.customFields = customFields;
            if (hiddenFields !== undefined) config.hiddenFields = hiddenFields;
            if (adminNotes !== undefined) config.adminNotes = adminNotes;
            if (isActive !== undefined) config.isActive = isActive;
            config.modifiedBy = req.user.userId;
            config.updatedAt = new Date();
        } else {
            // Create new
            config = new SpeciesConfig({
                speciesName,
                fieldReplacements: fieldReplacements || {},
                customFields: customFields || [],
                hiddenFields: hiddenFields || [],
                adminNotes: adminNotes || null,
                isActive: isActive !== false,
                modifiedBy: req.user.userId
            });
        }
        
        await config.save();
        res.json(config);
    } catch (error) {
        console.error('Error saving species config:', error);
        res.status(500).json({ error: 'Failed to save species config' });
    }
});

// ============================================
// GENETICS DATA ROUTES (Calculator Builder)
// ============================================

// GET /api/admin/genetics - Get all genetics data (drafts and published)
router.get('/genetics', requireAdmin, async (req, res) => {
    try {
        const geneticsData = await GeneticsData.find({})
            .populate('lastEditedBy', 'username')
            .populate('publishedBy', 'username')
            .sort({ speciesName: 1, version: -1 });
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error fetching genetics data:', error);
        res.status(500).json({ error: 'Failed to fetch genetics data' });
    }
});

// GET /api/admin/genetics/:speciesName - Get genetics data for a species
router.get('/genetics/:speciesName', requireAdmin, async (req, res) => {
    try {
        const { speciesName } = req.params;
        const { draft } = req.query;
        
        // If draft=true, get the draft version, otherwise get published
        const query = { speciesName };
        if (draft === 'true') {
            query.isPublished = false;
        } else {
            query.isPublished = true;
        }
        
        let geneticsData = await GeneticsData.findOne(query)
            .populate('lastEditedBy', 'username')
            .populate('publishedBy', 'username');
        
        if (!geneticsData && draft !== 'true') {
            // Try to get draft if no published version exists
            geneticsData = await GeneticsData.findOne({ speciesName, isPublished: false });
        }
        
        res.json(geneticsData || null);
    } catch (error) {
        console.error('Error fetching genetics data:', error);
        res.status(500).json({ error: 'Failed to fetch genetics data' });
    }
});

// POST /api/admin/genetics - Create new genetics data for a species
router.post('/genetics', requireAdmin, async (req, res) => {
    try {
        const { speciesName, genes, markingGenes, phenotypeRules, adminNotes } = req.body;
        
        if (!speciesName) {
            return res.status(400).json({ error: 'Species name is required' });
        }
        
        // Check if draft already exists
        const existingDraft = await GeneticsData.findOne({ speciesName, isPublished: false });
        if (existingDraft) {
            return res.status(409).json({ 
                error: 'A draft already exists for this species. Edit it instead.',
                existingId: existingDraft._id
            });
        }
        
        const geneticsData = new GeneticsData({
            speciesName,
            genes: genes || [],
            markingGenes: markingGenes || [],
            phenotypeRules: phenotypeRules || [],
            adminNotes: adminNotes || null,
            isPublished: false,
            version: 1,
            lastEditedBy: req.user.userId
        });
        
        await geneticsData.save();
        res.status(201).json(geneticsData);
    } catch (error) {
        console.error('Error creating genetics data:', error);
        res.status(500).json({ error: 'Failed to create genetics data' });
    }
});

// PUT /api/admin/genetics/:id - Update genetics data
router.put('/genetics/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { genes, markingGenes, coatGenes, otherGenes, phenotypeRules, adminNotes } = req.body;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data. Create a new draft first.' });
        }
        
        if (genes !== undefined) geneticsData.genes = genes;
        if (markingGenes !== undefined) geneticsData.markingGenes = markingGenes;
        if (coatGenes !== undefined) geneticsData.coatGenes = coatGenes;
        if (otherGenes !== undefined) geneticsData.otherGenes = otherGenes;
        if (phenotypeRules !== undefined) geneticsData.phenotypeRules = phenotypeRules;
        if (adminNotes !== undefined) geneticsData.adminNotes = adminNotes;
        geneticsData.lastEditedBy = req.user.userId;
        geneticsData.updatedAt = new Date();
        
        await geneticsData.save();
        res.json(geneticsData);
    } catch (error) {
        console.error('Error updating genetics data:', error);
        res.status(500).json({ error: 'Failed to update genetics data' });
    }
});

// POST /api/admin/genetics/:id/publish - Publish genetics data
router.post('/genetics/:id/publish', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const draft = await GeneticsData.findById(id);
        if (!draft) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (draft.isPublished) {
            return res.status(400).json({ error: 'Already published' });
        }
        
        // Archive current published version if exists
        const currentPublished = await GeneticsData.findOne({ 
            speciesName: draft.speciesName, 
            isPublished: true 
        });
        
        if (currentPublished) {
            // Delete old published version (or could archive it)
            await GeneticsData.findByIdAndDelete(currentPublished._id);
        }
        
        // Publish the draft
        draft.isPublished = true;
        draft.publishedAt = new Date();
        draft.publishedBy = req.user.userId;
        draft.version = (currentPublished?.version || 0) + 1;
        
        await draft.save();
        res.json(draft);
    } catch (error) {
        console.error('Error publishing genetics data:', error);
        res.status(500).json({ error: 'Failed to publish genetics data' });
    }
});

// POST /api/admin/genetics/:id/duplicate - Create draft from published
router.post('/genetics/:id/duplicate', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const source = await GeneticsData.findById(id);
        if (!source) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        // Check if draft already exists
        const existingDraft = await GeneticsData.findOne({ 
            speciesName: source.speciesName, 
            isPublished: false 
        });
        if (existingDraft) {
            return res.status(409).json({ 
                error: 'A draft already exists for this species',
                existingId: existingDraft._id
            });
        }
        
        const draft = new GeneticsData({
            speciesName: source.speciesName,
            genes: source.genes,
            markingGenes: source.markingGenes,
            phenotypeRules: source.phenotypeRules,
            adminNotes: source.adminNotes,
            isPublished: false,
            version: source.version,
            lastEditedBy: req.user.userId
        });
        
        await draft.save();
        res.status(201).json(draft);
    } catch (error) {
        console.error('Error duplicating genetics data:', error);
        res.status(500).json({ error: 'Failed to create draft' });
    }
});

// DELETE /api/admin/genetics/:id - Delete genetics data
router.delete('/genetics/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        await GeneticsData.findByIdAndDelete(id);
        res.json({ message: 'Genetics data deleted successfully' });
    } catch (error) {
        console.error('Error deleting genetics data:', error);
        res.status(500).json({ error: 'Failed to delete genetics data' });
    }
});

// ============================================
// GENETICS DATA - GENE OPERATIONS
// ============================================

// POST /api/admin/genetics/:id/genes - Add a gene to genetics data
router.post('/genetics/:id/genes', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { symbol, name, description, alleles, geneType } = req.body;
        
        if (!symbol || !name) {
            return res.status(400).json({ error: 'Symbol and name are required' });
        }
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const newGene = {
            symbol: symbol.trim(),
            name: name.trim(),
            description: description || null,
            alleles: alleles || [],
            order: geneType === 'marking' 
                ? geneticsData.markingGenes.length 
                : geneType === 'coat'
                    ? geneticsData.coatGenes.length
                    : geneType === 'other'
                        ? (geneticsData.otherGenes || []).length
                        : geneticsData.genes.length
        };
        
        if (geneType === 'marking') {
            geneticsData.markingGenes.push(newGene);
        } else if (geneType === 'coat') {
            if (!geneticsData.coatGenes) geneticsData.coatGenes = [];
            geneticsData.coatGenes.push(newGene);
        } else if (geneType === 'other') {
            if (!geneticsData.otherGenes) geneticsData.otherGenes = [];
            geneticsData.otherGenes.push(newGene);
        } else {
            geneticsData.genes.push(newGene);
        }
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.status(201).json(geneticsData);
    } catch (error) {
        console.error('Error adding gene:', error);
        res.status(500).json({ error: 'Failed to add gene' });
    }
});

// PUT /api/admin/genetics/:id/genes/reorder - Reorder genes within a category (MUST come before :geneIndex route)
router.put('/genetics/:id/genes/reorder', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { fromIndex, toIndex, geneType } = req.body;
        
        console.log('genes/reorder endpoint hit:', { id, fromIndex, toIndex, geneType });
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            console.log('Genetics data not found for id:', id);
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const fromIdx = parseInt(fromIndex);
        const toIdx = parseInt(toIndex);
        
        if (fromIdx < 0 || fromIdx >= geneArray.length || 
            toIdx < 0 || toIdx >= geneArray.length) {
            return res.status(400).json({ error: 'Invalid gene indices' });
        }
        
        // Reorder the genes array
        const genesCopy = [...geneArray];
        console.log('Before reorder:', genesCopy.map((g, i) => `${i}: ${g.symbol}`));
        const [movedGene] = genesCopy.splice(fromIdx, 1);
        genesCopy.splice(toIdx, 0, movedGene);
        console.log('After reorder:', genesCopy.map((g, i) => `${i}: ${g.symbol}`));
        
        // Update the array based on geneType
        if (geneType === 'marking') {
            geneticsData.markingGenes = genesCopy;
        } else if (geneType === 'coat') {
            geneticsData.coatGenes = genesCopy;
        } else if (geneType === 'other') {
            geneticsData.otherGenes = genesCopy;
        } else {
            geneticsData.genes = genesCopy;
        }
        
        console.log('After assignment, genes[0-3]:', geneticsData.genes?.slice(0, 4).map(g => g.symbol));
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error reordering genes:', error);
        res.status(500).json({ error: 'Failed to reorder genes' });
    }
});

// PUT /api/admin/genetics/:id/genes/:geneIndex - Update a gene
router.put('/genetics/:id/genes/:geneIndex', requireAdmin, async (req, res) => {
    try {
        const { id, geneIndex } = req.params;
        const { symbol, name, description, alleles, isMarking } = req.body;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = isMarking ? geneticsData.markingGenes : geneticsData.genes;
        const index = parseInt(geneIndex);
        
        if (index < 0 || index >= geneArray.length) {
            return res.status(404).json({ error: 'Gene not found' });
        }
        
        if (symbol) geneArray[index].symbol = symbol.trim();
        if (name) geneArray[index].name = name.trim();
        if (description !== undefined) geneArray[index].description = description;
        if (alleles) geneArray[index].alleles = alleles;
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error updating gene:', error);
        res.status(500).json({ error: 'Failed to update gene' });
    }
});

// DELETE /api/admin/genetics/:id/genes/:geneIndex - Remove a gene
router.delete('/genetics/:id/genes/:geneIndex', requireAdmin, async (req, res) => {
    try {
        const { id, geneIndex } = req.params;
        const { isMarking, isCoat, isOther } = req.query;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = isOther === 'true'
            ? geneticsData.otherGenes
            : (isCoat === 'true' 
                ? geneticsData.coatGenes 
                : (isMarking === 'true' ? geneticsData.markingGenes : geneticsData.genes));
        const index = parseInt(geneIndex);
        
        if (index < 0 || index >= geneArray.length) {
            return res.status(404).json({ error: 'Gene not found' });
        }
        
        geneArray.splice(index, 1);
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error removing gene:', error);
        res.status(500).json({ error: 'Failed to remove gene' });
    }
});

// ============================================
// ALLELE OPERATIONS
// ============================================

// POST /api/admin/genetics/:id/loci/:locusIndex/alleles - Add an allele to a locus
router.post('/genetics/:id/loci/:locusIndex/alleles', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex } = req.params;
        const { symbol, name, phenotype, carrier, dominance, geneType } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Allele symbol is required' });
        }
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const index = parseInt(locusIndex);
        if (index < 0 || index >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[index];
        if (!locus.alleles) locus.alleles = [];
        
        const newAllele = {
            symbol: symbol.trim(),
            name: name ? name.trim() : null,
            phenotype: phenotype ? phenotype.trim() : null,
            carrier: carrier ? carrier.trim() : null,
            dominance: dominance || 'recessive',
            order: locus.alleles.length
        };
        
        locus.alleles.push(newAllele);
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.status(201).json(geneticsData);
    } catch (error) {
        console.error('Error adding allele:', error);
        res.status(500).json({ error: 'Failed to add allele' });
    }
});

// DELETE /api/admin/genetics/:id/loci/:locusIndex/alleles/:alleleIndex - Remove an allele
router.delete('/genetics/:id/loci/:locusIndex/alleles/:alleleIndex', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex, alleleIndex } = req.params;
        const { geneType } = req.query;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const locusIdx = parseInt(locusIndex);
        const alleleIdx = parseInt(alleleIndex);
        
        if (locusIdx < 0 || locusIdx >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[locusIdx];
        if (!locus.alleles || alleleIdx < 0 || alleleIdx >= locus.alleles.length) {
            return res.status(404).json({ error: 'Allele not found' });
        }
        
        locus.alleles.splice(alleleIdx, 1);
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error removing allele:', error);
        res.status(500).json({ error: 'Failed to remove allele' });
    }
});

// PUT /api/admin/genetics/:id/loci/:locusIndex/alleles/reorder - Reorder alleles within a locus
router.put('/genetics/:id/loci/:locusIndex/alleles/reorder', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex } = req.params;
        const { fromIndex, toIndex, geneType } = req.body;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const locusIdx = parseInt(locusIndex);
        const fromIdx = parseInt(fromIndex);
        const toIdx = parseInt(toIndex);
        
        if (locusIdx < 0 || locusIdx >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[locusIdx];
        if (!locus.alleles || fromIdx < 0 || fromIdx >= locus.alleles.length || 
            toIdx < 0 || toIdx >= locus.alleles.length) {
            return res.status(400).json({ error: 'Invalid allele indices' });
        }
        
        // Reorder the alleles array
        const allelesCopy = [...locus.alleles];
        const [movedAllele] = allelesCopy.splice(fromIdx, 1);
        allelesCopy.splice(toIdx, 0, movedAllele);
        
        // Update the order field for each allele
        allelesCopy.forEach((allele, index) => {
            allele.order = index;
        });
        
        locus.alleles = allelesCopy;
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error reordering alleles:', error);
        res.status(500).json({ error: 'Failed to reorder alleles' });
    }
});

// PUT /api/admin/genetics/:id/loci/:locusIndex/alleles/:alleleIndex - Edit an allele
router.put('/genetics/:id/loci/:locusIndex/alleles/:alleleIndex', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex, alleleIndex } = req.params;
        const { symbol, name, phenotype, carrier, dominance, geneType } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Allele symbol is required' });
        }
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const locusIdx = parseInt(locusIndex);
        const alleleIdx = parseInt(alleleIndex);
        
        if (locusIdx < 0 || locusIdx >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[locusIdx];
        if (!locus.alleles || alleleIdx < 0 || alleleIdx >= locus.alleles.length) {
            return res.status(404).json({ error: 'Allele not found' });
        }
        
        // Update allele
        locus.alleles[alleleIdx] = {
            ...locus.alleles[alleleIdx],
            symbol: symbol.trim(),
            name: name ? name.trim() : null,
            phenotype: phenotype ? phenotype.trim() : null,
            carrier: carrier ? carrier.trim() : null,
            dominance: dominance || 'recessive'
        };
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error updating allele:', error);
        res.status(500).json({ error: 'Failed to update allele' });
    }
});

// ============================================
// COMBINATION OPERATIONS
// ============================================

// POST /api/admin/genetics/:id/loci/:locusIndex/combinations - Add a combination to a locus
router.post('/genetics/:id/loci/:locusIndex/combinations', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex } = req.params;
        const { notation, phenotype, carrier, isLethal, geneType } = req.body;
        
        if (!notation) {
            return res.status(400).json({ error: 'Combination notation is required' });
        }
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const index = parseInt(locusIndex);
        if (index < 0 || index >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[index];
        if (!locus.combinations) locus.combinations = [];
        
        const newCombination = {
            notation: notation.trim(),
            phenotype: phenotype ? phenotype.trim() : null,
            carrier: carrier ? carrier.trim() : null,
            isLethal: isLethal === true,
            order: locus.combinations.length
        };
        
        locus.combinations.push(newCombination);
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.status(201).json(geneticsData);
    } catch (error) {
        console.error('Error adding combination:', error);
        res.status(500).json({ error: 'Failed to add combination' });
    }
});

// DELETE /api/admin/genetics/:id/loci/:locusIndex/combinations/:combinationIndex - Remove a combination
router.delete('/genetics/:id/loci/:locusIndex/combinations/:combinationIndex', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex, combinationIndex } = req.params;
        const { geneType } = req.query;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const locusIdx = parseInt(locusIndex);
        const combIdx = parseInt(combinationIndex);
        
        if (locusIdx < 0 || locusIdx >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[locusIdx];
        if (!locus.combinations || combIdx < 0 || combIdx >= locus.combinations.length) {
            return res.status(404).json({ error: 'Combination not found' });
        }
        
        locus.combinations.splice(combIdx, 1);
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error removing combination:', error);
        res.status(500).json({ error: 'Failed to remove combination' });
    }
});

// PUT /api/admin/genetics/:id/loci/:locusIndex/combinations/:combinationIndex - Edit a combination
router.put('/genetics/:id/loci/:locusIndex/combinations/:combinationIndex', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex, combinationIndex } = req.params;
        const { notation, phenotype, carrier, isLethal, geneType } = req.body;
        
        if (!notation) {
            return res.status(400).json({ error: 'Combination notation is required' });
        }
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const locusIdx = parseInt(locusIndex);
        const combIdx = parseInt(combinationIndex);
        
        if (locusIdx < 0 || locusIdx >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[locusIdx];
        if (!locus.combinations || combIdx < 0 || combIdx >= locus.combinations.length) {
            return res.status(404).json({ error: 'Combination not found' });
        }
        
        // Update combination
        locus.combinations[combIdx] = {
            ...locus.combinations[combIdx],
            notation: notation.trim(),
            phenotype: phenotype ? phenotype.trim() : null,
            carrier: carrier ? carrier.trim() : null,
            isLethal: isLethal === true
        };
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error updating combination:', error);
        res.status(500).json({ error: 'Failed to update combination' });
    }
});

// POST /api/admin/genetics/:id/loci/:locusIndex/generate-combinations - Auto-generate all combinations
router.post('/genetics/:id/loci/:locusIndex/generate-combinations', requireAdmin, async (req, res) => {
    try {
        const { id, locusIndex } = req.params;
        const { geneType } = req.body;
        
        const geneticsData = await GeneticsData.findById(id);
        if (!geneticsData) {
            return res.status(404).json({ error: 'Genetics data not found' });
        }
        
        if (geneticsData.isPublished) {
            return res.status(400).json({ error: 'Cannot edit published data' });
        }
        
        const geneArray = geneType === 'marking' 
            ? geneticsData.markingGenes
            : geneType === 'coat'
                ? geneticsData.coatGenes
                : geneType === 'other'
                    ? geneticsData.otherGenes
                    : geneticsData.genes;
        
        const index = parseInt(locusIndex);
        if (index < 0 || index >= geneArray.length) {
            return res.status(404).json({ error: 'Locus not found' });
        }
        
        const locus = geneArray[index];
        if (!locus.alleles || locus.alleles.length === 0) {
            return res.status(400).json({ error: 'No alleles defined for this locus' });
        }
        
        // Generate all possible combinations
        const combinations = [];
        for (let i = 0; i < locus.alleles.length; i++) {
            for (let j = i; j < locus.alleles.length; j++) {
                const allele1 = locus.alleles[i].symbol;
                const allele2 = locus.alleles[j].symbol;
                combinations.push({
                    notation: `${allele1}/${allele2}`,
                    phenotype: null,
                    carrier: null,
                    isLethal: false,
                    order: combinations.length
                });
            }
        }
        
        locus.combinations = combinations;
        
        geneticsData.lastEditedBy = req.user.userId;
        await geneticsData.save();
        
        res.json(geneticsData);
    } catch (error) {
        console.error('Error generating combinations:', error);
        res.status(500).json({ error: 'Failed to generate combinations' });
    }
});

module.exports = router;