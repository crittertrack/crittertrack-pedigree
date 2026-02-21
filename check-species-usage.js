require('dotenv').config();
const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({}, { strict: false, collection: 'animals' });
const Animal = mongoose.model('Animal', animalSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

async function checkSpeciesUsage() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Get distinct species values with counts
        const speciesAggregation = await Animal.aggregate([
            {
                $group: {
                    _id: '$species',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        console.log('='.repeat(60));
        console.log('SPECIES USAGE IN DATABASE');
        console.log('='.repeat(60));
        console.log();

        let totalAnimals = 0;
        speciesAggregation.forEach(item => {
            totalAnimals += item.count;
            const species = item._id || '(null/undefined)';
            console.log(`${species.padEnd(30)} ${item.count.toString().padStart(6)} animals`);
        });

        console.log();
        console.log('='.repeat(60));
        console.log(`TOTAL: ${totalAnimals} animals`);
        console.log('='.repeat(60));

        // Also check which template each species maps to
        console.log('\n');
        console.log('='.repeat(60));
        console.log('SPECIES TO TEMPLATE MAPPING');
        console.log('='.repeat(60));
        console.log();

        const speciesTemplateMap = {
            'Fancy Mouse': 'Small Mammal Template',
            'Rat': 'Small Mammal Template',
            'Hamster': 'Small Mammal Template',
            'Gerbil': 'Small Mammal Template',
            'Guinea Pig': 'Small Mammal Template',
            'Rabbit': 'Small Mammal Template',
            'Chinchilla': 'Small Mammal Template',
            'Ferret': 'Small Mammal Template',
            'Hedgehog': 'Small Mammal Template',
            
            'Dog': 'Full Mammal Template',
            'Cat': 'Full Mammal Template',
            'Horse': 'Full Mammal Template',
            'Pig': 'Full Mammal Template',
            'Goat': 'Full Mammal Template',
            'Sheep': 'Full Mammal Template',
            'Cattle': 'Full Mammal Template',
            'Alpaca': 'Full Mammal Template',
            'Llama': 'Full Mammal Template',
            
            'Ball Python': 'Reptile Template',
            'Corn Snake': 'Reptile Template',
            'Bearded Dragon': 'Reptile Template',
            'Leopard Gecko': 'Reptile Template',
            'Crested Gecko': 'Reptile Template',
            
            'Canary': 'Bird Template',
            'Budgie': 'Bird Template',
            'Cockatiel': 'Bird Template',
            'Parrot': 'Bird Template',
            'Chicken': 'Bird Template',
            
            'Betta': 'Fish Template',
            'Goldfish': 'Fish Template',
            'Guppy': 'Fish Template',
            'Koi': 'Fish Template',
            
            'Axolotl': 'Amphibian Template',
            'Fire-Bellied Toad': 'Amphibian Template',
            'Tree Frog': 'Amphibian Template',
            
            'Tarantula': 'Invertebrate Template',
            'Scorpion': 'Invertebrate Template',
            'Millipede': 'Invertebrate Template'
        };

        speciesAggregation.forEach(item => {
            const species = item._id || '(null/undefined)';
            const template = speciesTemplateMap[species] || 'Other Template';
            console.log(`${species.padEnd(30)} -> ${template}`);
        });

        console.log();
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Disconnected from MongoDB');
    }
}

checkSpeciesUsage();
