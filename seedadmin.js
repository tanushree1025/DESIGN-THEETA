require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

async function seedAdmin() {
  const existing = await User.findOne({ email: "admin@domain.com" });
  if(existing) return console.log("Admin already exists");

  const admin = new User({
    name: "Super Admin",
    email: "admin@domain.com",
    password: "Admin@123", // will be hashed automatically
    role: "admin"
  });

  await admin.save();
  console.log("✅ Admin created");
  mongoose.disconnect();
}

seedAdmin();
