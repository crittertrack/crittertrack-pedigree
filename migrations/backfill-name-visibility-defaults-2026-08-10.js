// One-off: apply the intended default-visibility rule to ALL users (supersedes the
// earlier showBreederName-based backfill from this session, which used the wrong rule):
//   - User has a real/customized breederName (non-empty, different from personalName)
//     -> set showBreederName: true
//   - User has NO real breederName (empty, or just a copy of personalName from the
//     registration fallback) -> set showPersonalName: true
// Each rule only touches the field it names; the other field is left as-is.
require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

const hasRealBreederName = (doc) => {
    const bn = (doc.breederName || '').trim();
    const pn = (doc.personalName || '').trim();
    return bn.length > 0 && bn !== pn;
};

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const profiles = await PublicProfile.find({}).select('_id userId_backend id_public personalName breederName').lean();

    const withBreederName = profiles.filter(hasRealBreederName);
    const withoutBreederName = profiles.filter(p => !hasRealBreederName(p));

    console.log(`Profiles with a real breeder name: ${withBreederName.length}`);
    console.log(`Profiles with no real breeder name: ${withoutBreederName.length}`);

    const bnProfileIds = withBreederName.map(p => p._id);
    const bnUserIds = withBreederName.map(p => p.userId_backend);
    const pnProfileIds = withoutBreederName.map(p => p._id);
    const pnUserIds = withoutBreederName.map(p => p.userId_backend);

    const bnProfileResult = await PublicProfile.updateMany({ _id: { $in: bnProfileIds } }, { $set: { showBreederName: true } });
    const bnUserResult = await User.updateMany({ _id: { $in: bnUserIds } }, { $set: { showBreederName: true } });
    const pnProfileResult = await PublicProfile.updateMany({ _id: { $in: pnProfileIds } }, { $set: { showPersonalName: true } });
    const pnUserResult = await User.updateMany({ _id: { $in: pnUserIds } }, { $set: { showPersonalName: true } });

    console.log(`showBreederName=true -> PublicProfile modified: ${bnProfileResult.modifiedCount}, User modified: ${bnUserResult.modifiedCount}`);
    console.log(`showPersonalName=true -> PublicProfile modified: ${pnProfileResult.modifiedCount}, User modified: ${pnUserResult.modifiedCount}`);

    await mongoose.disconnect();
})();
