'use strict';
/** Helpers for breederAssignedId litter codes (owners usually type their litter name there, e.g. "R12-M5" = litter R12). */
const keyOf = (s) => String(s).trim().replace(/[\s._-]*(?:[MFmf]|male|female|boy|girl|pup|kit|baby)?[\s._-]*\d*$/i, '').replace(/[\s._-]+$/, '');
const okKey = (k) => k.length >= 2 && /[A-Za-z]/.test(k);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/** Codes spanning more than one complete sire+dam+birth-day combination are numbering schemes, not litter names. */
function conflictingCodes(animals) {
    const sigs = new Map();
    animals.filter(a => a.breederAssignedId && a.sireId_public && a.damId_public && a.birthDate).forEach(a => {
        const k = a.creatorId + '|' + keyOf(a.breederAssignedId);
        if (!sigs.has(k)) sigs.set(k, new Set());
        sigs.get(k).add([a.sireId_public, a.damId_public, day(a.birthDate)].join('|'));
    });
    return new Set([...sigs].filter(([, s]) => s.size > 1).map(([k]) => k));
}

/** Litters to name: where the animals listed on the litter share one code (all, or >=60% with at least 2). */
function planNames(litters, byPub, conflict) {
    const out = [];
    for (const l of litters) {
        if (l.breedingPairCodeName) continue;
        const kids = (l.offspringIds_public || []).map(id => byPub.get(id)).filter(Boolean);
        const keys = kids.map(a => (a.breederAssignedId ? keyOf(a.breederAssignedId) : null)).filter(Boolean);
        if (!keys.length) continue;
        const c = keys.reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {});
        const [code, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
        if (!okKey(code) || conflict.has(l.creatorId + '|' + code)) continue;
        if (n === kids.length || (n / kids.length >= 0.6 && n >= 2)) out.push({ _id: String(l._id), code, n, of: kids.length, ctl: l.litter_id_public });
    }
    return out;
}

/** Code groups (>=2 animals, same owner) that no litter covers, where sire, dam and birth day do not disagree. */
function planNewLitters(animals, covered, conflict) {
    const groups = new Map();
    animals.filter(a => !a.litterId && !covered.has(a.id_public) && a.breederAssignedId).forEach(a => {
        const code = keyOf(a.breederAssignedId);
        if (!okKey(code) || conflict.has(a.creatorId + '|' + code)) return;
        const k = a.creatorId + '|' + code;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(a);
    });
    const out = []; let candidates = 0;
    for (const [k, g] of [...groups].filter(([, g]) => g.length >= 2).sort((a, b) => a[0].localeCompare(b[0]))) {
        candidates++;
        const [owner, code] = k.split('|');
        const sires = [...new Set(g.map(a => a.sireId_public).filter(Boolean))], dams = [...new Set(g.map(a => a.damId_public).filter(Boolean))];
        const births = [...new Set(g.map(a => day(a.birthDate)).filter(Boolean))];
        if (sires.length > 1 || dams.length > 1 || births.length > 1) continue;
        out.push({ key: k, owner, code, g, sire: sires[0] || null, dam: dams[0] || null, birth: births[0] || null,
            male: g.filter(a => a.gender === 'Male').length, female: g.filter(a => a.gender === 'Female').length });
    }
    return { out, candidates };
}

module.exports = { keyOf, okKey, day, conflictingCodes, planNames, planNewLitters };
