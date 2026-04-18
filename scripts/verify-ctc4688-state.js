require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const a = await Animal.findOne({ id_public: 'CTC4688' }).lean();
    console.log('=== CTC4688 Current State ===');
    console.log('sireId_public:', a.sireId_public);
    console.log('damId_public:', a.damId_public);
    console.log('manualPedigree.sire.ctcId:', a.manualPedigree?.sire?.ctcId);
    console.log('manualPedigree.dam.ctcId:', a.manualPedigree?.dam?.ctcId);
    await mongoose.disconnect();
})();
