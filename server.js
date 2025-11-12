require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Message = require("./models/Message");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());

// Serve uploaded files (including voice)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);

// Basic health check
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date() }));

// Connect to MongoDB
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/design-theeta";
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("🔴 MongoDB connection error:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const onlineUsers = new Map();

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers && socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(" ")[1]);
    if (!token) return next(new Error("Authentication error: token required"));
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    const user = await User.findById(payload.id).select("-password");
    if (!user) return next(new Error("Authentication error: user not found"));
    socket.user = user;
    return next();
  } catch (err) {
    console.error("Socket auth error:", err && err.message);
    return next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const user = socket.user;
  console.log(`🔌 ${user.name} connected, id=${user._id}`);
  onlineUsers.set(String(user._id), { id: String(user._id), name: user.name, role: user.role });

  io.emit("onlineUsers", Array.from(onlineUsers.values()));

  socket.join(String(user._id));

  // send last 50 messages
  Message.find().sort({ timestamp: -1 }).limit(50).populate("sender", "name role").then(msgs => {
    socket.emit("previousMessages", msgs.reverse().map(m => ({
      _id: m._id,
      sender: m.sender ? { id: m.sender._id, name: m.sender.name, role: m.sender.role } : null,
      role: m.role,
      message: m.message,
      fileUrl: m.fileUrl,
      type: m.type,
      timestamp: m.timestamp
    })));
  }).catch(err=>console.error("Failed to load msgs",err));

  socket.on("chatMessage", async (data) => {
    try {
      const msg = new Message({
        sender: user._id,
        receiver: data.receiver || null,
        role: user.role,
        message: data.message || "",
        fileUrl: data.fileUrl || "",
        type: data.type || (data.fileUrl ? "file" : "text"),
        timestamp: new Date()
      });
      const saved = await msg.save();
      const populated = await Message.findById(saved._id).populate("sender", "name role");
      const emitObj = {
        _id: populated._id,
        sender: populated.sender ? { id: populated.sender._id, name: populated.sender.name, role: populated.sender.role } : null,
        role: populated.role,
        message: populated.message,
        fileUrl: populated.fileUrl,
        type: populated.type,
        timestamp: populated.timestamp
      };
      socket.emit("chatMessage", emitObj);
      if (data.receiver) {
        io.to(String(data.receiver)).emit("chatMessage", emitObj);
      } else {
        socket.broadcast.emit("chatMessage", emitObj);
        io.emit("chatMessage", emitObj);
      }
    } catch (err) {
      console.error("Error saving chat message:", err);
      socket.emit("error", { msg: "Failed to send message" });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(String(user._id));
    io.emit("onlineUsers", Array.from(onlineUsers.values()));
    console.log(`🔌 ${user.name} disconnected`);
  });
});

// serve public files
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "login.html")));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
