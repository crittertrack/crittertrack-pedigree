// Extracted from git history (migrations/assign-species-nursing-durations.js, commit 4eecf4d).
const CATEGORY_DEFAULTS = {
    Mammal: 90,
    Bird: 100,
    Reptile: 30,
    Amphibian: 60,
    Fish: 30,
    Invertebrate: 30,
    Other: 90,
};

// Explicit per-species overrides (days), researched per species' realistic
// max weaning/independence age.
const SPECIES_DAYS = {
    // Mammals
    'African Pygmy Dormouse': 45,
    'African Pygmy Mouse': 45,
    'Campbells Dwarf Hamster': 35,
    'Cat': 90,
    'Chinchilla': 90,
    'Chinese Dwarf Hamster': 35,
    'Deer mouse': 40,
    'Degu': 60,
    'Dog': 90,
    'Fancy Mouse': 35,
    'Fancy Rat': 42,
    'Fat-tailed Gerbil': 42,
    'Ferret': 84,
    'Gerbil': 42,
    'Guinea Pig': 45,
    'Hedgehog': 60,
    'Natal Rats': 42,
    'Prairie Dog': 84,
    'Rabbit': 60,
    'Roborovski Dwarf Hamster': 35,
    'Russian Dwarf Hamster': 35,
    'Sugar Glider': 150,
    'Syrian Hamster': 40,

    // Birds
    'African Grey Parrot': 150,
    'Budgie': 45,
    'Canary': 45,
    'Cockatiel': 90,
    'Cockatoo': 180,
    'Conure': 120,
    'Dove': 40,
    'Lovebird': 70,
    'Macaw': 300,
    'Zebra Finch': 45,

    // Reptiles (no parental care; independence shortly after hatch/first shed)
    'Ball Python': 30,
    'Bearded Dragon': 21,
    'Blue-Tongued Skink': 30,
    'Cape African House Snake': 21,
    'Chameleon': 21,
    'Corn Snake': 21,
    'Crested Gecko': 21,
    'Eastern Kingsnake': 21,
    'Gargoyle Gecko': 21,
    'Giant Day Gecko': 21,
    'Leopard Gecko': 21,
    'Red-Eared Slider': 21,
    'Russian Tortoise': 21,
    'Thicktail Gecko': 21,
    '3 Lined Knobtail Gecko': 21,
    'Banded Knobtails Gecko': 21,
    'Centralian Rough Knobtail Gecko': 21,
    'Pilbara Knobtail Gecko': 21,

    // Amphibians (metamorphosis duration)
    'Axolotl': 30,
    'Dart Poison Frog': 45,
    'Fire-Bellied Toad': 45,
    'Pacman Frog': 45,
    'Tiger Salamander': 60,
    'Tomato Frog': 45,
    "White's Tree Frog": 45,

    // Fish (fry independent almost immediately)
    'Angelfish': 21,
    'Betta Fish': 21,
    'Corydoras': 21,
    'Discus': 30,
    'Fancy Goldfish': 21,
    'Guppy': 14,
    'Koi': 21,
    'Oscar': 21,
    'Platy': 14,

    // Invertebrates
    'Bumble Bee': 45,
    'Cubaris Isopod': 30,
    'Curlyhair Tarantula': 21,
    'Giant African Millipede': 30,
    'Giant Yellow Spotted Isopod': 30,
    'Gooty Sapphire Ornamental Tarantula': 21,
    'Hermit Crab': 30,
    'Hissing Cockroach': 21,
    'Honey Bee': 40,
    'Jumping Spider': 21,
    'Land Snail': 21,
    'Pill millipede': 30,
    'Plum isopod': 30,
    'Praying Mantis': 21,
    'Roly-Poly isopod': 30,
    'Scorpion': 30,
    'Smooth Isopod': 30,
    'Stick Insect': 21,
    'Tarantula': 21,
};


module.exports = { CATEGORY_DEFAULTS, SPECIES_DAYS };

