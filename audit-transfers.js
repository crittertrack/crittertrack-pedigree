require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('./database/models');

// What we check:
// 1. originalOwnerId !== ownerId  (not a self-transfer)
// 2. originalOwnerId is in viewOnlyForUsers  (creator kept view-only access)
// 3. ownerId is NOT in viewOnlyForUsers  (current owner has full card, not view-only)

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('=== TRANSFERRED ANIMAL AUDIT ===\n');

    const transferred = await Animal.find({ originalOwnerId: { $exists: true, $ne: null } }).lean();
    console.log(`Found ${transferred.length} transferred animals\n`);

    // Build user ID -> id_public map
    const allUserIds = [...new Set([
        ...transferred.map(a => a.ownerId?.toString()),
        ...transferred.map(a => a.originalOwnerId?.toString()),
    ].filter(Boolean))];
    const users = await User.find({ _id: { $in: allUserIds } }).select('_id id_public').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.id_public; });

    const issues = [];
    const ok = [];

    for (const a of transferred) {
        const ownerStr = a.ownerId?.toString();
        const origStr = a.originalOwnerId?.toString();
        const ownerPublic = userMap[ownerStr] || ownerStr;
        const origPublic = userMap[origStr] || origStr;
        const voIds = (a.viewOnlyForUsers || []).map(id => id.toString());

        const animalIssues = [];

        // 1. Self-transfer check
        if (ownerStr === origStr) {
            animalIssues.push('originalOwnerId === ownerId (self-transfer, something went wrong)');
        }

        // 2. Creator should have view-only
        if (!voIds.includes(origStr)) {
            animalIssues.push(`creator (${origPublic}) missing from viewOnlyForUsers`);
        }

        // 3. Current owner must NOT be in viewOnlyForUsers
        if (voIds.includes(ownerStr)) {
            animalIssues.push(`current owner (${ownerPublic}) is incorrectly in viewOnlyForUsers`);
        }

        const entry = { id: a.id_public, name: a.name, creator: origPublic, currentOwner: ownerPublic };

        if (animalIssues.length > 0) {
            issues.push({ ...entry, issues: animalIssues });
        } else {
            ok.push(entry);
        }
    }

    console.log(`✅ ${ok.length} correct | ❌ ${issues.length} with issues\n`);

    if (issues.length > 0) {
        console.log('Issues:');
        issues.forEach(a => {
            console.log(`  ${a.id} "${a.name}" — ${a.creator} → ${a.currentOwner}`);
            a.issues.forEach(i => console.log(`    ⚠️  ${i}`));
        });
    }

    if (ok.length > 0 && issues.length === 0) {
        console.log('All transferred animals are correctly configured.');
    }

    mongoose.disconnect();
}).catch(err => { console.error(err); process.exit(1); });
