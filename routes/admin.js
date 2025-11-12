const express = require("express");
const router = express.Router();
const User = require("../models/User");
const adminAuth = require("../middleware/adminauth");

// Protected: Only admins
router.post("/create-admin", adminAuth, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: "User already exists" });

    const newAdmin = new User({ name, email, password, role: "admin" });
    await newAdmin.save();

    res.status(201).json({ msg: "Admin created", admin: { name: newAdmin.name, email: newAdmin.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
