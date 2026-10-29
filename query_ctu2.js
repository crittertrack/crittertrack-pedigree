(async () => {const mongoose = require('mongoose');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const envObj = {};
env.split('\n').forEach(line => {
  const match = line.match(/^(\w+)=(.*)$/);
  if (match) envObj[match[1]] = match[2];
});
mongoose.connect(envObj.MONGODB_URI);
const { Animal } = require('./database/models');

const animals = await Animal.find({ creatorId_public: 'CTU2', gender: 'Female', isOwned: true })
  .select('prefix name gender isOwned color coat markings geneticCode birthDate')
  .lean();

console.log('Found ' + animals.length + ' female CTU2 animals with isOwned flag:\n');
console.log('prefix/name\t\tvariety\t\tcarrier genes\t\tage');
console.log('------------------------------------------------------------------------');

animals.forEach(a => {
  // Compute variety from color, markings, coat
  const variety = [a.color, a.markings, a.coat].filter(Boolean).join(', ') || 'Unknown';
  
  // Compute carrier genes from genetic code
  let carrierGenes = '';
  if (a.geneticCode) {
    // Parse genetic code like 'A/A B/B D/D R/R'
    // Carrier genes are heterozygous loci (e.g., A/a, B/b, D/d, etc.)
    const codeParts = a.geneticCode.split(' ');
    consthets = [];
    codeParts.forEach(part => {
      const [locus, allele] = part.split('/');
      // Check if heterozygous (different alleles)
      const alleles = allele.split('/');
      if (alleles.length === 2 && alleles[0] !== alleles[1]) {
        consthets.push(locus);
      }
    });
    carrierGenes = codeParts.length > 0 ? codeParts.join(', ') : '';
    // More specifically, list the carrier loci
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
