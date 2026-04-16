const jwt = require("jsonwebtoken");
const { getUserById } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "Invalid token (user not found)" });
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      baseId: user.base_id || null
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

function isAdmin(req) {
  return req.user && req.user.role === "ADMIN";
}

function enforceBaseMatches(req, baseId, res) {
  // Non-admins can only operate on their own base.
  if (isAdmin(req)) return true;
  if (!req.user.baseId) return false;
  return req.user.baseId === baseId;
}

module.exports = {
  JWT_SECRET,
  requireAuth,
  requireRole,
  enforceBaseMatches
};

