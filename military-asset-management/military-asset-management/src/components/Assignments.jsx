import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Assignments({ token, baseId }) {
  const [assets, setAssets] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [assetId, setAssetId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token || !baseId) return;
      try {
        const [aRes, rRes] = await Promise.all([
          fetch(`${API_BASE}/api/assets`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/assignments?baseId=${encodeURIComponent(baseId)}&limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        const aData = await aRes.json().catch(() => ({}));
        const rData = await rRes.json().catch(() => ({}));
        if (!aRes.ok) throw new Error(aData.error || "Failed to load assets");
        if (!rRes.ok) throw new Error(rData.error || "Failed to load assignments");
        if (!cancelled) {
          setAssets(aData.items || []);
          setRows(rData.items || []);
          if (!assetId && aData.items && aData.items[0]) setAssetId(String(aData.items[0].id));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load data");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, baseId]);

  const selectedAsset = useMemo(
    () => assets.find((a) => String(a.id) === String(assetId)),
    [assets, assetId]
  );

  async function refresh() {
    const rRes = await fetch(`${API_BASE}/api/assignments?baseId=${encodeURIComponent(baseId)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rData = await rRes.json().catch(() => ({}));
    if (!rRes.ok) throw new Error(rData.error || "Failed to refresh assignments");
    setRows(rData.items || []);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const q = Math.trunc(Number(quantity));
      if (!baseId) throw new Error("baseId missing");
      if (!assetId) throw new Error("Select an asset");
      if (!assignedTo.trim()) throw new Error("assignedTo is required");
      if (!q || q <= 0) throw new Error("quantity must be > 0");

      const res = await fetch(`${API_BASE}/api/assignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          baseId,
          assetId: Number(assetId),
          quantity: q,
          assignedTo: assignedTo.trim(),
          notes: notes || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create assignment");

      setAssignedTo("");
      setNotes("");
      setQuantity(1);
      await refresh();
    } catch (e) {
      setError(e.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
        <h3 className="tactical-font" style={{ margin: 0 }}>Unit Deployment & Assignments</h3>
        <div className="tactical-font" style={{ fontSize: "0.75rem", display: "flex", gap: "15px" }}>
          <span>OPS: <span className="pulse" style={{ color: "var(--accent-color)" }}>IN PROGRESS</span></span>
          <span>BATTLE-NET: ACTIVE</span>
        </div>
      </div>
      
      {error && <div className="error-msg">{error}</div>}

      <div className="card hud-scan">
        <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div className="form-group">
            <label>Strategic Asset</label>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.asset_type}] {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Deployment Quantity</label>
            <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Assigned Recipient</label>
            <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Unit/Vehicle/Operator" />
          </div>

          <div className="form-group">
            <label>Deployment Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional directives" />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <button disabled={loading} type="submit" className="btn-primary">
              {loading ? "INITIALIZING DEPLOYMENT..." : "EXECUTE ASSIGNMENT"}
            </button>
          </div>
        </form>
      </div>

      {selectedAsset && (
        <div style={{ marginTop: "10px", fontSize: "0.75rem", color: "var(--accent-color)", fontFamily: "var(--header-font)" }}>
          SPECIFICATION: [{selectedAsset.asset_type}] {selectedAsset.name} READY FOR DISPATCH.
        </div>
      )}

      <div style={{ marginTop: "2.5rem" }}>
        <h4 className="tactical-font" style={{ marginBottom: "1rem", fontSize: "1rem" }}>Deployment Manifest</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Dispatch Time</th>
                <th>Asset Identity</th>
                <th>Qty</th>
                <th>Recipient Unit</th>
                <th>Operational Notes</th>
                <th>Dispatcher</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: "0.8rem", color: "var(--secondary-text)" }}>{r.created_at}</td>
                  <td style={{ fontWeight: 500 }}>
                    <span style={{ color: "var(--secondary-text)", fontSize: "0.8rem" }}>{r.asset_type}</span> - {r.name}
                  </td>
                  <td className="tactical-font" style={{ color: "var(--accent-color)", fontSize: "1.1rem" }}>{r.quantity}</td>
                  <td style={{ fontWeight: 600, color: "var(--primary-text)" }}>{r.assigned_to}</td>
                  <td style={{ fontSize: "0.9rem" }}>{r.notes || "---"}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>{r.created_by}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "var(--secondary-text)" }}>
                    No active deployments found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

