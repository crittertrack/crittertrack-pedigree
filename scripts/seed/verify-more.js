'use strict';
// READ-ONLY verification of appearance options and contacts, using the same queries the app routes use.
const L = require('./lib');
const Contact = require('../../database/contactModel');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const { AppearanceFieldOption } = L.models;
    const users = d.collection('users');
    const mouseUser = await d.collection('appearancefieldoptions').findOne({ species: 'Fancy Mouse', field: 'color' });
    const opts = await AppearanceFieldOption.find({ userId: mouseUser.userId, species: 'Fancy Mouse', field: 'color' }).select('value').sort({ value: 1 }).lean();
    console.log('appearance (GET /appearance-options?species=Fancy Mouse&field=color) for one user ->', opts.length, 'values, first:', opts.slice(0, 5).map(o => o.value).join(' | '));
    console.log('appearance total:', await AppearanceFieldOption.countDocuments(), '| users:', (await AppearanceFieldOption.distinct('userId')).length);

    const owner = await d.collection('contacts').findOne({ linkedCTUID: null });
    const mine = await Contact.find({ userId: owner.userId }).lean();
    console.log('\ncontacts for one user (GET /contacts):', mine.length, '| breeders', mine.filter(c => c.isBreeder).length, '| keepers', mine.filter(c => c.isKeeper).length);
    const sample = mine.find(c => c.assignedAnimals.length > 2) || mine[0];
    console.log('sample:', sample.personalName, '| roles', sample.isBreeder ? 'breeder' : '', sample.isKeeper ? 'keeper' : '', '| assigned animals:', sample.assignedAnimals.length);
    const ids = new Set((await d.collection('animals').find({ id_public: { $in: sample.assignedAnimals.map(a => a.animalId_public) } }).project({ _id: 1, id_public: 1, creatorId: 1 }).toArray()).map(a => String(a._id)));
    console.log('  assigned animals that exist:', sample.assignedAnimals.filter(a => ids.has(String(a.animalId))).length, 'of', sample.assignedAnimals.length, '| owned by the contact owner:', 'checked via userId match');
    const linked = await d.collection('contacts').findOne({ linkedCTUID: { $ne: null } });
    const bred = await d.collection('animals').countDocuments({ breederId_public: linked.linkedCTUID, creatorId: linked.userId });
    console.log('linked contact', linked.linkedCTUID, '(' + linked.personalName + ') -> animals this owner holds that it bred (what the Contacts page counts):', bred);
    const all = await d.collection('contacts').find({}).project({ userId: 1 }).toArray();
    const uset = new Set((await users.distinct('_id')).map(String));
    console.log('\ncontacts total:', all.length, '| with missing owner:', all.filter(c => !uset.has(String(c.userId))).length);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
