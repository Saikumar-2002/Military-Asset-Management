import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Purchases({ token, baseId }) {
  const [assets, setAssets] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [assetId, setAssetId] = useState("");
  const [kind, setKind] = useState("PURCHASE"); // PURCHASE | EXPENDITURE
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) return;
      try {
        const [aRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/api/assets`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/purchases?baseId=${encodeURIComponent(baseId)}&limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        const aData = await aRes.json().catch(() => ({}));
        const pData = await pRes.json().catch(() => ({}));
        if (!aRes.ok) throw new Error(aData.error || "Failed to load assets");
        if (!pRes.ok) throw new Error(pData.error || "Failed to load purchases");
        if (!cancelled) {
          setAssets(aData.items || []);
          setRows(pData.items || []);
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

  const selectedAsset = useMemo(() => assets.find((a) => String(a.id) === String(assetId)), [assets, assetId]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const q = Math.trunc(Number(quantity));
      if (!assetId) throw new Error("Select an asset");
      if (!q || q <= 0) throw new Error("Quantity must be > 0");

      const signedQty = kind === "EXPENDITURE" ? -q : q;

      const res = await fetch(`${API_BASE}/api/purchases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          baseId,
          assetId: Number(assetId),
          quantity: signedQty,
          notes: notes || undefined
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create purchase");

      // Refresh list
      const pRes = await fetch(`${API_BASE}/api/purchases?baseId=${encodeURIComponent(baseId)}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pData = await pRes.json().catch(() => ({}));
      if (!pRes.ok) throw new Error(pData.error || "Failed to reload purchases");
      setRows(pData.items || []);
      setNotes("");
      setQuantity(1);
    } catch (e) {
      setError(e.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
        <h3 className="tactical-font" style={{ margin: 0 }}>Procurement & Expenditure Logs</h3>
        <div className="tactical-font" style={{ fontSize: "0.75rem", display: "flex", gap: "15px" }}>
          <span>LOG: <span className="pulse" style={{ color: "var(--accent-color)" }}>STREAMING</span></span>
          <span>SECURE UPLINK: YES</span>
        </div>
      </div>
      
      {error && <div className="error-msg">{error}</div>}

      <div className="card hud-scan">
        <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div className="form-group">
            <label>Asset Classification</label>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.asset_type}] {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Transaction Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="PURCHASE">Procurement (Stock In)</option>
              <option value="EXPENDITURE">Expenditure (Stock Out)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Unit Quantity</label>
            <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Tactical Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Entry rationale" />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <button disabled={loading} type="submit" className="btn-primary">
              {loading ? "LOGGING TRANSACTION..." : kind === "EXPENDITURE" ? "COMMIT EXPENDITURE" : "COMMIT PROCUREMENT"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: "2.5rem" }}>
        <h4 className="tactical-font" style={{ marginBottom: "1rem", fontSize: "1rem" }}>Mission Log: Recent Records</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Asset Identity</th>
                <th>Net Change</th>
                <th>Notes</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: "0.8rem", color: "var(--secondary-text)" }}>{r.created_at}</td>
                  <td style={{ fontWeight: 500 }}>
                    <span style={{ color: "var(--secondary-text)", fontSize: "0.8rem" }}>{r.asset_type}</span> - {r.name}
                  </td>
                  <td className="tactical-font" style={{ 
                    color: r.quantity < 0 ? "var(--danger-color)" : "var(--success-color)",
                    fontSize: "1.1rem"
                  }}>
                    {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>{r.notes || "---"}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>{r.created_by}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "var(--secondary-text)" }}>
                    No mission records found in current sector.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--secondary-text)", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
        SYSTEM NOTIFICATION: All inventory adjustments are atomic and logged with cryptographic operator signatures.
      </div>
    </div>
  );
}

