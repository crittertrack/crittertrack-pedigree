require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const screenshot = [
    'Akimi','Amaya','Ameya','Anzu','Aoki','Asaki','Asami','Ayame','Azami',
    'Bakebi','Benihime','Bimyo','Black Belle','Bourbillon',
    'Chikara','Dankei','Dolly','Dounia',
    'Emiko','Erina','Eyuki','Fawny','Fuyumi',
    'Ghost','Grandity','Guimauve',
    'Hachiman','Hakuko','Hanako','Harumi','Haruna','Hibiki','Hikari','Himeko','Hinata','Hiroo','Hiyori',
    'Ibuki','Ikuya','Inoko','Iroha','Itako','Itoe','Iwako',
    'Jigoku','Jiro','Junzen','Kaito','Kakei','Kami','Kanade','Kanon',
    'Kiseki','Kobus','Koi','Kozue','Kujaku',
    'Laika','Lexi','Liichi','Likka','Likona','Liyuu',
    'Mamoru','Manami','Mayumi',
    'Mikan','Misao','Misuzu','Mitsurin','Mizore','Mizuki','Moka','Motoo',
    'Nanami','Naoko','Natsuki','Neko','Nesshin','Ningyo','Ninko','Noboru','Nobu','Nozomu',
    'Okiru','Onu','Peji','Pikachu',
    'Poteto','Qoro','Ran','Rena','Riku','Risu','Ryoko',
    'Sasori','Seiko','Shigure','Shina','Shoji','Shuga','Suiteki','Sunao',
    'Takara','Takiyo','Teruko','Terumi','Towa',
    'Umai','Unichi',
    'Wakana','Wataru','Yasu','Yoko','Yuushou','Zeroyo','Zettai','Yoshi'
];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const all = await Animal.find({ prefix: 'TnS' }).select('name id_public ownerId_public status').lean();
    // Also check with prefix 'Tns' (lowercase s) for "Tns Yoshi"
    const allTns = await Animal.find({ prefix: 'Tns' }).select('name id_public ownerId_public status').lean();
    const dbMap = {};
    [...all, ...allTns].forEach(a => { dbMap[a.name] = a; });
    const dbNames = Object.keys(dbMap);

    console.log(`Screenshots: ${screenshot.length} names`);
    console.log(`DB: ${all.length} TnS + ${allTns.length} Tns = ${all.length + allTns.length}\n`);

    const missing = screenshot.filter(n => !dbMap[n]);
    const extra = dbNames.filter(n => !screenshot.includes(n));

    console.log(`In screenshots but NOT in DB (${missing.length}):`);
    missing.forEach(n => console.log(`  MISSING: ${n}`));

    console.log(`\nIn DB but NOT in screenshots (${extra.length}):`);
    extra.forEach(n => {
        const a = dbMap[n];
        console.log(`  ${a.id_public}  ${a.name}  [${a.status}]  owner: ${a.ownerId_public}`);
    });

    await mongoose.disconnect();
})();
