const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev';

mongoose.connect(MONGODB_URI);

const { Animal } = require('./database/models');

// Gene symbol to trait name mapping (Fancy Mouse)
const GENE_TRAIT_MAP = {
  'a': 'Black',
  'at': 'Tan',
  'Ay': 'Agouti (Dominant Red)',
  'Aw': 'White-bellied Agouti',
  'b': 'Brown/Chocolate',
  'c': 'Albino',
  'cch': 'Chinchilla',
  'ce': 'Extreme Dilute',
  'ch': 'Himalayan',
  'cm': 'Marten',
  'ct': 'Tonkinese',
  'd': 'Dilute (Blue)',
  'e': 'Recessive Red/Yellow',
  'go': 'Go',
  'p': 'Pink-eyed Dilution',
  'r': 'Red-eyed Dilution',
  're': 'Rex',
  'rn': 'Roan',
  'rst': 'Roan Spotting',
  's': 'Piebald',
  'sa': 'Sable',
  'spl': 'Splashed',
  'w': 'White Spotting',
  'C': 'Full Color',
  'A': 'Agouti',
  'B': 'Brown (dominant)',
  'D': 'Dilute (dominant)',
  'P': 'Pink-eye (dominant)',
  'R': 'Red-eye (dominant)',
  'S': 'Self (dominant)',
  'E': 'Extension (dominant)',
  'Go': 'Go (dominant)',
  'Re': 'Rex (dominant)',
  'Sa': 'Sable (dominant)',
  'Spl': 'Splashed (dominant)',
  'Rst': 'Roan Spotting (dominant)',
  'Rn': 'Roan (dominant)',
  'Ch': 'Himalayan (dominant)',
  'Ce': 'Extreme Dilute (dominant)',
  'Cch': 'Chinchilla (dominant)',
  'At': 'Tan (dominant)',
};

function geneToTrait(gene) {
  return GENE_TRAIT_MAP[gene] || gene;
}

async function fetchCTU2FemaleAnimals() {
  try {
    const animals = await Animal.find({ 
      creatorId_public: 'CTU2', 
      gender: 'Female', 
      isOwned: true 
    })
      .select('prefix name color coat markings geneticCode birthDate species')
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
        // Map to trait names
        const traitNames = consthets.map(g => geneToTrait(g) + ' (carrier)');
        carrierGenes = traitNames.length > 0 ? traitNames.join(', ') : 'None';
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