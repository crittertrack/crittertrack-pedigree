const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev');

const { Animal } = require('./database/models');

Animal.find({ creatorId_public: 'CTU2', gender: 'Female', isOwned: true })
  .select('prefix name color coat markings geneticCode birthDate')
  .lean()
  .then(animals => {
    console.log('Found ' + animals.length + ' female CTU2 animals with isOwned flag:\n');
    console.log('prefix/name\t\tvariety\t\tcarrier genes\t\tage');
    console.log('------------------------------------------------------------------------');
    
    animals.forEach(a => {
      // Compute variety from color, markings, coat
      const variety = [a.color, a.markings, a.coat].filter(Boolean).join(', ') || 'Unknown';
      
      // Compute carrier genes from genetic code
      let carrierGenes = '';
      if (a.geneticCode) {
        const codeParts = a.geneticCode.split(' ');
        consthets = [];
        codeParts.forEach(part => {
          const [locus, allele] = part.split('/');
          const alleles = allele.split('/');
          if (alleles.length === 2 && alleles[0] !== alleles[1]) {
            consthets.push(locus);
          }
        });
        carrierGenes = codeParts.length > 0 ? codeParts.join(', ') : '';
        if (consthets.length > 0) {
          carrierGenes = consthets.join(', ');
        } else {
          carrierGenes = 'None';
        }
      }
      
      // Compute age from birthDate
      let age = 'Unknown';
      if (a.birthDate) {
        const birth = new Date(a.birthDate);
        const today = new Date();
        const years = today.getFullYear() - birth.getFullYear();
        const months = today.getMonth() - birth.getMonth();
        age = years + ' years ' + months + ' months';
      }

      const prefix = a.prefix || '';
      const name = a.name;
      console.log(prefix + '/' + name + '\t' + variety + '\t' + carrierGenes + '\t' + age);
    });
    
    // Also output markdown table
    console.log('\n---\nMarkdown Table:\n---');
    console.log('| prefix/name | variety | carrier genes | age |');
    console.log('|-------------|---------|---------------|-----|');
    animals.forEach(a => {
      const variety = [a.color, a.markings, a.coat].filter(Boolean).join(', ') || 'Unknown';
      let carrierGenes = '';
      if (a.geneticCode) {
        const codeParts = a.geneticCode.split(' ');
        consthets = [];
        codeParts.forEach(part => {
          const [locus, allele] = part.split('/');
          const alleles = allele.split('/');
          if (alleles.length === 2 && alleles[0] !== alleles[1]) {
            consthets.push(locus);
          }
        });
        carrierGenes = codeParts.length > 0 ? codeParts.join(', ') : '';
        if (consthets.length > 0) {
          carrierGenes = consthets.join(', ');
        } else {
          carrierGenes = 'None';
        }
      }
      
      let age = 'Unknown';
      if (a.birthDate) {
        const birth = new Date(a.birthDate);
        const today = new Date();
        const years = today.getFullYear() - birth.getFullYear();
        const months = today.getMonth() - birth.getMonth();
        age = years + ' years ' + months + ' months';
      }
      
      const prefix = a.prefix || '';
      const formattedName = a.name;
      console.log('| ' + prefix + '/' + formattedName + ' | ' + variety + ' | ' + carrierGenes + ' | ' + age + ' |');
    });
  })
  .catch(err => {
    console.error('Error: ', err);
  });