require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Litter } = require('../database/models');
const fs = require('fs');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    // 1. Get ALL CTU5 animals
    const animals = await Animal.find({ ownerId_public: 'CTU5' })
        .select('id_public prefix name sex sireId_public damId_public status')
        .sort({ id_public: 1 })
        .lean();

    console.log(`Found ${animals.length} CTU5 animals`);

    // Placeholder name pattern: U1–U10, M1, DM U2, etc. — unnamed litter offspring
    const isPlaceholder = (a) => /^(DM\s+)?[UMF]\d+$/.test((a.name || '').trim());

    const ctu5Ids = new Set(animals.map(a => a.id_public));
    // IDs of all offspring already captured in litters (to exclude from named sections)
    const litterOffspringIds = new Set();

    // 2. Get ALL litters where at least one parent is a CTU5 animal (done pairings)
    const litters = await Litter.find({
        isPlanned: false,
        outcome: 'Successful',
        $or: [
            { sireId_public: { $in: [...ctu5Ids] } },
            { damId_public: { $in: [...ctu5Ids] } }
        ]
    })
        .select('litter_id_public breedingPairCodeName sireId_public sirePrefixName damId_public damPrefixName birthDate litterSizeBorn offspringIds_public ownerId_public')
        .sort({ birthDate: 1 })
        .lean();

    console.log(`Found ${litters.length} completed litters involving CTU5 animals`);

    // Collect offspring IDs already listed in litters
    for (const l of litters) {
        (l.offspringIds_public || []).forEach(id => litterOffspringIds.add(id));
    }

    // Animals to show in named sections: exclude placeholder-named litter offspring
    const namedAnimals = animals.filter(a => !isPlaceholder(a) || !litterOffspringIds.has(a.id_public));

    // 3. Collect all parent IDs across animals + litters to look up names
    const allParentIds = new Set([
        ...animals.map(a => a.sireId_public),
        ...animals.map(a => a.damId_public),
        ...litters.map(l => l.sireId_public),
        ...litters.map(l => l.damId_public),
    ].filter(Boolean));

    const parentDocs = await Animal.find({ id_public: { $in: [...allParentIds] } })
        .select('id_public prefix name ownerId_public')
        .lean();
    const parentMap = new Map(parentDocs.map(p => [p.id_public, p]));

    // Helper to get display name for an ID
    const getName = (id) => {
        if (!id) return '';
        const a = parentMap.get(id) || animals.find(x => x.id_public === id);
        return a ? [a.prefix, a.name].filter(Boolean).join(' ') : id;
    };

    // -------------------------------------------------------
    // OUTPUT 1: Animal roster CSV
    // -------------------------------------------------------
    const animalLines = ['ID,FullName,Sex,Status,SireID,SireName,DamID,DamName'];
    for (const a of animals) {
        const fullName = [a.prefix, a.name].filter(Boolean).join(' ');
        animalLines.push(`${a.id_public},"${fullName}",${a.sex || ''},${a.status || ''},${a.sireId_public || ''},"${getName(a.sireId_public)}",${a.damId_public || ''},"${getName(a.damId_public)}"`);
    }
    fs.writeFileSync('CTU5-all-animals.csv', animalLines.join('\n'));
    console.log('Exported CTU5-all-animals.csv');

    // -------------------------------------------------------
    // OUTPUT 2: Litters CSV
    // -------------------------------------------------------
    const litterLines = ['LitterID,Name,BirthDate,SireID,SireName,DamID,DamName,BornCount,OffspringIDs'];
    for (const l of litters) {
        const bd = l.birthDate ? l.birthDate.toISOString().slice(0, 10) : '';
        const offIds = (l.offspringIds_public || []).join(';');
        litterLines.push(`${l.litter_id_public || ''},"${l.breedingPairCodeName || ''}",${bd},${l.sireId_public || ''},"${getName(l.sireId_public)}",${l.damId_public || ''},"${getName(l.damId_public)}",${l.litterSizeBorn || ''},"${offIds}"`);
    }
    fs.writeFileSync('CTU5-litters.csv', litterLines.join('\n'));
    console.log('Exported CTU5-litters.csv');

    // -------------------------------------------------------
    // OUTPUT 3: Relationship analysis TXT
    // -------------------------------------------------------
    const animalMap = new Map(animals.map(a => [a.id_public, a]));

    // Group animals by (sireId, damId) for sibling detection
    const siblingGroups = new Map(); // key: "sireId|damId"
    for (const a of namedAnimals) {
        if (!a.sireId_public && !a.damId_public) continue;
        const key = `${a.sireId_public || ''}|${a.damId_public || ''}`;
        if (!siblingGroups.has(key)) siblingGroups.set(key, []);
        siblingGroups.get(key).push(a);
    }

    // Group by sire only for half-sibling detection
    const bySire = new Map();
    for (const a of namedAnimals) {
        if (!a.sireId_public) continue;
        if (!bySire.has(a.sireId_public)) bySire.set(a.sireId_public, []);
        bySire.get(a.sireId_public).push(a);
    }

    // Group by dam only for half-sibling detection
    const byDam = new Map();
    for (const a of namedAnimals) {
        if (!a.damId_public) continue;
        if (!byDam.has(a.damId_public)) byDam.set(a.damId_public, []);
        byDam.get(a.damId_public).push(a);
    }

    // Parent-child within CTU5
    const parentChild = [];
    for (const a of namedAnimals) {
        if (a.sireId_public && ctu5Ids.has(a.sireId_public)) {
            const sire = animalMap.get(a.sireId_public);
            parentChild.push(`${getName(a.sireId_public)} (${a.sireId_public})  -->  ${getName(a.id_public)} (${a.id_public})   [Father/Son or Father/Daughter]`);
        }
        if (a.damId_public && ctu5Ids.has(a.damId_public)) {
            parentChild.push(`${getName(a.damId_public)} (${a.damId_public})  -->  ${getName(a.id_public)} (${a.id_public})   [Mother/Son or Mother/Daughter]`);
        }
    }

    // Full siblings (same sire AND dam, both set)
    const fullSiblingGroups = [];
    for (const [key, group] of siblingGroups) {
        if (group.length < 2) continue;
        const [sId, dId] = key.split('|');
        if (!sId || !dId) continue;
        fullSiblingGroups.push({ sire: sId, dam: dId, members: group });
    }

    // Half siblings by sire
    const halfBySireGroups = [];
    for (const [sId, group] of bySire) {
        if (group.length < 2) continue;
        // Split into sub-groups by dam — members with different dams are half-siblings
        const damSubgroups = new Map();
        for (const a of group) {
            const dk = a.damId_public || 'unknown';
            if (!damSubgroups.has(dk)) damSubgroups.set(dk, []);
            damSubgroups.get(dk).push(a);
        }
        if (damSubgroups.size > 1) {
            halfBySireGroups.push({ sire: sId, subgroups: [...damSubgroups.entries()] });
        }
    }

    // Half siblings by dam
    const halfByDamGroups = [];
    for (const [dId, group] of byDam) {
        if (group.length < 2) continue;
        const sireSubgroups = new Map();
        for (const a of group) {
            const sk = a.sireId_public || 'unknown';
            if (!sireSubgroups.has(sk)) sireSubgroups.set(sk, []);
            sireSubgroups.get(sk).push(a);
        }
        if (sireSubgroups.size > 1) {
            halfByDamGroups.push({ dam: dId, subgroups: [...sireSubgroups.entries()] });
        }
    }

    // Litter pairings summary
    const litterSummary = [];
    for (const l of litters) {
        const sireName = getName(l.sireId_public);
        const damName = getName(l.damId_public);
        const sireOwned = ctu5Ids.has(l.sireId_public) ? '(CTU5)' : '(external)';
        const damOwned = ctu5Ids.has(l.damId_public) ? '(CTU5)' : '(external)';
        const bd = l.birthDate ? l.birthDate.toISOString().slice(0, 10) : 'unknown date';
        const offCount = l.litterSizeBorn || l.offspringIds_public?.length || '?';
        const name = l.breedingPairCodeName ? ` "${l.breedingPairCodeName}"` : '';
        litterSummary.push(`${l.litter_id_public || '?'}${name}  |  Born: ${bd}  |  ${offCount} offspring`);
        litterSummary.push(`  Sire: ${sireName} (${l.sireId_public || '?'}) ${sireOwned}`);
        litterSummary.push(`  Dam:  ${damName} (${l.damId_public || '?'}) ${damOwned}`);
        if (l.offspringIds_public?.length) {
            litterSummary.push(`  Offspring IDs: ${l.offspringIds_public.join(', ')}`);
        }
        litterSummary.push('');
    }

    const out = [];
    out.push('CTU5 ANIMALS - FULL RELATIONSHIP MAP');
    out.push('=====================================');
    out.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    out.push(`Total CTU5 animals: ${animals.length}`);
    out.push(`Total completed litters involving CTU5 animals: ${litters.length}`);
    out.push('');

    out.push('ROSTER');
    out.push('------');
    for (const a of namedAnimals) {
        const fullName = [a.prefix, a.name].filter(Boolean).join(' ') || a.id_public;
        const sire = a.sireId_public ? `Sire: ${a.sireId_public} (${getName(a.sireId_public)})` : 'Sire: unknown';
        const dam = a.damId_public ? `Dam: ${a.damId_public} (${getName(a.damId_public)})` : 'Dam: unknown';
        out.push(`${a.id_public.padEnd(10)} ${fullName.padEnd(30)} ${(a.sex || '?').padEnd(4)} ${(a.status || '').padEnd(12)} ${sire} | ${dam}`);
    }
    out.push('');

    out.push('PARENT-CHILD RELATIONSHIPS (within CTU5)');
    out.push('-----------------------------------------');
    if (parentChild.length) {
        parentChild.forEach(l => out.push(l));
    } else {
        out.push('None found.');
    }
    out.push('');

    out.push('FULL SIBLINGS (same sire AND same dam)');
    out.push('---------------------------------------');
    if (fullSiblingGroups.length) {
        for (const g of fullSiblingGroups) {
            out.push(`Sire: ${g.sire} (${getName(g.sire)})  x  Dam: ${g.dam} (${getName(g.dam)})`);
            for (const m of g.members) {
                out.push(`  - ${m.id_public} ${getName(m.id_public)}`);
            }
            out.push('');
        }
    } else {
        out.push('None found.');
        out.push('');
    }

    out.push('HALF SIBLINGS BY SHARED SIRE');
    out.push('-----------------------------');
    if (halfBySireGroups.length) {
        for (const g of halfBySireGroups) {
            out.push(`Shared Sire: ${g.sire} (${getName(g.sire)})`);
            for (const [dk, members] of g.subgroups) {
                const damLabel = dk === 'unknown' ? 'unknown dam' : `Dam ${dk} (${getName(dk)})`;
                out.push(`  Group (${damLabel}):`);
                for (const m of members) out.push(`    - ${m.id_public} ${getName(m.id_public)}`);
            }
            out.push('');
        }
    } else {
        out.push('None found.');
        out.push('');
    }

    out.push('HALF SIBLINGS BY SHARED DAM');
    out.push('----------------------------');
    if (halfByDamGroups.length) {
        for (const g of halfByDamGroups) {
            out.push(`Shared Dam: ${g.dam} (${getName(g.dam)})`);
            for (const [sk, members] of g.subgroups) {
                const sireLabel = sk === 'unknown' ? 'unknown sire' : `Sire ${sk} (${getName(sk)})`;
                out.push(`  Group (${sireLabel}):`);
                for (const m of members) out.push(`    - ${m.id_public} ${getName(m.id_public)}`);
            }
            out.push('');
        }
    } else {
        out.push('None found.');
        out.push('');
    }

    out.push('COMPLETED LITTERS INVOLVING CTU5 ANIMALS');
    out.push('-----------------------------------------');
    if (litterSummary.length) {
        litterSummary.forEach(l => out.push(l));
    } else {
        out.push('None found.');
    }

    fs.writeFileSync('CTU5-relationships.txt', out.join('\n'));
    console.log('Exported CTU5-relationships.txt');

    mongoose.disconnect();
}).catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
});
