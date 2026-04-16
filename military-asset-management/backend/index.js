const path = require("path");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const dotenv = require("dotenv");

const { requireAuth, JWT_SECRET, requireRole } = require("./middleware/auth");
const {
  getUserByUsername,
  listBases,
  listAssets,
  listBalancesForBase
} = require("./db");

const purchasesRouter = require("./routes/purchases");
const transfersRouter = require("./routes/transfers");
const assignmentsRouter = require("./routes/assignments");

const app = express();
app.use(cors());
app.use(express.json());

// Load env vars for local development.
dotenv.config({ path: path.join(__dirname, ".env") });

// Support for production deployment (Serving Frontend)
const frontendDist = path.join(__dirname, "../military-asset-management/dist");
app.use(express.static(frontendDist));

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

app.get("/health", (req, res) => res.json({ ok: true }));

// Auth endpoints
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const user = getUserByUsername(username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const passwordHash = sha256(password);
  if (passwordHash !== user.password_hash) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "8h" });
  return res.json({ token, user: { id: user.id, username: user.username, role: user.role, baseId: user.base_id || null } });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// Data endpoints used by frontend (read-only)
app.get("/api/bases", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  return res.json({ items: listBases() });
});

app.get("/api/assets", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  return res.json({ items: listAssets() });
});

app.get("/api/balances", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const { baseId } = req.query || {};
  if (req.user.role !== "ADMIN") {
    const effective = baseId || req.user.baseId;
    if (!effective || effective !== req.user.baseId) {
      return res.status(403).json({ error: "Forbidden for that base" });
    }
    return res.json({ items: listBalancesForBase(effective) });
  }
  if (!baseId) return res.status(400).json({ error: "baseId is required for ADMIN" });
  return res.json({ items: listBalancesForBase(baseId) });
});

// Protected inventory routes
app.use("/api/purchases", purchasesRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/assignments", assignmentsRouter);

// For production builds, serve index.html for any non-API routes (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      res.status(500).send("Frontend build not found. Run 'npm run build' in the frontend folder.");
    }
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const host = "0.0.0.0"; // Required for many deployment platforms

app.listen(port, host, () => {
  console.log(`MILITARY Asset API listening on http://${host}:${port}`);
});

