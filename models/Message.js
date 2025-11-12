const mongoose = require("mongoose");
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  role: { type: String, enum: ["admin","designer","client"], required: true },
  message: { type: String },
  fileUrl: { type: String },
  type: { type: String, enum: ["text","file","audio"], default: "text" },
  timestamp: { type: Date, default: Date.now }
});
module.exports = mongoose.model("Message", MessageSchema);
