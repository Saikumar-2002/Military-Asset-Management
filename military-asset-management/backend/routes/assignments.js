const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { db, createAssignmentTx } = require("../db");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "COMMANDER", "LOGISTICS"),
  (req, res) => {
    const { baseId, assetId, quantity, assignedTo, notes } = req.body || {};
    if (!baseId || !assetId || typeof quantity !== "number" || !assignedTo) {
      return res.status(400).json({
        error: "baseId, assetId, quantity, assignedTo are required"
      });
    }

    const qty = Math.trunc(quantity);
    if (qty <= 0) return res.status(400).json({ error: "quantity must be > 0" });

    // Non-admins can only assign from their own base.
    if (req.user.role !== "ADMIN") {
      if (req.user.baseId !== baseId) {
        return res.status(403).json({ error: "Forbidden for that base" });
      }
    }

    try {
      const result = createAssignmentTx({
        baseId,
        assetId: Number(assetId),
        quantity: qty,
        assignedTo,
        notes,
        createdBy: req.user.id
      });
      return res.json({ ok: true, assignmentId: result.id });
    } catch (err) {
      if (err && err.code === "INSUFFICIENT_INVENTORY") {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: "Failed to create assignment" });
    }
  }
);

router.get("/", requireAuth, requireRole("ADMIN", "COMMANDER", "LOGISTICS"), (req, res) => {
  const { baseId, assetId, limit } = req.query || {};
  const lim = limit ? Number(limit) : 50;

  if (req.user.role !== "ADMIN") {
    const effectiveBase = baseId || req.user.baseId;
    if (!effectiveBase || effectiveBase !== req.user.baseId) {
      return res.status(403).json({ error: "Forbidden for that base" });
    }
    const rows = db
      .prepare(
        `
        SELECT an.id, an.base_id, an.asset_id, a.asset_type, a.name, a.unit,
               an.quantity, an.assigned_to, an.notes, an.created_at, u.username AS created_by
        FROM assignments an
        JOIN assets a ON a.id = an.asset_id
        JOIN users u ON u.id = an.created_by
        WHERE an.base_id = ?
          AND (? IS NULL OR an.asset_id = ?)
        ORDER BY an.created_at DESC
        LIMIT ?
      `
      )
      .all(effectiveBase, assetId ? Number(assetId) : null, assetId ? Number(assetId) : null, lim);
    return res.json({ items: rows });
  }

  // ADMIN
  const rows = db
    .prepare(
      `
      SELECT an.id, an.base_id, an.asset_id, a.asset_type, a.name, a.unit,
             an.quantity, an.assigned_to, an.notes, an.created_at, u.username AS created_by
      FROM assignments an
      JOIN assets a ON a.id = an.asset_id
      JOIN users u ON u.id = an.created_by
      WHERE
        (? IS NULL OR an.base_id = ?)
        AND (? IS NULL OR an.asset_id = ?)
      ORDER BY an.created_at DESC
      LIMIT ?
    `
    )
    .all(baseId || null, baseId || null, assetId ? Number(assetId) : null, assetId ? Number(assetId) : null, lim);
  return res.json({ items: rows });
});

module.exports = router;

