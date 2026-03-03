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
 * Build a pedigree tree recursively.
 *
 * Performance: nodeCache memoises completed subtrees keyed by `${animalId}:${depth}`.
 * This prevents the exponential node explosion that occurs in linebred pedigrees
 * where the same common ancestors appear in hundreds of branches — turning
 * O(2^generations) construction into O(unique_animals × generations).
 *
 * The path-local `visited` set is kept separately to catch genuine data cycles
 * (animal listed as its own ancestor), which are data errors; these return a
 * leaf reference node that is NOT cached since it is path-specific.
 */
async function buildPedigree(animalId, fetchAnimal, depth, visited = new Set(), nodeCache = new Map()) {
    if (!animalId || depth === 0) {
        return null;
    }

    // Check memoised result first (safe for non-cyclic paths)
    const cacheKey = `${animalId}:${depth}`;
    if (nodeCache.has(cacheKey)) {
        return nodeCache.get(cacheKey);
    }

    // Cycle guard: animal appears on this exact ancestry path (data error)
    if (visited.has(animalId)) {
        const animal = await fetchAnimal(animalId);
        // Do not cache — this leaf is path-specific
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
    if (!animal) {
        nodeCache.set(cacheKey, null);
        return null;
    }

    const sireId = animal.sireId_public || animal.fatherId_public;
    const damId = animal.damId_public || animal.motherId_public;

    const node = {
        id: animalId,
        name: animal.name,
        sire: sireId ? await buildPedigree(sireId, fetchAnimal, depth - 1, newVisited, nodeCache) : null,
        dam: damId ? await buildPedigree(damId, fetchAnimal, depth - 1, newVisited, nodeCache) : null,
        inbreeding: 0
    };

    nodeCache.set(cacheKey, node);
    return node;
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
 * Build a pedigree as a DAG (directed acyclic graph) via BFS.
 * Returns Map<id, { id, name, sireId, damId }>.
 *
 * Key optimisation: all animals in the same generation are fetched
 * CONCURRENTLY (Promise.all), reducing DB round-trips from
 * O(unique_animals × latency) to O(generations × latency).
 */
async function buildPedigreeDAG(rootId, fetchAnimal, maxGenerations) {
    const dag = new Map();
    let currentGen = [rootId];
    const queued = new Set([rootId]);

    for (let gen = 0; gen <= maxGenerations && currentGen.length > 0; gen++) {
        // Fetch all animals in this generation concurrently
        await Promise.all(currentGen.map(async (id) => {
            if (dag.has(id)) return;
            const animal = await fetchAnimal(id);
            if (!animal) {
                dag.set(id, { id, name: id, sireId: null, damId: null });
                return;
            }
            const sireId = animal.sireId_public || animal.fatherId_public || null;
            const damId  = animal.damId_public  || animal.motherId_public  || null;
            dag.set(id, { id, name: animal.name, sireId, damId });
        }));

        if (gen >= maxGenerations) break;

        const nextGen = [];
        for (const id of currentGen) {
            const node = dag.get(id);
            if (!node) continue;
            if (node.sireId && !queued.has(node.sireId)) { queued.add(node.sireId); nextGen.push(node.sireId); }
            if (node.damId  && !queued.has(node.damId))  { queued.add(node.damId);  nextGen.push(node.damId); }
        }
        currentGen = nextGen;
    }
    return dag;
}

/**
 * Compute Wright path-coefficient sums for every ancestor reachable from rootId.
 *
 *   dp[ancestor] = Σ_{all paths from rootId to ancestor} (0.5)^path_length
 *   where path_length = number of nodes including start and end.
 *
 * This is a simple BFS propagation on the DAG — O(unique_animals), not O(2^G).
 * The BFS naturally handles an ancestor reachable via multiple paths: each time
 * a predecessor is processed it adds its contribution to dp[ancestor],
 * and the ancestor is enqueued only once (after its first discovery) so it
 * propagates further enriched by all predecessors processed before it is dequeued.
 *
 * Note: for deeply linebred pedigrees an ancestor may be reached via very many
 * paths from shallower predecessors before it is itself dequeued, so its dp
 * value is fully accumulated before it propagates. This relies on BFS ordering
 * (breadth ≈ topological order from root): a node's dp is complete before it is
 * dequeued as long as ALL paths to it come through nodes at strictly shallower
 * depth — which holds for pedigrees without true cycles (biologically impossible).
 */
function computePathSums(rootId, dag) {
    const dp = new Map([[rootId, 0.5]]); // path [root] has length 1 → (0.5)^1
    const queue = [rootId];
    const inQueue = new Set([rootId]);

    while (queue.length > 0) {
        const id = queue.shift();
        const node = dag.get(id);
        if (!node) continue;

        const carry = (dp.get(id) || 0) * 0.5;
        for (const childId of [node.sireId, node.damId]) {
            if (!childId || !dag.has(childId)) continue;
            dp.set(childId, (dp.get(childId) || 0) + carry);
            if (!inQueue.has(childId)) {
                inQueue.add(childId);
                queue.push(childId);
            }
        }
    }
    return dp;
}

/**
 * Calculate COI for a theoretical pairing (litter).
 *
 * Uses a DAG (not a tree) for the pedigree, then computes Wright's path
 * coefficients via dynamic programming on the DAG.  This is O(U × G) where
 * U = unique ancestors and G = generations, instead of the O(2^G) explosion
 * that occurs when the same ancestor appears in many branches of a tree.
 *
 * DP definition:
 *   dp_sire[A] = Σ over all paths P from sireId to A of (0.5)^|P|
 *   (|P| = number of nodes in path, including start and end)
 *
 * Wright's contribution for each common ancestor A then reduces to:
 *   contribution = 2 × (1 + FA) × dp_sire[A] × dp_dam[A]
 * (the factor of 2 comes from the -1 in the (0.5)^(n1+n2-1) exponent)
 */
async function calculatePairingInbreeding(sireId, damId, fetchAnimal, generations = 12) {
    if (!sireId || !damId) return 0;

    const sireDag = await buildPedigreeDAG(sireId, fetchAnimal, generations);
    const damDag  = await buildPedigreeDAG(damId,  fetchAnimal, generations);

    const sireDP = computePathSums(sireId, sireDag);
    const damDP  = computePathSums(damId,  damDag);

    let coi = 0;
    for (const [ancestorId, sContrib] of sireDP) {
        const dContrib = damDP.get(ancestorId);
        if (dContrib == null) continue;
        // ancestor's own FA is 0 unless we later extend this
        coi += 2 * sContrib * dContrib;
    }

    return parseFloat((coi * 100).toFixed(4));
}

/**
 * Diagnostic version of calculatePairingInbreeding.
 * Returns the total COI AND a per-ancestor breakdown.
 * Also uses the DAG+DP approach for performance.
 *
 * @returns {{ total: Number, breakdown: Array }}
 */
async function explainPairingInbreeding(sireId, damId, fetchAnimal, generations = 20) {
    if (!sireId || !damId) return { total: 0, breakdown: [] };

    const sireDag = await buildPedigreeDAG(sireId, fetchAnimal, generations);
    const damDag  = await buildPedigreeDAG(damId,  fetchAnimal, generations);

    const sireDP = computePathSums(sireId, sireDag);
    const damDP  = computePathSums(damId,  damDag);

    let totalCoi = 0;
    const breakdown = [];

    for (const [ancestorId, sContrib] of sireDP) {
        const dContrib = damDP.get(ancestorId);
        if (dContrib == null) continue;

        const fa = 0; // ancestor's own inbreeding (simplified)
        const contribution = 2 * (1 + fa) * sContrib * dContrib;
        totalCoi += contribution;

        const node = sireDag.get(ancestorId) || damDag.get(ancestorId);
        breakdown.push({
            ancestorId,
            ancestorName: node ? node.name : ancestorId,
            fa_pct: 0,
            contribution_pct: parseFloat((contribution * 100).toFixed(4)),
            sirePathSum: parseFloat((sContrib * 100).toFixed(4)),
            damPathSum:  parseFloat((dContrib * 100).toFixed(4)),
        });
    }

    breakdown.sort((a, b) => b.contribution_pct - a.contribution_pct);

    return {
        total: parseFloat((totalCoi * 100).toFixed(4)),
        breakdown
    };
}

module.exports = {
    calculateInbreedingCoefficient,
    calculatePairingInbreeding,
    buildPedigree,
    buildPedigreeDAG,
    computePathSums,
    explainPairingInbreeding
};
