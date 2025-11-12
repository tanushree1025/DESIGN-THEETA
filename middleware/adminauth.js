const jwt = require("jsonwebtoken");

module.exports = function(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ msg: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    if (verified.role !== "admin") return res.status(403).json({ msg: "Admins only" });

    req.user = verified;
    next();
  } catch(err) {
    res.status(400).json({ msg: "Invalid token" });
  }
};
