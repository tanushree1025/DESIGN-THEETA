const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const voiceDir = path.join(uploadDir, "voice");
if(!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req,file,cb) => {
    // if audio, put in voice folder
    if(file.mimetype && file.mimetype.startsWith("audio")) cb(null, voiceDir);
    else cb(null, uploadDir);
  },
  filename: (req,file,cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage, limits: { fileSize: 150 * 1024 * 1024 } });

router.post("/", upload.single("file"), (req,res)=>{
  if(!req.file) return res.status(400).json({ msg: "No file uploaded" });
  const fileUrl = "/uploads/" + (req.file.destination.includes("voice") ? ("voice/" + req.file.filename) : req.file.filename);
  res.json({ fileUrl });
});

module.exports = router;
