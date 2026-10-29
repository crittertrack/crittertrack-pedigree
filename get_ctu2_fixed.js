const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev';

mongoose.connect(MONGODB_URI);

const { Animal } = require('./database/models');

async function fetchCTU2FemaleAnimals() {
  try {
    const animals = await Animal.find({ 
      creatorId_public: 'CTU2', 
      gender: 'Female', 
      isOwned: true 
    })
      .select('prefix name color coat markings geneticCode birthDate')
      .lean();
    
    console.log('Found ' + animals.length + ' female CTU2 animals with isOwned flag\n');
    
    console.log('| prefix/name | variety | carrier genes | age |');
    console.log('|-------------|---------|---------------|-----|');
    
    animals.forEach(a => {
      const variety = [a.color, a.markings, a.coat].filter(Boolean).join(', ') || 'Unknown';
      
      let carrierGenes = 'None';
      if (a.geneticCode) {
        const codeParts = a.geneticCode.split(' ');
        consthets = [];
        codeParts.forEach(part => {
          const [locus, allele] = part.split('/');
          if (locus && allele && locus !== allele) {
            const alleles = [locus, allele];
            alleles.forEach(al => {
              if (al.charAt(0) === al.charAt(0).toLowerCase() && al.charAt(0) !== al.charAt(0).toUpperCase()) {
                if (!consthets.includes(al)) {
                  consthets.push(al);
                }
              }
            });
          }
        });
        carrierGenes = consthets.length > 0 ? consthets.join(', ') : 'None';
      }
      
      let age = 'Unknown';
      if (a.birthDate) {
        const birth = new Date(a.birthDate);
        const today = new Date();
        const diffMs = today - birth;
        const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
        const months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
        const days = Math.floor((diffMs % (30.44 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        age = years + ' years ' + months + ' months ' + days + ' days';
      }
      
      console.log('| ' + (a.prefix || '') + '/' + a.name + ' | ' + variety + ' | ' + carrierGenes + ' | ' + age + ' |');
    });
    
    console.log('\nTotal: ' + animals.length + ' animals');
    mongoose.disconnect();
  } catch (error) {
    console.error('Error: ' + error.message);
    mongoose.disconnect();
  }
}

fetchCTU2FemaleAnimals();