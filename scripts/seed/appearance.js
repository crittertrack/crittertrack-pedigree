'use strict';
/**
 * appearanceFieldOptions: each user's saved dropdown values for color / markings / coat / earset / eyeColor / body,
 * rebuilt from the values actually used on their animals (the app saves a value to this list whenever a user types
 * it, so every value on an animal was once in the list). Unique per (user, species, field, value) case-insensitively,
 * same rule as the collection's own index. Only fields the animal form offers as dropdowns are created.
 */
const FIELDS = ['color', 'markings', 'coat', 'earset', 'eyeColor', 'body'];

module.exports = async (L, ctx) => {
    const { AppearanceFieldOption } = L.models;
    const userIds = new Set(ctx.users.map(u => String(u._id)));
    const seen = new Map();
    for (const a of ctx.animals) {
        const owner = String(a.creatorId); if (!userIds.has(owner) || !a.species) continue;
        for (const f of FIELDS) {
            const v = typeof a[f] === 'string' ? a[f].trim().replace(/\s+/g, ' ') : '';
            if (!v) continue;
            const key = [owner, a.species.toLowerCase(), f, v.toLowerCase()].join('|');
            if (!seen.has(key)) seen.set(key, { userId: owner, species: a.species, field: f, value: v });
        }
    }
    const docs = [...seen.values()].map(o => ({ userId: L.oid(o.userId), species: o.species, field: o.field, value: o.value, createdAt: new Date(), updatedAt: new Date(), __v: 0 }));
    const byField = docs.reduce((c, d) => { c[d.field] = (c[d.field] || 0) + 1; return c; }, {});
    L.log(`  distinct options: ${docs.length} | by field: ${JSON.stringify(byField)} | users: ${new Set(docs.map(d => String(d.userId))).size}`);
    const have = await AppearanceFieldOption.collection.countDocuments();
    if (have > 0) L.log(`  note: collection already has ${have} documents; duplicates are skipped by the unique index`);
    if (!L.confirm) { L.log(`  appearancefieldoptions: would insert up to ${docs.length}`); return; }
    let inserted = 0, dup = 0;
    for (let i = 0; i < docs.length; i += 500) {
        try { const r = await AppearanceFieldOption.collection.insertMany(docs.slice(i, i + 500), { ordered: false }); inserted += r.insertedCount; }
        catch (e) { inserted += (e.result && e.result.insertedCount) || (e.insertedCount || 0); dup += (e.writeErrors || []).filter(w => w.code === 11000).length; if ((e.writeErrors || []).some(w => w.code !== 11000)) throw e; }
    }
    L.log(`  appearancefieldoptions: inserted ${inserted}, duplicates skipped ${dup}`);
};
