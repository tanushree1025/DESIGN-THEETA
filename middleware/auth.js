const jwt = require("jsonwebtoken");

module.exports = function(req, res, next) {
  // Token is usually sent as: "Bearer <token>"
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ msg: "Access denied" });

  const token = authHeader.split(" ")[1]; // get token after 'Bearer'
  if (!token) return res.status(401).json({ msg: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // attach user info to request
    next();
  } catch(err) {
    console.error(err);
    res.status(400).json({ msg: "Invalid token" });
  }
};
