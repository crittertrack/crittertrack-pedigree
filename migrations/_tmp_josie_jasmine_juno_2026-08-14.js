const mongoose = require("mongoose");
require("dotenv").config();
const { Animal } = require("../database/models");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const names = ["Josie", "Jasmine", "Juno"];
  const publicIds = ["CTC6177", "CTC6178", "CTC6181"];
  const animals = await Animal.find({ id_public: { $in: publicIds } }).lean();
  for (const a of animals) {
    console.log(a.name, a.id_public, "gender:", a.gender, "geneticCode:", a.geneticCode, "sireId_public:", a.sireId_public, "damId_public:", a.damId_public);
  }
  const parentIds = [...new Set(animals.flatMap(a => [a.sireId_public, a.damId_public]).filter(Boolean))];
  const parents = await Animal.find({ id_public: { $in: parentIds } }).lean();
  console.log("--- PARENTS ---");
  for (const p of parents) {
    console.log(p.name, p.id_public, "gender:", p.gender, "geneticCode:", p.geneticCode);
  }
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
