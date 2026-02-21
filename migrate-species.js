/**
 * Species Migration Script
 *
 * Seeds all default species records, assigns each to the correct FieldTemplate,
 * and updates any legacy species entries (Mouse, Rat, Hamster) with their
 * proper template assignments.
 *
 * Run with: node migrate-species.js
 * Safe to re-run — uses upsert so it won't create duplicates.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

const { FieldTemplate, Species } = require('./database/models');

// ============================================================
// SPECIES DEFINITIONS
// Format: { name, latinName, category, templateName }
// templateName must exactly match a template's 'name' field in DB
// ============================================================

const speciesList = [

    // ── SMALL MAMMAL TEMPLATE ────────────────────────────────
    { name: 'Fancy Mouse',              latinName: 'Mus musculus',              category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Fancy Rat',                latinName: 'Rattus norvegicus',         category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Syrian Hamster',           latinName: 'Mesocricetus auratus',      category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Russian Dwarf Hamster',    latinName: 'Phodopus sungorus',         category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Campbells Dwarf Hamster',  latinName: 'Phodopus campbelli',        category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Chinese Dwarf Hamster',    latinName: 'Cricetulus griseus',        category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Roborovski Dwarf Hamster', latinName: 'Phodopus roborovskii',      category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Guinea Pig',               latinName: 'Cavia porcellus',           category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Gerbil',                   latinName: 'Meriones unguiculatus',     category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Degu',                     latinName: 'Octodon degus',             category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Chinchilla',               latinName: 'Chinchilla lanigera',       category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'African Pygmy Mouse',      latinName: 'Mus minutoides',            category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'African Pygmy Dormouse',   latinName: 'Graphiurus murinus',        category: 'Mammal', templateName: 'Small Mammal Template' },

    // ── FULL MAMMAL TEMPLATE ─────────────────────────────────
    { name: 'Rabbit',                   latinName: 'Oryctolagus cuniculus',     category: 'Mammal', templateName: 'Full Mammal Template' },
    { name: 'Ferret',                   latinName: 'Mustela putorius furo',     category: 'Mammal', templateName: 'Full Mammal Template' },
    { name: 'Hedgehog',                 latinName: 'Atelerix albiventris',      category: 'Mammal', templateName: 'Full Mammal Template' },
    { name: 'Sugar Glider',             latinName: 'Petaurus breviceps',        category: 'Mammal', templateName: 'Full Mammal Template' },
    { name: 'Prairie Dog',              latinName: 'Cynomys ludovicianus',      category: 'Mammal', templateName: 'Full Mammal Template' },
    { name: 'Domestic Cat',             latinName: 'Felis catus',               category: 'Mammal', templateName: 'Full Mammal Template' },
    { name: 'Domestic Dog',             latinName: 'Canis lupus familiaris',    category: 'Mammal', templateName: 'Full Mammal Template' },

    // ── REPTILE TEMPLATE ─────────────────────────────────────
    { name: 'Leopard Gecko',            latinName: 'Eublepharis macularius',    category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Crested Gecko',            latinName: 'Correlophus ciliatus',      category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Gargoyle Gecko',           latinName: 'Rhacodactylus auriculatus', category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Bearded Dragon',           latinName: 'Pogona vitticeps',          category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Blue-Tongued Skink',       latinName: 'Tiliqua scincoides',        category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Ball Python',              latinName: 'Python regius',             category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Corn Snake',               latinName: 'Pantherophis guttatus',     category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Cape African House Snake', latinName: 'Boaedon capensis',          category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Chameleon',                latinName: 'Chamaeleo sp.',             category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Red-Eared Slider',         latinName: 'Trachemys scripta elegans', category: 'Reptile', templateName: 'Reptile Template' },
    { name: 'Russian Tortoise',         latinName: 'Testudo horsfieldii',       category: 'Reptile', templateName: 'Reptile Template' },

    // ── BIRD TEMPLATE ────────────────────────────────────────
    { name: 'Budgerigar',               latinName: 'Melopsittacus undulatus',   category: 'Bird', templateName: 'Bird Template' },
    { name: 'Cockatiel',                latinName: 'Nymphicus hollandicus',     category: 'Bird', templateName: 'Bird Template' },
    { name: 'Lovebird',                 latinName: 'Agapornis sp.',             category: 'Bird', templateName: 'Bird Template' },
    { name: 'Canary',                   latinName: 'Serinus canaria',           category: 'Bird', templateName: 'Bird Template' },
    { name: 'Zebra Finch',              latinName: 'Taeniopygia guttata',       category: 'Bird', templateName: 'Bird Template' },
    { name: 'Conure',                   latinName: 'Pyrrhura / Psittacara sp.', category: 'Bird', templateName: 'Bird Template' },
    { name: 'African Grey Parrot',      latinName: 'Psittacus erithacus',       category: 'Bird', templateName: 'Bird Template' },
    { name: 'Macaw',                    latinName: 'Ara sp.',                   category: 'Bird', templateName: 'Bird Template' },
    { name: 'Cockatoo',                 latinName: 'Cacatua sp.',               category: 'Bird', templateName: 'Bird Template' },
    { name: 'Dove',                     latinName: 'Streptopelia sp.',          category: 'Bird', templateName: 'Bird Template' },

    // ── AMPHIBIAN TEMPLATE ───────────────────────────────────
    { name: 'Axolotl',                  latinName: 'Ambystoma mexicanum',       category: 'Amphibian', templateName: 'Amphibian Template' },
    { name: 'Pacman Frog',              latinName: 'Ceratophrys ornata',        category: 'Amphibian', templateName: 'Amphibian Template' },
    { name: 'Dart Poison Frog',         latinName: 'Dendrobatidae sp.',         category: 'Amphibian', templateName: 'Amphibian Template' },
    { name: "White's Tree Frog",        latinName: 'Ranoidea caerulea',         category: 'Amphibian', templateName: 'Amphibian Template' },
    { name: 'Fire-Bellied Toad',        latinName: 'Bombina sp.',               category: 'Amphibian', templateName: 'Amphibian Template' },
    { name: 'Tomato Frog',              latinName: 'Dyscophus antongilii',      category: 'Amphibian', templateName: 'Amphibian Template' },
    { name: 'Tiger Salamander',         latinName: 'Ambystoma tigrinum',        category: 'Amphibian', templateName: 'Amphibian Template' },

    // ── FISH TEMPLATE ────────────────────────────────────────
    { name: 'Betta Fish',               latinName: 'Betta splendens',           category: 'Fish', templateName: 'Fish Template' },
    { name: 'Fancy Goldfish',           latinName: 'Carassius auratus',         category: 'Fish', templateName: 'Fish Template' },
    { name: 'Koi',                      latinName: 'Cyprinus rubrofuscus',      category: 'Fish', templateName: 'Fish Template' },
    { name: 'Guppy',                    latinName: 'Poecilia reticulata',       category: 'Fish', templateName: 'Fish Template' },
    { name: 'Platy',                    latinName: 'Xiphophorus maculatus',     category: 'Fish', templateName: 'Fish Template' },
    { name: 'Discus',                   latinName: 'Symphysodon sp.',           category: 'Fish', templateName: 'Fish Template' },
    { name: 'Angelfish',                latinName: 'Pterophyllum scalare',      category: 'Fish', templateName: 'Fish Template' },
    { name: 'Corydoras',                latinName: 'Corydoras sp.',             category: 'Fish', templateName: 'Fish Template' },
    { name: 'Oscar',                    latinName: 'Astronotus ocellatus',      category: 'Fish', templateName: 'Fish Template' },

    // ── INVERTEBRATE TEMPLATE ────────────────────────────────
    { name: 'Tarantula',                latinName: 'Theraphosidae sp.',                 category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Jumping Spider',           latinName: 'Salticidae sp.',                    category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Scorpion',                 latinName: 'Scorpiones sp.',                    category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Giant African Millipede',  latinName: 'Archispirostreptus gigas',          category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Praying Mantis',           latinName: 'Mantodea sp.',                      category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Hissing Cockroach',        latinName: 'Gromphadorhina portentosa',         category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Stick Insect',             latinName: 'Phasmatodea sp.',                   category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Hermit Crab',              latinName: 'Coenobita sp.',                     category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Land Snail',               latinName: 'Achatina sp.',                      category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Honey Bee',                latinName: 'Apis mellifera',                    category: 'Invertebrate', templateName: 'Invertebrate Template' },
    { name: 'Bumble Bee',               latinName: 'Bombus sp.',                        category: 'Invertebrate', templateName: 'Invertebrate Template' },

    // ── OTHER TEMPLATE ───────────────────────────────────────
    { name: 'Other',                    latinName: null,                        category: 'Other', templateName: 'Other Template' },
];

// Legacy names that exist in older DBs — assign correct template, don't rename
const legacySpecies = [
    { name: 'Mouse',   category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Rat',     category: 'Mammal', templateName: 'Small Mammal Template' },
    { name: 'Hamster', category: 'Mammal', templateName: 'Small Mammal Template' },
];

// ============================================================

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully.\n');

        // ── 1. Load all templates into a lookup map ───────────
        const templates = await FieldTemplate.find({});
        const templateMap = {};
        templates.forEach(t => { templateMap[t.name] = t._id; });

        console.log(`Found ${templates.length} field templates:`);
        templates.forEach(t => console.log(`  • ${t.name} (${t._id})`));
        console.log();

        const results = { created: [], updated: [], skipped: [], errors: [] };

        // ── 2. Upsert main species list ───────────────────────
        console.log('========================================');
        console.log('SEEDING DEFAULT SPECIES');
        console.log('========================================\n');

        for (const s of speciesList) {
            try {
                const templateId = templateMap[s.templateName];
                if (!templateId) {
                    console.warn(`  ⚠️  Template not found for "${s.name}": ${s.templateName}`);
                    results.errors.push({ name: s.name, error: `Template "${s.templateName}" not found in DB` });
                    continue;
                }

                const existing = await Species.findOne({ name: s.name });

                if (existing) {
                    const changed =
                        existing.category !== s.category ||
                        existing.latinName !== s.latinName ||
                        String(existing.fieldTemplateId) !== String(templateId) ||
                        existing.isDefault !== true;

                    if (changed) {
                        existing.category = s.category;
                        existing.latinName = s.latinName ?? null;
                        existing.fieldTemplateId = templateId;
                        existing.isDefault = true;
                        await existing.save();
                        results.updated.push(s.name);
                        console.log(`  📝 Updated:  ${s.name}`);
                    } else {
                        results.skipped.push(s.name);
                        console.log(`  ✅ Unchanged: ${s.name}`);
                    }
                } else {
                    await Species.create({
                        name: s.name,
                        latinName: s.latinName ?? null,
                        category: s.category,
                        fieldTemplateId: templateId,
                        isDefault: true,
                    });
                    results.created.push(s.name);
                    console.log(`  ✨ Created:  ${s.name}`);
                }
            } catch (err) {
                console.error(`  ❌ Error on "${s.name}":`, err.message);
                results.errors.push({ name: s.name, error: err.message });
            }
        }

        // ── 3. Patch legacy species (don't rename, just update template) ──
        console.log('\n========================================');
        console.log('PATCHING LEGACY SPECIES');
        console.log('========================================\n');

        for (const s of legacySpecies) {
            try {
                const templateId = templateMap[s.templateName];
                if (!templateId) continue;

                const existing = await Species.findOne({ name: s.name });
                if (!existing) {
                    console.log(`  ⏭️  Not in DB (skipping): ${s.name}`);
                    continue;
                }

                const needsUpdate = !existing.fieldTemplateId ||
                    String(existing.fieldTemplateId) !== String(templateId) ||
                    existing.category !== s.category;

                if (needsUpdate) {
                    existing.fieldTemplateId = templateId;
                    existing.category = s.category;
                    await existing.save();
                    console.log(`  📝 Patched legacy: ${s.name} → ${s.templateName}`);
                    results.updated.push(`${s.name} (legacy)`);
                } else {
                    console.log(`  ✅ Legacy already OK: ${s.name}`);
                    results.skipped.push(`${s.name} (legacy)`);
                }
            } catch (err) {
                console.error(`  ❌ Error on legacy "${s.name}":`, err.message);
                results.errors.push({ name: s.name, error: err.message });
            }
        }

        // ── 4. Summary ────────────────────────────────────────
        console.log('\n========================================');
        console.log('MIGRATION SUMMARY');
        console.log('========================================\n');
        console.log(`✨ Created:   ${results.created.length}`);
        results.created.forEach(n => console.log(`   - ${n}`));
        console.log(`\n📝 Updated:   ${results.updated.length}`);
        results.updated.forEach(n => console.log(`   - ${n}`));
        console.log(`\n✅ Unchanged: ${results.skipped.length}`);
        console.log(`\n❌ Errors:    ${results.errors.length}`);
        results.errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));

        const total = results.created.length + results.updated.length + results.skipped.length;
        console.log(`\nTotal processed: ${total} species\n`);

        await mongoose.disconnect();
        console.log('Disconnected from database.');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ MIGRATION FAILED:', err);
        try { await mongoose.disconnect(); } catch (_) {}
        process.exit(1);
    }
}

migrate();
