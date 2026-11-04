// Pre-filled care-checklist templates, keyed by species name. Pure data + planning (no DB access) so
// it is unit-testable; routes/careTemplateRoutes.js applies the plan.
//
// Scope: recurring care CHORES only. Feeding is tracked separately in the app (feeding intervals),
// and medical care is deliberately left to the owner's vet, so health tasks are observation checks.
// Frequencies are conservative defaults in days; admins can edit every template afterwards.

const t = (taskName, frequencyDays, notes = null) => ({ taskName, frequencyDays, notes });

const GENERAL_HEALTH_NOTE = 'Look over eyes, coat/skin, breathing, droppings and any lumps. Contact a vet if something looks off.';

const smallRodent = ({ fullCleanDays, handlingDays, handlingNote }) => [
    t('Check and refill water', 1, 'Clean the bottle or bowl and check the bottle nozzle is not blocked.'),
    t('Spot-clean enclosure', 3, 'Remove soiled bedding, old food and stashes.'),
    t('Full enclosure clean and bedding change', fullCleanDays),
    t('Weigh-in / body condition check', 7, 'Sudden weight changes are an early warning sign.'),
    t('Health check', 7, GENERAL_HEALTH_NOTE),
    t('Handling / socialization', handlingDays, handlingNote),
    t('Wash and rotate toys, wheel and hides', 7),
];

const RAT = smallRodent({ fullCleanDays: 7, handlingDays: 1, handlingNote: 'Rats are social and need daily interaction and out-of-cage time.' });
const MOUSE = smallRodent({ fullCleanDays: 14, handlingDays: 3 });
const HAMSTER = smallRodent({ fullCleanDays: 14, handlingDays: 3, handlingNote: 'Hamsters are nocturnal; handle in the evening and let them wake up naturally.' });
const GERBIL = smallRodent({ fullCleanDays: 28, handlingDays: 3, handlingNote: 'Keep the sand bath available and replace it when it clumps or gets dirty.' });

const GUINEA_PIG = [
    t('Check and refill water', 1),
    t('Spot-clean enclosure', 1, 'Guinea pigs are messy: remove soiled bedding and old fresh food daily.'),
    t('Full enclosure clean and bedding change', 7),
    t('Weigh-in / body condition check', 7, 'Weigh on a kitchen scale; a drop in weight is an early sign of illness.'),
    t('Health check', 7, `${GENERAL_HEALTH_NOTE} Also check teeth, feet and the bottom.`),
    t('Nail trim', 28),
    t('Floor time / exercise', 1),
    t('Wash hides, bowls and toys', 7),
];

const RABBIT = [
    t('Check and refill water', 1),
    t('Change litter tray', 2),
    t('Full enclosure clean', 7),
    t('Weigh-in / body condition check', 7),
    t('Health check', 7, `${GENERAL_HEALTH_NOTE} Also check teeth, ears and that the bottom is clean (flystrike risk in warm weather).`),
    t('Brush coat', 7, 'Brush more often during moults.'),
    t('Nail trim', 35),
    t('Exercise / out-of-pen time', 1),
];

const FERRET = [
    t('Scoop litter tray', 1),
    t('Wash bedding and hammocks', 7),
    t('Full cage clean', 7),
    t('Weigh-in / body condition check', 14),
    t('Health check', 7, GENERAL_HEALTH_NOTE),
    t('Nail trim', 14),
    t('Ear check and clean', 14, 'Use a ferret-safe ear cleaner.'),
    t('Playtime / out-of-cage time', 1),
];

const CAT = [
    t('Scoop litter box', 1),
    t('Full litter change and wash box', 7),
    t('Wash bedding', 14),
    t('Brush coat', 7, 'Long-haired cats may need brushing more often.'),
    t('Nail trim', 14),
    t('Brush teeth', 3, 'Daily is ideal if the cat tolerates it. Use cat-safe toothpaste.'),
    t('Weigh-in / body condition check', 30),
    t('Health check', 7, GENERAL_HEALTH_NOTE),
    t('Play session', 1),
];

const DOG = [
    t('Walk / exercise', 1),
    t('Brush coat', 7, 'Some coats need brushing more often.'),
    t('Nail trim', 21),
    t('Brush teeth', 3, 'Daily is ideal. Use dog-safe toothpaste.'),
    t('Ear check', 7),
    t('Bath', 30, 'Only as needed for the coat type; over-bathing dries the skin.'),
    t('Weigh-in / body condition check', 30),
    t('Health check', 7, `${GENERAL_HEALTH_NOTE} Also check paws and skin.`),
    t('Wash bedding', 14),
    t('Parasite prevention', 30, 'Follow the schedule your vet recommends and adjust this frequency to match.'),
];

const BIRD = [
    t('Fresh water and clean bowls', 1),
    t('Change cage liner / paper', 1),
    t('Clean perches, toys and food dishes', 7),
    t('Full cage clean', 14),
    t('Out-of-cage flight and social time', 1, 'Birds are social and need daily interaction and exercise.'),
    t('Rotate or replace toys', 14),
    t('Health check', 7, 'Check eyes, nostrils, droppings, feathers and weight/keel condition. Birds hide illness, so contact an avian vet early.'),
    t('Weigh-in', 14, 'Weigh on a gram scale at the same time of day.'),
    t('Nail and beak check', 30),
    t('Bath or misting', 7),
];

const UVB_NOTE = 'Replace UVB tubes per the manufacturer schedule, usually every 6 to 12 months.';

const reptileCore = (extra) => [
    t('Check temperature and humidity', 1, 'Check basking and cool-side temperatures and humidity with a thermometer/hygrometer.'),
    t('Fresh water and clean bowl', 1),
    t('Spot-clean enclosure', 2, 'Remove feces, urates and soiled substrate promptly.'),
    t('Full enclosure clean and substrate change', 30),
    t('Weigh-in / body condition check', 14),
    t('Health check', 7, 'Check eyes, skin, mouth, vent and for stuck shed. Contact a reptile vet if something looks off.'),
    ...extra,
];

const SNAKE = reptileCore([
    t('Check for retained shed', 14, 'Look especially at the eye caps and tail tip after a shed.'),
    t('Disinfect hides and water bowl', 30),
]);

const ARID_GECKO = reptileCore([
    t('Check for retained shed', 14, 'Check toes and tail tip after a shed.'),
    t('Refresh humid hide', 3, 'Keep the moist hide damp, not wet.'),
    t('Check UVB / heat equipment', 30, `Check bulbs and the heat source are working. ${UVB_NOTE}`),
]);

const DAY_GECKO = reptileCore([
    t('Mist enclosure', 1, 'Mist so the plants and glass are damp; let it dry out between mists.'),
    t('Check UVB bulb age', 30, UVB_NOTE),
    t('Check feeding station and nectar/fruit mix', 2),
]);

const BEARDED_DRAGON = reptileCore([
    t('Check UVB bulb age', 30, UVB_NOTE),
    t('Wash greens and refresh salad', 1),
    t('Bath / soak', 7),
    t('Disinfect basking surfaces and decor', 14),
]);

const IGUANA = reptileCore([
    t('Check UVB bulb age', 30, UVB_NOTE),
    t('Mist enclosure', 1),
    t('Bath / soak', 7),
    t('Wash greens and refresh salad', 1),
]);

const INVERTEBRATE = [
    t('Check temperature and humidity', 2),
    t('Check water dish', 2, 'Keep a clean shallow dish topped up.'),
    t('Remove uneaten food and waste', 2),
    t('Check moisture levels / mist substrate', 3, 'Aim for the humidity the species needs, not soaking.'),
    t('Health and molt check', 14, 'Watch for stuck molts, lethargy or mites. Avoid handling during a molt.'),
    t('Full enclosure clean', 90),
];

const ISOPOD = [
    t('Check moisture and mist substrate', 2, 'Keep one side damp and one side drier so they can choose.'),
    t('Check temperature and humidity', 2),
    t('Add leaf litter and food', 7, 'Provide leaf litter, wood and a protein source.'),
    t('Remove old food and mold', 3),
    t('Population and health check', 14),
    t('Top up substrate', 60),
];

const TARANTULA = [
    t('Check water dish', 3, 'Keep a clean shallow dish topped up.'),
    t('Check humidity / moisten one corner of the substrate', 5, 'Match the species. Many tarantulas need a damp corner, not a wet enclosure.'),
    t('Remove uneaten prey and waste', 2, 'Remove prey that was not eaten the next day, especially before a molt.'),
    t('Check temperature', 7),
    t('Health and molt check', 14, 'Avoid disturbing a spider that is in a molt. Watch for a dehydrated or curled-up appearance.'),
    t('Full enclosure clean', 180),
];

const TEMPLATES = {
    RAT, MOUSE, HAMSTER, GERBIL, GUINEA_PIG, RABBIT, FERRET, CAT, DOG, BIRD,
    SNAKE, ARID_GECKO, DAY_GECKO, BEARDED_DRAGON, IGUANA, INVERTEBRATE, ISOPOD, TARANTULA,
};

// Ordered rules: the first match wins, so specific names come before general ones.
// Names that don't match any rule (e.g. an unfamiliar species) get no template: an admin fills
// those in rather than the app guessing.
const SPECIES_RULES = [
    { test: /\bisopod\b|pumpkin patch/i, key: 'ISOPOD' },
    { test: /tarantula|birdeater|bird-eater|baboon|blood ?leg|ornamental/i, key: 'TARANTULA' },
    { test: /day gecko/i, key: 'DAY_GECKO' },
    { test: /gecko/i, key: 'ARID_GECKO' },
    { test: /bearded dragon/i, key: 'BEARDED_DRAGON' },
    { test: /iguana/i, key: 'IGUANA' },
    { test: /snake|python|\bboa\b|kingsnake/i, key: 'SNAKE' },
    { test: /\brats?\b/i, key: 'RAT' },
    { test: /\bmouse\b|\bmice\b/i, key: 'MOUSE' },
    { test: /hamster/i, key: 'HAMSTER' },
    { test: /gerbil/i, key: 'GERBIL' },
    { test: /guinea pig|\bcavy\b/i, key: 'GUINEA_PIG' },
    { test: /rabbit/i, key: 'RABBIT' },
    { test: /ferret/i, key: 'FERRET' },
    { test: /^cat\b|\bcat$/i, key: 'CAT' },
    { test: /^dog\b|\bdog$/i, key: 'DOG' },
    { test: /budgie|budgerigar|cockatiel|parakeet|parrot|canary|finch|lovebird/i, key: 'BIRD' },
];

const clone = (tasks) => tasks.map((task) => ({ ...task }));

// The default checklist for a species name, or null when there is no sensible default.
const defaultTemplateFor = (speciesName) => {
    const name = String(speciesName || '').trim();
    if (!name) return null;
    const rule = SPECIES_RULES.find((r) => r.test.test(name));
    return rule ? clone(TEMPLATES[rule.key]) : null;
};

// Which templates to create: species that exist, have a default, and do NOT already have a template.
// Never overwrites an existing template, so admin edits are always kept.
const planDefaultTemplates = (speciesNames, existingTemplateSpecies) => {
    const have = new Set((existingTemplateSpecies || []).map((s) => String(s).trim().toLowerCase()));
    const seen = new Set();
    const create = [];
    const noDefault = [];
    for (const raw of speciesNames || []) {
        const species = String(raw || '').trim();
        const key = species.toLowerCase();
        if (!species || seen.has(key) || have.has(key)) continue;
        seen.add(key);
        const tasks = defaultTemplateFor(species);
        if (tasks) create.push({ species, tasks });
        else noDefault.push(species);
    }
    return { create, noDefault };
};

module.exports = { TEMPLATES, SPECIES_RULES, defaultTemplateFor, planDefaultTemplates };
