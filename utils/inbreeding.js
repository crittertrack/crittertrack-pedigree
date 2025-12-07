/**
 * Calculate the coefficient of inbreeding (COI) for an animal
 * Uses Wright's method to calculate inbreeding based on common ancestors
 * 
 * @param {Number} animalId - The public ID of the animal
 * @param {Function} fetchAnimal - Function to fetch animal data by public ID
 * @param {Number} generations - Number of generations to trace back (default: 50, traces all available)
 * @returns {Number} Inbreeding coefficient as a percentage (0-100)
 */
async function calculateInbreedingCoefficient(animalId, fetchAnimal, generations = 50) {
    if (!animalId) return 0;

    // Build pedigree tree
    const pedigree = await buildPedigree(animalId, fetchAnimal, generations);
    
    // Find common ancestors
    const commonAncestors = findCommonAncestors(pedigree);
    
    if (commonAncestors.length === 0) return 0;

    // Calculate COI using Wright's formula
    let coi = 0;
    for (const ancestor of commonAncestors) {
        const pathsToSire = findPathsToAncestor(pedigree.sire, ancestor.id, []);
        const pathsToDam = findPathsToAncestor(pedigree.dam, ancestor.id, []);
        
        for (const sPath of pathsToSire) {
            for (const dPath of pathsToDam) {
                const n1 = sPath.length;
                const n2 = dPath.length;
                const fa = ancestor.inbreeding || 0;
                
                // Wright's formula: (1/2)^(n1+n2+1) * (1 + fa)
                coi += Math.pow(0.5, n1 + n2 + 1) * (1 + fa);
            }
        }
    }

    return parseFloat((coi * 100).toFixed(2));
}

/**
 * Build a pedigree tree recursively
 */
async function buildPedigree(animalId, fetchAnimal, depth, visited = new Set()) {
    if (!animalId || depth === 0) {
        return null;
    }

    // Allow duplicate animals in pedigree (needed for inbreeding calculation)
    // Only check visited within the current path to prevent infinite loops
    if (visited.has(animalId)) {
        // Return a reference node without further recursion to prevent infinite loops
        const animal = await fetchAnimal(animalId);
        return animal ? {
            id: animalId,
            name: animal.name,
            sire: null,
            dam: null,
            inbreeding: 0
        } : null;
    }

    const newVisited = new Set(visited);
    newVisited.add(animalId);

    const animal = await fetchAnimal(animalId);
    if (!animal) return null;

    const sireId = animal.sireId_public || animal.fatherId_public;
    const damId = animal.damId_public || animal.motherId_public;

    return {
        id: animalId,
        name: animal.name,
        sire: sireId ? await buildPedigree(sireId, fetchAnimal, depth - 1, newVisited) : null,
        dam: damId ? await buildPedigree(damId, fetchAnimal, depth - 1, newVisited) : null,
        inbreeding: 0 // Will be calculated recursively if needed
    };
}

/**
 * Find all common ancestors in sire and dam lineages
 */
function findCommonAncestors(pedigree) {
    if (!pedigree || !pedigree.sire || !pedigree.dam) return [];

    const sireAncestors = getAllAncestors(pedigree.sire);
    const damAncestors = getAllAncestors(pedigree.dam);

    const common = [];
    for (const sireAnc of sireAncestors) {
        const damAnc = damAncestors.find(d => d.id === sireAnc.id);
        if (damAnc) {
            common.push(sireAnc);
        }
    }

    return common;
}

/**
 * Get all ancestors from a pedigree node
 */
function getAllAncestors(node, ancestors = []) {
    if (!node) return ancestors;

    ancestors.push({ id: node.id, name: node.name, inbreeding: node.inbreeding });

    if (node.sire) getAllAncestors(node.sire, ancestors);
    if (node.dam) getAllAncestors(node.dam, ancestors);

    return ancestors;
}

/**
 * Find all paths from a node to a specific ancestor
 */
function findPathsToAncestor(node, ancestorId, currentPath) {
    if (!node) return [];

    const newPath = [...currentPath, node.id];

    if (node.id === ancestorId) {
        return [newPath];
    }

    const paths = [];
    
    if (node.sire) {
        paths.push(...findPathsToAncestor(node.sire, ancestorId, newPath));
    }
    
    if (node.dam) {
        paths.push(...findPathsToAncestor(node.dam, ancestorId, newPath));
    }

    return paths;
}

/**
 * Calculate COI for a theoretical pairing (litter)
 */
async function calculatePairingInbreeding(sireId, damId, fetchAnimal, generations = 5) {
    if (!sireId || !damId) return 0;

    // Create a theoretical offspring pedigree
    const theoreticalPedigree = {
        id: 'theoretical',
        name: 'Theoretical Offspring',
        sire: await buildPedigree(sireId, fetchAnimal, generations),
        dam: await buildPedigree(damId, fetchAnimal, generations),
        inbreeding: 0
    };

    const commonAncestors = findCommonAncestors(theoreticalPedigree);
    
    if (commonAncestors.length === 0) return 0;

    let coi = 0;
    for (const ancestor of commonAncestors) {
        const pathsToSire = findPathsToAncestor(theoreticalPedigree.sire, ancestor.id, []);
        const pathsToDam = findPathsToAncestor(theoreticalPedigree.dam, ancestor.id, []);
        
        for (const sPath of pathsToSire) {
            for (const dPath of pathsToDam) {
                const n1 = sPath.length;
                const n2 = dPath.length;
                const fa = ancestor.inbreeding || 0;
                
                coi += Math.pow(0.5, n1 + n2 + 1) * (1 + fa);
            }
        }
    }

    return parseFloat((coi * 100).toFixed(4));
}

module.exports = {
    calculateInbreedingCoefficient,
    calculatePairingInbreeding,
    buildPedigree
};
