/**
 * seed-ctu1-calendar-demo.js
 * 
 * Seeds demo Fancy Mouse animals + management data for CTU1 so all 9
 * calendar event types are visible on the Calendar page for styling review.
 * 
 * Usage:
 *   node scripts/seed-ctu1-calendar-demo.js
 * 
 * Reads MONGODB_URI and CTU1_ID_PUBLIC from .env
 * CTU1_ID_PUBLIC should be the id_public of the CTU1 account (e.g. "CTU1")
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal, Litter, SupplyItem, Enclosure, User } = require('../database/models');

const CTU1_ID_PUBLIC = process.env.CTU1_ID_PUBLIC || 'CTU1';

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not set');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const owner = await User.findOne({ id_public: CTU1_ID_PUBLIC }).select('_id id_public').lean();
    if (!owner) throw new Error(`User ${CTU1_ID_PUBLIC} not found`);
    const ownerId = owner._id;
    const ownerId_public = owner.id_public;
    console.log(`Seeding for user: ${ownerId_public} (${ownerId})`);

    // Helpers
    const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d; };
    const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0,0,0,0); return d; };

    // --- 1. Animals ---
    const animalDefs = [
        {
            name: 'Biscuit',
            prefix: '[Demo]',
            suffix: 'of CTU1',
            gender: 'Male',
            birthDate: new Date('2025-04-29'), // birthday TODAY → 🎂 birthday event
            species: 'Fancy Mouse',
            phenotype: 'PEW (Pink-Eyed White)',
            isOwned: true,
            dietType: 'Pellets + Seed Mix',
            // feeding due in 2 days (fed 5 days ago, every 7 days)
            lastFedDate: daysAgo(5),
            feedingFrequencyDays: 7,
            // maintenance due in 3 days
            lastMaintenanceDate: daysAgo(11),
            maintenanceFrequencyDays: 14,
            careTasks: [
                { taskName: 'Enclosure Spot Clean', lastDoneDate: daysAgo(13), frequencyDays: 14 },
            ],
            animalCareTasks: [
                { taskName: 'Weight Check', lastDoneDate: daysAgo(20), frequencyDays: 21 },
            ],
            // Health tab demo data
            weight: '28g',
            measurementUnits: { weight: 'g', length: 'cm' },
            growthRecords: [
                { id: 'gr1', date: daysAgo(90).toISOString().split('T')[0], weight: '22g', length: null, bcs: '3', notes: 'Initial weigh-in' },
                { id: 'gr2', date: daysAgo(60).toISOString().split('T')[0], weight: '25g', length: null, bcs: '3', notes: 'On track' },
                { id: 'gr3', date: daysAgo(30).toISOString().split('T')[0], weight: '27g', length: null, bcs: '4', notes: 'Good condition' },
                { id: 'gr4', date: daysAgo(7).toISOString().split('T')[0],  weight: '28g', length: null, bcs: '4', notes: 'Stable' },
            ],
            vaccinations: 'Myxomatosis booster — 2025-11-01',
            healthStatus: 'Healthy',
            // Reproduction tab demo — In Mating
            isInMating: true,
        },
        {
            name: 'Maple',
            prefix: '[Demo]',
            suffix: 'of CTU1',
            gender: 'Female',
            birthDate: new Date('2025-06-15'), // birthday in ~47 days
            species: 'Fancy Mouse',
            phenotype: 'Agouti',
            isOwned: true,
            feedingSchedule: 'Daily PM',
            lastFedDate: daysAgo(3),
            feedingFrequencyDays: 7,
            lastMaintenanceDate: daysAgo(12),
            maintenanceFrequencyDays: 14,
            careTasks: [
                { taskName: 'Nest Material Refresh', lastDoneDate: daysAgo(9), frequencyDays: 10 },
            ],
            animalCareTasks: [
                { taskName: 'Nail Trim', lastDoneDate: daysAgo(26), frequencyDays: 30 },
                { taskName: 'Health Check', lastDoneDate: daysAgo(85), frequencyDays: 90 },
            ],
            // Health tab demo data
            weight: '24g',
            measurementUnits: { weight: 'g', length: 'cm' },
            growthRecords: [
                { id: 'gr1', date: daysAgo(120).toISOString().split('T')[0], weight: '18g', length: null, bcs: '3', notes: 'Post-weaning' },
                { id: 'gr2', date: daysAgo(90).toISOString().split('T')[0],  weight: '20g', length: null, bcs: '3', notes: '' },
                { id: 'gr3', date: daysAgo(60).toISOString().split('T')[0],  weight: '22g', length: null, bcs: '3', notes: 'Slight dip — monitored' },
                { id: 'gr4', date: daysAgo(30).toISOString().split('T')[0],  weight: '23g', length: null, bcs: '3', notes: 'Recovering well' },
                { id: 'gr5', date: daysAgo(7).toISOString().split('T')[0],   weight: '24g', length: null, bcs: '3', notes: 'Back to normal' },
            ],
            vaccinations: 'Up to date — Myxo 2025-10-15',
            dewormingRecords: 'Panacur 2025-09-01',
            healthStatus: 'Healthy',
            // Reproduction tab demo — Pregnant
            isPregnant: true,
        },
        {
            name: 'Toast',
            prefix: '[Demo]',
            suffix: 'of CTU1',
            gender: 'Male',
            birthDate: new Date('2025-05-10'), // birthday ~11 days from now
            species: 'Fancy Mouse',
            phenotype: 'Black Hooded',
            isOwned: true,
            dietType: 'Lab Blocks',
            lastFedDate: daysAgo(6),
            feedingFrequencyDays: 7,
            lastMaintenanceDate: daysAgo(9),
            maintenanceFrequencyDays: 14,
            careTasks: [
                { taskName: 'Wheel Sanitization', lastDoneDate: daysAgo(6), frequencyDays: 7 },
            ],
            // Health tab demo — Quarantine / Isolation
            isQuarantine: true,
            healthStatus: 'Under observation — new intake isolation',
            weight: '26g',
            measurementUnits: { weight: 'g', length: 'cm' },
            growthRecords: [
                { id: 'gr1', date: daysAgo(3).toISOString().split('T')[0], weight: '26g', length: null, bcs: '3', notes: 'Quarantine intake weigh-in' },
            ],
        },
        {
            name: 'Clover',
            prefix: '[Demo]',
            suffix: 'of CTU1',
            gender: 'Female',
            birthDate: new Date('2025-07-02'), // birthday in ~64 days
            species: 'Fancy Mouse',
            phenotype: 'Broken Blue',
            isOwned: true,
            feedingSchedule: 'Every 2 Days',
            lastFedDate: daysAgo(1),
            feedingFrequencyDays: 7,
            lastMaintenanceDate: daysAgo(7),
            maintenanceFrequencyDays: 14,
            careTasks: [
                { taskName: 'Toy Rotation', lastDoneDate: daysAgo(13), frequencyDays: 14 },
            ],
            animalCareTasks: [
                { taskName: 'Condition Score', lastDoneDate: daysAgo(28), frequencyDays: 30 },
            ],
            // Reproduction tab demo — Nursing
            isNursing: true,
            medicalConditions: null,
            medications: null,
            chronicConditions: null,
            healthStatus: 'Nursing',
            weight: '21g',
            measurementUnits: { weight: 'g', length: 'cm' },
            growthRecords: [
                { id: 'gr1', date: daysAgo(45).toISOString().split('T')[0], weight: '23g', length: null, bcs: '3', notes: '' },
                { id: 'gr2', date: daysAgo(7).toISOString().split('T')[0],  weight: '21g', length: null, bcs: '3', notes: 'Post-partum — nursing litter' },
            ],
        },
        {
            name: 'Hazel',
            prefix: '[Demo]',
            suffix: 'of CTU1',
            gender: 'Female',
            birthDate: new Date('2025-08-10'),
            species: 'Fancy Mouse',
            phenotype: 'Sable',
            isOwned: true,
            feedingSchedule: 'Daily',
            lastFedDate: daysAgo(2),
            feedingFrequencyDays: 7,
            lastMaintenanceDate: daysAgo(5),
            maintenanceFrequencyDays: 14,
            careTasks: [],
            animalCareTasks: [],
            // Health tab demo — Under Treatment
            medicalConditions: JSON.stringify([
                { name: 'Respiratory infection', notes: 'Mild URI, started treatment 2025-04-28' },
            ]),
            medications: JSON.stringify([
                { name: 'Baytril (Enrofloxacin)', notes: '0.1ml PO BID × 10 days, started 2025-04-28' },
                { name: 'Nebulisation (saline)', notes: 'Daily 5 min sessions' },
            ]),
            chronicConditions: null,
            healthStatus: 'Under treatment — URI',
            weight: '21g',
            measurementUnits: { weight: 'g', length: 'cm' },
            growthRecords: [
                { id: 'gr1', date: daysAgo(14).toISOString().split('T')[0], weight: '22g', length: null, bcs: '2', notes: 'Weight dip — URI onset' },
                { id: 'gr2', date: daysAgo(3).toISOString().split('T')[0],  weight: '21g', length: null, bcs: '2', notes: 'Day 5 of Baytril — monitoring' },
            ],
        },
    ];

    const createdAnimals = [];
    for (const def of animalDefs) {
        // Check if already exists
        const existing = await Animal.findOne({ name: def.name, ownerId, species: def.species }).lean();
        if (existing) {
            await Animal.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        prefix: def.prefix,
                        suffix: def.suffix,
                        dietType: def.dietType || null,
                        feedingSchedule: def.feedingSchedule || null,
                        lastFedDate: def.lastFedDate,
                        feedingFrequencyDays: def.feedingFrequencyDays,
                        lastMaintenanceDate: def.lastMaintenanceDate,
                        maintenanceFrequencyDays: def.maintenanceFrequencyDays,
                        careTasks: def.careTasks || [],
                        animalCareTasks: def.animalCareTasks || [],
                        // Health fields
                        ...(def.weight        !== undefined && { weight: def.weight }),
                        ...(def.growthRecords !== undefined && { growthRecords: def.growthRecords }),
                        ...(def.measurementUnits !== undefined && { measurementUnits: def.measurementUnits }),
                        ...(def.healthStatus  !== undefined && { healthStatus: def.healthStatus }),
                        ...(def.vaccinations  !== undefined && { vaccinations: def.vaccinations }),
                        ...(def.dewormingRecords !== undefined && { dewormingRecords: def.dewormingRecords }),
                        ...(def.isQuarantine  !== undefined && { isQuarantine: def.isQuarantine }),
                        ...(def.isInMating     !== undefined && { isInMating: def.isInMating }),
                        ...(def.isPregnant     !== undefined && { isPregnant: def.isPregnant }),
                        ...(def.isNursing      !== undefined && { isNursing: def.isNursing }),
                        ...(def.medicalConditions !== undefined && { medicalConditions: def.medicalConditions }),
                        ...(def.medications   !== undefined && { medications: def.medications }),
                        ...(def.chronicConditions !== undefined && { chronicConditions: def.chronicConditions }),
                    },
                }
            );
            const refreshed = await Animal.findById(existing._id).lean();
            console.log(`  Animal "${def.name}" exists (${existing.id_public}), fields refreshed for calendar demo`);
            createdAnimals.push(refreshed || existing);
            continue;
        }

        // Generate a unique id_public — find the global highest CTC number via aggregation
        const agg = await Animal.aggregate([
            { $match: { id_public: /^CTC\d+$/ } },
            { $project: { num: { $toInt: { $substr: ['$id_public', 3, -1] } } } },
            { $sort: { num: -1 } },
            { $limit: 1 },
        ]);
        const lastNum = agg.length ? agg[0].num : 1000;
        // keep trying until we find one that doesn't exist
        let id_public, attempts = 0;
        do {
            id_public = `CTC${String(lastNum + 1 + attempts).padStart(4,'0')}`;
            const clash = await Animal.findOne({ id_public }).select('_id').lean();
            if (!clash) break;
            attempts++;
        } while (attempts < 50);

        const animal = new Animal({
            ownerId,
            ownerId_public,
            id_public,
            isOwned: true,
            ...def,
        });
        await animal.save();
        console.log(`  Created animal: ${def.name} (${id_public})`);
        createdAnimals.push(animal.toObject ? animal.toObject() : animal);
    }

    const sire = createdAnimals.find(a => a.gender === 'Male' && a.name === 'Biscuit');
    const dam = createdAnimals.find(a => a.gender === 'Female' && a.name === 'Maple');

    // --- 2. Litters ---
    // Each def has a _label used only for logging/dedup (not saved to DB)
    const litterDefs = [
        {
            // planned-only — no pair name (mirrors what the UI creates)
            _label: 'Demo Planned (Biscuit x Clover)',
            sireId_public: sire?.id_public,
            damId_public: createdAnimals.find(a => a.name === 'Clover')?.id_public,
            expectedDueDate: daysFromNow(22),
            isPlanned: true,
        },
        {
            // mated — pair name allowed after mating recorded
            _label: 'Demo Mated (Biscuit x Maple · Spring Run)',
            breedingPairCodeName: 'Biscuit × Maple · Spring Run',
            sireId_public: sire?.id_public,
            damId_public: dam?.id_public,
            matingDate: daysAgo(8),
            expectedDueDate: daysFromNow(13),
            isPlanned: true,
        },
        {
            // born + weaned events
            _label: 'Demo Born (Biscuit x Maple · Winter Run)',
            breedingPairCodeName: 'Biscuit × Maple · Winter Run',
            sireId_public: sire?.id_public,
            damId_public: dam?.id_public,
            matingDate: daysAgo(35),
            expectedDueDate: daysAgo(14),
            birthDate: daysAgo(14),
            birthMethod: 'Natural',
            litterSizeBorn: 8,
            numberBorn: 8,
            maleCount: 4,
            femaleCount: 4,
            stillbornCount: 0,
            weaningDate: daysFromNow(7),
            litterSizeWeaned: 8,
        },
    ];

    for (const def of litterDefs) {
        const { _label, ...litterData } = def;
        // Dedup by pair IDs + isPlanned + birthDate combo
        const existing = await Litter.findOne({
            ownerId,
            sireId_public: litterData.sireId_public,
            damId_public: litterData.damId_public,
            ...(litterData.breedingPairCodeName ? { breedingPairCodeName: litterData.breedingPairCodeName } : {}),
            ...(litterData.birthDate ? { birthDate: litterData.birthDate } : {}),
        }).lean();
        if (existing) {
            console.log(`  Litter "${_label}" already exists, skipping`);
            continue;
        }
        // Find the highest existing CTL number globally to avoid collisions
        const agg = await Litter.aggregate([
            { $match: { litter_id_public: /^CTL\d+$/ } },
            { $project: { num: { $toInt: { $substr: ['$litter_id_public', 3, -1] } } } },
            { $sort: { num: -1 } },
            { $limit: 1 },
        ]);
        const lastLNum = agg.length ? agg[0].num : 1000;
        let litter_id_public, lattempts = 0;
        do {
            litter_id_public = `CTL${String(lastLNum + 1 + lattempts).padStart(4,'0')}`;
            const clash = await Litter.findOne({ litter_id_public }).select('_id').lean();
            if (!clash) break;
            lattempts++;
        } while (lattempts < 50);
        const litter = new Litter({ ownerId, litter_id_public, ...litterData });
        await litter.save();
        console.log(`  Created litter: ${_label} (${litter_id_public})`);
    }

    // --- 3. Enclosures ---
    const enclosureDefs = [
        {
            name: 'Main Mouse Colony Bin',
            enclosureType: 'Bin Cage',
            size: '110L',
            notes: 'Main colony housing.',
            purpose: 'general',
            cleaningTasks: [
                { taskName: 'Full Bedding Change', lastDoneDate: daysAgo(11), frequencyDays: 14 },
                { taskName: 'Spot Clean', lastDoneDate: daysAgo(5), frequencyDays: 7 },
            ],
            _assignAnimals: [], // no specific animal assignment needed for general
        },
        {
            name: 'Breeding Pair Tank A',
            enclosureType: 'Tank',
            size: '40L',
            notes: 'Mating and pregnancy enclosure.',
            purpose: 'reproduction',
            cleaningTasks: [],
            _assignAnimals: ['Biscuit', 'Maple', 'Clover'], // mating, pregnant, nursing animals
        },
        {
            name: 'Quarantine / Treatment Bay 1',
            enclosureType: 'Bin Cage',
            size: '30L',
            notes: 'Isolation and treatment enclosure.',
            purpose: 'health',
            cleaningTasks: [
                { taskName: 'Full Disinfect', lastDoneDate: daysAgo(4), frequencyDays: 7 },
            ],
            _assignAnimals: ['Toast', 'Hazel'], // quarantine + treatment animals
        },
    ];

    for (const def of enclosureDefs) {
        const { _assignAnimals, ...encData } = def;
        let enc = await Enclosure.findOne({ ownerId, name: def.name }).lean();
        if (enc) {
            await Enclosure.updateOne({ _id: enc._id }, { $set: { purpose: def.purpose, cleaningTasks: def.cleaningTasks, notes: def.notes } });
            enc = await Enclosure.findById(enc._id).lean();
            console.log(`  Enclosure "${def.name}" updated (purpose: ${def.purpose})`);
        } else {
            enc = new Enclosure({ ownerId, ...encData });
            await enc.save();
            enc = enc.toObject ? enc.toObject() : enc;
            console.log(`  Created enclosure: ${def.name} (purpose: ${def.purpose})`);
        }
        // Assign named animals to this enclosure
        for (const animalName of _assignAnimals) {
            const animal = createdAnimals.find(a => a.name === animalName);
            if (animal) {
                await Animal.updateOne({ _id: animal._id }, { $set: { enclosureId: enc._id.toString() } });
                console.log(`    Assigned ${animalName} → ${def.name}`);
            }
        }
    }

    // --- 4. Supplies ---
    const supplyDefs = [
        {
            name: 'Carefresh Bedding (10L)',
            category: 'Bedding',
            currentStock: 1,
            unit: 'bag',
            reorderThreshold: 2,
            nextOrderDate: daysFromNow(4).toISOString().substring(0,10), // order in 4 days
        },
        {
            name: 'Mazuri Rodent Pellets',
            category: 'Food',
            currentStock: 0,
            unit: 'bag',
            reorderThreshold: 1,
            nextOrderDate: daysFromNow(1).toISOString().substring(0,10), // order tomorrow
        },
        {
            name: 'Hideout Houses (3-pack)',
            category: 'Other',
            currentStock: 2,
            unit: 'pack',
            nextOrderDate: daysFromNow(20).toISOString().substring(0,10),
        },
    ];

    for (const def of supplyDefs) {
        const existing = await SupplyItem.findOne({ userId: ownerId, name: def.name }).lean();
        if (existing) {
            console.log(`  Supply "${def.name}" already exists, skipping`);
            continue;
        }
        const supply = new SupplyItem({ userId: ownerId, ...def });
        await supply.save();
        console.log(`  Created supply: ${def.name}`);
    }

    console.log('\n✅ Seed complete. All 9 calendar event types should now be visible for CTU1.');
    await mongoose.disconnect();
}

run().catch(err => { console.error('Seed failed:', err); process.exit(1); });
