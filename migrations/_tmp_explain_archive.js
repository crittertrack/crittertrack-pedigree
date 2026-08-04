require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find a user that actually has archived animals, to get realistic explain() stats.
    const sample = await Animal.findOne({ archived: true }).select('creatorId').lean();
    if (!sample) {
        console.log('No archived animals found in the whole DB.');
        await mongoose.disconnect();
        return;
    }
    const userId = sample.creatorId;
    console.log('Testing with creatorId:', userId.toString());

    const archivedExplain = await Animal.find({ creatorId: userId, archived: true }).explain('executionStats');
    console.log('--- Archived query ---');
    console.log(JSON.stringify({
        winningPlan: archivedExplain.queryPlanner.winningPlan,
        nReturned: archivedExplain.executionStats.nReturned,
        totalDocsExamined: archivedExplain.executionStats.totalDocsExamined,
        totalKeysExamined: archivedExplain.executionStats.totalKeysExamined,
        executionTimeMillis: archivedExplain.executionStats.executionTimeMillis,
    }, null, 2));

    const soldExplain = await Animal.find({ viewOnlyForUsers: userId, hiddenForUsers: { $ne: userId } }).explain('executionStats');
    console.log('--- SoldTransferred query ---');
    console.log(JSON.stringify({
        winningPlan: soldExplain.queryPlanner.winningPlan,
        nReturned: soldExplain.executionStats.nReturned,
        totalDocsExamined: soldExplain.executionStats.totalDocsExamined,
        totalKeysExamined: soldExplain.executionStats.totalKeysExamined,
        executionTimeMillis: soldExplain.executionStats.executionTimeMillis,
    }, null, 2));

    const totalAnimals = await Animal.estimatedDocumentCount();
    console.log('Total animals in DB (all users):', totalAnimals);

    await mongoose.disconnect();
})();
