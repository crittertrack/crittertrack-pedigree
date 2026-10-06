require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB_NAME || undefined);
  const A = db.collection("animals");
  const t = await A.findOne({ id_public: "CTC922" }, { projection: { id_public:1,name:1,species:1,gender:1,sireId_public:1,damId_public:1,creatorId_public:1 } });
  console.log("CTC922 record:", JSON.stringify(t, null, 1));
  const asSire = await A.countDocuments({ sireId_public: "CTC922" });
  const asDam  = await A.countDocuments({ damId_public: "CTC922" });
  console.log("animals listing CTC922 as sire:", asSire, "| as dam:", asDam);
  const near = await A.find({ $or:[{sireId_public:"CTC922"},{damId_public:"CTC922"}] }, { projection:{id_public:1,name:1,species:1,creatorId_public:1,isOwned:1,archived:1}, limit: 15 }).toArray();
  console.log("direct children:", JSON.stringify(near, null, 1));
  await c.close();
})();
