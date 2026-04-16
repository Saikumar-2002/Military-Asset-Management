const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { db, createTransferTx } = require("../db");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "COMMANDER", "LOGISTICS"),
  (req, res) => {
    const { fromBaseId, toBaseId, assetId, quantity, notes } = req.body || {};
    if (!fromBaseId || !toBaseId || !assetId || typeof quantity !== "number") {
      return res.status(400).json({ error: "fromBaseId, toBaseId, assetId, quantity are required" });
    }

    const qty = Math.trunc(quantity);
    if (qty <= 0) return res.status(400).json({ error: "quantity must be > 0" });

    // RBAC:
    // - LOGISTICS: can only transfer from their own base
    // - COMMANDER/ADMIN: can transfer between bases
    if (req.user.role === "LOGISTICS" && req.user.baseId !== fromBaseId) {
      return res.status(403).json({ error: "Forbidden for transfer source base" });
    }
    try {
      const result = createTransferTx({
        fromBaseId,
        toBaseId,
        assetId: Number(assetId),
        quantity: qty,
        notes,
        createdBy: req.user.id
      });
      return res.json({ ok: true, transferId: result.id });
    } catch (err) {
      if (err && err.code === "INSUFFICIENT_INVENTORY") {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: "Failed to create transfer" });
    }
  }
);

router.get("/", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const { baseId, assetId, limit } = req.query || {};
  const lim = limit ? Number(limit) : 50;

  const isAdmin = req.user.role === "ADMIN";
  if (!isAdmin) {
    const effectiveBase = baseId || req.user.baseId;
    if (!effectiveBase || effectiveBase !== req.user.baseId) {
      return res.status(403).json({ error: "Forbidden for that base" });
    }

    return res.json({
      items: db
        .prepare(
          `
            SELECT t.id, t.from_base_id, t.to_base_id, t.asset_id, a.asset_type, a.name, a.unit,
                   t.quantity, t.notes, t.created_at, u.username AS created_by
            FROM transfers t
            JOIN assets a ON a.id = t.asset_id
            JOIN users u ON u.id = t.created_by
            WHERE t.from_base_id = ? OR t.to_base_id = ?
            ORDER BY t.created_at DESC
            LIMIT ?
          `
        )
        .all(req.user.baseId, req.user.baseId, lim)
    });
  }

  // Admin/explicit baseId filter
  const rows = db
    .prepare(
      `
      SELECT t.id, t.from_base_id, t.to_base_id, t.asset_id, a.asset_type, a.name, a.unit,
             t.quantity, t.notes, t.created_at, u.username AS created_by
      FROM transfers t
      JOIN assets a ON a.id = t.asset_id
      JOIN users u ON u.id = t.created_by
      WHERE
        (? IS NULL OR t.from_base_id = ? OR t.to_base_id = ?)
        AND (? IS NULL OR t.asset_id = ?)
      ORDER BY t.created_at DESC
      LIMIT ?
    `
    )
    .all(
      baseId || null,
      baseId || null,
      baseId || null,
      assetId ? Number(assetId) : null,
      assetId ? Number(assetId) : null,
      lim
    );
  return res.json({ items: rows });
});

module.exports = router;

