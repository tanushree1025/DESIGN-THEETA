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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use("/api/auth", authRoutes);

// Serve frontend
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "admin.html")));
app.get("/employee", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "employee.html")));
app.get("/client", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "client.html")));

// MongoDB connection
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

const onlineUsers = {};

// Socket.IO auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Auth error"));
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user;
    next();
  } catch {
    next(new Error("Auth error"));
  }
});

// Socket.IO connection
io.on("connection", async (socket) => {
  const { id, user } = socket;
  console.log(`${user.name} (${user.role}) connected`);

  onlineUsers[id] = user;

  // Function to get online status for a list of users
  const formatUsers = (users) =>
    users.map(u => ({
      name: u.name,
      role: u.role,
      online: Object.values(onlineUsers).some(o => o.id === String(u._id))
    }));

  // Emit online users based on role
  if (user.role === "admin") {
    const allUsers = await User.find();
    socket.emit("onlineUsers", formatUsers(allUsers));
  } else if (user.role === "designer" || user.role === "client") {
    const dbUser = await User.findById(user.id).populate("assignedUsers");
    if (dbUser.assignedUsers) socket.emit("onlineUsers", formatUsers(dbUser.assignedUsers));
  }

  // Load last 100 messages
  const messages = await Message.find({}).sort({ timestamp: 1 }).limit(100);
  socket.emit("previousMessages", messages);

  // Listen for messages
  socket.on("chatMessage", async (data) => {
    const msg = new Message({
      sender: user.id,
      role: user.role,
      message: data.message,
      receiver: data.receiver || null
    });
    await msg.save();

    // Determine recipients
    Object.values(io.sockets.sockets).forEach(s => {
      if (
        s.user.role === "admin" || // Admin sees all
        s.user.id === user.id ||   // Sender sees own message
        (data.receiver && s.user.id === data.receiver) // Targeted receiver
      ) {
        s.emit("chatMessage", {
          sender: user.name,
          role: user.role,
          message: data.message,
          timestamp: msg.timestamp
        });
      }
    });
  });

  // Typing indicator
  socket.on("typing", (data) => {
    Object.values(io.sockets.sockets).forEach(s => {
      if (
        s.user.role === "admin" ||
        s.user.id === user.id ||
        (data.receiver && s.user.id === data.receiver)
      ) {
        s.emit("typing", { sender: user.name });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log(`${user.name} disconnected`);
    delete onlineUsers[id];
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
