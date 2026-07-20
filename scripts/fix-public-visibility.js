/**
 * API-based diagnostic script to identify and fix public animal sync issues
 * 
 * This can be run against a live server without needing environment setup
 * Usage: node scripts/fix-public-visibility.js [API_URL] [AUTH_TOKEN]
 */

const axios = require('axios');

async function diagnosePublicAnimalIssues(apiUrl, authToken) {
    try {
        console.log('Starting public animal visibility diagnostic...\n');

        // Get user's animals
        console.log('Fetching user\'s animals...');
        const response = await axios.get(`${apiUrl}/api/animals`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const animals = response.data;
        console.log(`Found ${animals.length} animals\n`);

        // ===== ANALYSIS =====
        console.log('=== DIAGNOSTIC ANALYSIS ===\n');

        const stats = {
            total: animals.length,
            isDisplayTrue: 0,
            showOnPublicTrue: 0,
            bothTrue: 0,
            bothFalse: 0,
            mismatched: [],
            publicWithPrivateParents: []
        };

        for (const animal of animals) {
            const isDisplay = !!animal.isDisplay;
            const showOnPublic = !!animal.showOnPublicProfile;

            if (isDisplay) stats.isDisplayTrue++;
            if (showOnPublic) stats.showOnPublicTrue++;
            if (isDisplay && showOnPublic) stats.bothTrue++;
            if (!isDisplay && !showOnPublic) stats.bothFalse++;

            if (isDisplay !== showOnPublic) {
                stats.mismatched.push({
                    id: animal.id_public,
                    name: animal.name,
                    isDisplay,
                    showOnPublic
                });
            }

            // Check if a public animal has private parents
            if (showOnPublic && (animal.sireId_public || animal.damId_public)) {
                const sireAnimal = animals.find(a => a.id_public === animal.sireId_public);
                const damAnimal = animals.find(a => a.id_public === animal.damId_public);

                if ((sireAnimal && !sireAnimal.showOnPublicProfile) || (damAnimal && !damAnimal.showOnPublicProfile)) {
                    stats.publicWithPrivateParents.push({
                        id: animal.id_public,
                        name: animal.name,
                        sire: animal.sireId_public,
                        sirePublic: sireAnimal?.showOnPublicProfile,
                        dam: animal.damId_public,
                        damPublic: damAnimal?.showOnPublicProfile
                    });
                }
            }
        }

        console.log('Flag Statistics:');
        console.log(`  isDisplay = true: ${stats.isDisplayTrue}`);
        console.log(`  showOnPublicProfile = true: ${stats.showOnPublicTrue}`);
        console.log(`  Both true (correct): ${stats.bothTrue}`);
        console.log(`  Both false (correct): ${stats.bothFalse}`);
        console.log(`  Mismatched: ${stats.mismatched.length}\n`);

        if (stats.mismatched.length > 0) {
            console.log('MISMATCHED ANIMALS (isDisplay !== showOnPublicProfile):');
            stats.mismatched.slice(0, 10).forEach(a => {
                console.log(`  ${a.id} "${a.name}": isDisplay=${a.isDisplay}, showOnPublicProfile=${a.showOnPublic}`);
            });
            if (stats.mismatched.length > 10) {
                console.log(`  ... and ${stats.mismatched.length - 10} more\n`);
            } else {
                console.log('');
            }
        }

        if (stats.publicWithPrivateParents.length > 0) {
            console.log('PUBLIC ANIMALS WITH PRIVATE PARENTS:');
            stats.publicWithPrivateParents.slice(0, 10).forEach(a => {
                console.log(`  ${a.id} "${a.name}"`);
                if (a.sire) console.log(`    Sire ${a.sire}: public=${a.sirePublic}`);
                if (a.dam) console.log(`    Dam ${a.dam}: public=${a.damPublic}`);
            });
            if (stats.publicWithPrivateParents.length > 10) {
                console.log(`  ... and ${stats.publicWithPrivateParents.length - 10} more\n`);
            } else {
                console.log('');
            }
        }

        // ===== RECOMMENDATIONS =====
        console.log('=== RECOMMENDATIONS ===\n');

        if (stats.mismatched.length > 0) {
            console.log(`⚠️  Found ${stats.mismatched.length} animals with mismatched flags.`);
            console.log('   To fix, update these animals to sync their flags:');
            console.log('   isDisplay should equal showOnPublicProfile\n');
        }

        if (stats.publicWithPrivateParents.length > 0) {
            console.log(`⚠️  Found ${stats.publicWithPrivateParents.length} public animals with private parents.`);
            console.log('   This causes parents to not show in pedigree views.');
            console.log('   To fix: set parent animals to public as well.\n');
        }

        if (stats.mismatched.length === 0 && stats.publicWithPrivateParents.length === 0) {
            console.log('✓ No issues detected! All animals are correctly configured.\n');
        }

        return { animals, stats };

    } catch (error) {
        console.error('Error during diagnostic:', error.message);
        if (error.response?.data) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node scripts/fix-public-visibility.js <API_URL> <AUTH_TOKEN>\n');
    console.log('Example:');
    console.log('  node scripts/fix-public-visibility.js http://localhost:5000 "eyJhbGc..."\n');
    console.log('To get your auth token:');
    console.log('  1. Open DevTools (F12) in your browser');
    console.log('  2. Go to Application tab > Local Storage');
    console.log('  3. Find the token for your domain');
    process.exit(1);
}

const [apiUrl, authToken] = args;
diagnosePublicAnimalIssues(apiUrl, authToken).then(result => {
    console.log('Diagnostic complete.');
});
