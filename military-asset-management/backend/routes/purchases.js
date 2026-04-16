const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listBases, listAssets, db, createPurchaseTx, listBalancesForBase } = require("../db");

const router = express.Router();

// Purchases increase inventory (quantity > 0) by default.
// For flexibility, quantity can be any integer, but inventory will never drop below 0.
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "COMMANDER", "LOGISTICS"),
  (req, res) => {
    const { baseId, assetId, quantity, notes } = req.body || {};
    if (!baseId || !assetId || typeof quantity !== "number") {
      return res.status(400).json({ error: "baseId, assetId, quantity are required" });
    }

    const qty = Math.trunc(quantity);
    if (qty === 0) return res.status(400).json({ error: "quantity must be non-zero" });

    if (req.user.role !== "ADMIN") {
      if (req.user.baseId !== baseId) {
        return res.status(403).json({ error: "Forbidden for that base" });
      }
    }

    try {
      const result = createPurchaseTx({
        baseId,
        assetId: Number(assetId),
        quantity: qty,
        notes,
        createdBy: req.user.id
      });
      return res.json({ ok: true, purchaseId: result.id });
    } catch (err) {
      if (err && err.code === "INSUFFICIENT_INVENTORY") {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: "Failed to create purchase" });
    }
  }
);

router.get("/", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const { baseId, assetId, limit } = req.query || {};

  if (req.user.role !== "ADMIN") {
    if (!baseId) return res.status(400).json({ error: "baseId query parameter is required" });
    if (req.user.baseId !== baseId) return res.status(403).json({ error: "Forbidden for that base" });
  }

  const rows = db
    .prepare(
      `
      SELECT p.id, p.base_id, p.asset_id, a.asset_type, a.name, a.unit, p.quantity, p.notes, p.created_at, u.username AS created_by
      FROM purchases p
      JOIN assets a ON a.id = p.asset_id
      JOIN users u ON u.id = p.created_by
      WHERE (? IS NULL OR p.base_id = ?)
        AND (? IS NULL OR p.asset_id = ?)
      ORDER BY p.created_at DESC
      LIMIT ?
    `
    )
    .all(baseId || null, baseId || null, assetId ? Number(assetId) : null, assetId ? Number(assetId) : null, limit ? Number(limit) : 50);

  return res.json({ items: rows });
});

// Convenience endpoints used by the frontend.
router.get("/bases", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const bases = listBases();
  return res.json({ items: bases });
});

router.get("/assets", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const assets = listAssets();
  return res.json({ items: assets });
});

router.get("/balances", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const { baseId } = req.query || {};
  if (req.user.role !== "ADMIN" && req.user.baseId !== baseId) {
    return res.status(403).json({ error: "Forbidden for that base" });
  }
  if (!baseId && req.user.baseId) {
    return res.json({ items: listBalancesForBase(req.user.baseId) });
  }
  if (!baseId) return res.status(400).json({ error: "baseId is required" });
  return res.json({ items: listBalancesForBase(baseId) });
});

module.exports = router;

