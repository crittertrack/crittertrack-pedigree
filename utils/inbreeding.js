/**
 * Calculate the coefficient of inbreeding (COI) for an animal
 * Uses Wright's path coefficient method.
 *
 * Wright's formula: F = Σ (½)^(n1+n2+1) × (1+F_A)
 *   where n1/n2 = number of parent→child LINKS (steps) from each parent to
 *   the common ancestor, and F_A = inbreeding coefficient of that ancestor.
 *
 * Implementation note on path lengths:
 *   findPathsToAncestor() returns arrays that include BOTH the starting node
 *   AND the ancestor node, so path.length = (formula_n) + 1.
 *   Substituting: exponent = (n1_code-1) + (n2_code-1) + 1 = n1_code + n2_code - 1.
 *
 * @param {Number} animalId - The public ID of the animal
 * @param {Function} fetchAnimal - Function to fetch animal data by public ID
 * @param {Number} generations - Number of generations to trace back (default: 50)
 * @returns {Number} Inbreeding coefficient as a percentage (0-100)
 */
async function calculateInbreedingCoefficient(animalId, fetchAnimal, generations = 50) {
    if (!animalId) return 0;

    const pedigree = await buildPedigree(animalId, fetchAnimal, generations);
    const commonAncestors = findCommonAncestors(pedigree);

    if (commonAncestors.length === 0) return 0;

    let coi = 0;
    for (const ancestor of commonAncestors) {
        const pathsToSire = findPathsToAncestor(pedigree.sire, ancestor.id, []);
        const pathsToDam = findPathsToAncestor(pedigree.dam, ancestor.id, []);

        for (const sPath of pathsToSire) {
            for (const dPath of pathsToDam) {
                const n1 = sPath.length;
                const n2 = dPath.length;
                const fa = ancestor.inbreeding || 0;

                // Corrected exponent: n1 + n2 - 1 (accounts for path arrays
                // including the starting node, making each length = formula_n + 1)
                coi += Math.pow(0.5, n1 + n2 - 1) * (1 + fa);
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
 * Find all UNIQUE common ancestors between a pedigree's sire and dam lineages.
 *
 * Deduplication is required: if an ancestor appears via multiple paths in the
 * sire's lineage, getAllAncestors() returns it multiple times. Without dedup,
 * findCommonAncestors() would push the same ancestor N times, causing path
 * pairs to be summed N times (double/triple-counting).
 *
 * findPathsToAncestor() already returns ALL paths to a given ancestor ID, so
 * each unique ancestor only needs to be processed once.
 */
function findCommonAncestors(pedigree) {
    if (!pedigree || !pedigree.sire || !pedigree.dam) return [];

    const sireAncestors = getAllAncestors(pedigree.sire);
    const damAncestors = getAllAncestors(pedigree.dam);

    // Deduplicate sire ancestors by ID (an inbred sire has repeated entries)
    const seenSire = new Set();
    const uniqueSireAncestors = [];
    for (const anc of sireAncestors) {
        if (!seenSire.has(anc.id)) {
            seenSire.add(anc.id);
            uniqueSireAncestors.push(anc);
        }
    }

    // Build a Set of dam ancestor IDs for O(1) lookup
    const damAncestorIds = new Set(damAncestors.map(a => a.id));

    const common = [];
    for (const anc of uniqueSireAncestors) {
        if (damAncestorIds.has(anc.id)) {
            common.push(anc);
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
                
                coi += Math.pow(0.5, n1 + n2 - 1) * (1 + fa);
            }
        }
    }

    return parseFloat((coi * 100).toFixed(4));
}

/**
 * Diagnostic version of calculatePairingInbreeding.
 * Returns the total COI AND a per-ancestor breakdown showing exactly which
 * common ancestors contribute, which paths they use, and how much each adds.
 *
 * @returns {{ total: Number, breakdown: Array }}
 */
async function explainPairingInbreeding(sireId, damId, fetchAnimal, generations = 50) {
    if (!sireId || !damId) return { total: 0, breakdown: [] };

    const theoreticalPedigree = {
        id: 'theoretical',
        name: 'Theoretical Offspring',
        sire: await buildPedigree(sireId, fetchAnimal, generations),
        dam: await buildPedigree(damId, fetchAnimal, generations),
        inbreeding: 0
    };

    const commonAncestors = findCommonAncestors(theoreticalPedigree);
    if (commonAncestors.length === 0) return { total: 0, breakdown: [] };

    let totalCoi = 0;
    const breakdown = [];

    for (const ancestor of commonAncestors) {
        const pathsToSire = findPathsToAncestor(theoreticalPedigree.sire, ancestor.id, []);
        const pathsToDam  = findPathsToAncestor(theoreticalPedigree.dam,  ancestor.id, []);
        const fa = ancestor.inbreeding || 0;

        let ancestorContribution = 0;
        const pathPairs = [];

        for (const sPath of pathsToSire) {
            for (const dPath of pathsToDam) {
                const n1 = sPath.length;
                const n2 = dPath.length;
                const term = Math.pow(0.5, n1 + n2 - 1) * (1 + fa);
                ancestorContribution += term;
                pathPairs.push({
                    sirePath: sPath,
                    damPath: dPath,
                    n1_links: n1 - 1,   // formula-n (steps, not nodes)
                    n2_links: n2 - 1,
                    contribution_pct: parseFloat((term * 100).toFixed(4))
                });
            }
        }

        totalCoi += ancestorContribution;
        breakdown.push({
            ancestorId:   ancestor.id,
            ancestorName: ancestor.name,
            fa_pct:       parseFloat((fa * 100).toFixed(4)),
            contribution_pct: parseFloat((ancestorContribution * 100).toFixed(4)),
            pathPairs
        });
    }

    // Sort descending by contribution so biggest contributors show first
    breakdown.sort((a, b) => b.contribution_pct - a.contribution_pct);

    return {
        total: parseFloat((totalCoi * 100).toFixed(4)),
        breakdown
    };
}

    calculateInbreedingCoefficient,
    calculatePairingInbreeding,
    buildPedigree,
    explainPairingInbreeding
};
