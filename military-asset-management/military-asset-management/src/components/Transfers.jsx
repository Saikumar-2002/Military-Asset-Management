import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Transfers({ token, user, baseId, bases }) {
  const [assets, setAssets] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fromBaseId, setFromBaseId] = useState(baseId);
  const [toBaseId, setToBaseId] = useState(bases && bases[0] ? bases[0].code : "");
  const [assetId, setAssetId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const isLogistics = user && user.role === "LOGISTICS";

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) return;
      try {
        const [aRes, tRes] = await Promise.all([
          fetch(`${API_BASE}/api/assets`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/transfers?baseId=${encodeURIComponent(baseId)}&limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        const aData = await aRes.json().catch(() => ({}));
        const tData = await tRes.json().catch(() => ({}));
        if (!aRes.ok) throw new Error(aData.error || "Failed to load assets");
        if (!tRes.ok) throw new Error(tData.error || "Failed to load transfers");
        if (cancelled) return;
        setAssets(aData.items || []);
        setRows(tData.items || []);
        if (!assetId && aData.items && aData.items[0]) setAssetId(String(aData.items[0].id));

        // Update defaults based on latest bases list.
        if (bases && bases.length > 0) {
          const defaultTo = bases.find((b) => b.code !== fromBaseId)?.code || bases[0].code;
          setToBaseId(defaultTo);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load transfers");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, baseId]);

  // Ensure the destination base gets initialized once `bases` is loaded.
  useEffect(() => {
    if (!bases || bases.length === 0) return;
    if (!toBaseId) {
      const candidate = bases.find((b) => b.code !== fromBaseId)?.code || bases[0].code;
      setToBaseId(candidate);
    }
  }, [bases, fromBaseId, toBaseId]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "LOGISTICS") {
      setFromBaseId(user.baseId || baseId);
    } else {
      setFromBaseId(baseId);
    }
  }, [user, baseId]);

  const selectedAsset = useMemo(() => assets.find((a) => String(a.id) === String(assetId)), [assets, assetId]);

  async function refresh() {
    const res = await fetch(`${API_BASE}/api/transfers?baseId=${encodeURIComponent(baseId)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to refresh transfers");
    setRows(data.items || []);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const q = Math.trunc(Number(quantity));
      if (!fromBaseId || !toBaseId) throw new Error("Select from/to bases");
      if (!assetId) throw new Error("Select an asset");
      if (!q || q <= 0) throw new Error("quantity must be > 0");

      const res = await fetch(`${API_BASE}/api/transfers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fromBaseId,
          toBaseId,
          assetId: Number(assetId),
          quantity: q,
          notes: notes || undefined
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create transfer");

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
        <h3 className="tactical-font" style={{ margin: 0 }}>Strategic Inter-Sector Transfers</h3>
        <div className="tactical-font" style={{ fontSize: "0.75rem", display: "flex", gap: "15px" }}>
          <span>COMMS: <span className="pulse" style={{ color: "var(--accent-color)" }}>ENCRYPTED</span></span>
          <span>SATELLITE LINK: LOCKED</span>
        </div>
      </div>
      
      {error && <div className="error-msg">{error}</div>}

      <div className="card hud-scan">
        <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div className="form-group">
            <label>Origin Sector</label>
            <select value={fromBaseId} onChange={(e) => setFromBaseId(e.target.value)} disabled={isLogistics}>
              {bases.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Destination Sector</label>
            <select value={toBaseId} onChange={(e) => setToBaseId(e.target.value)}>
              {bases.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>

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
            <label>Transfer Quantity</label>
            <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Transfer Directives</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Authorization code / Reason" />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <button disabled={loading} type="submit" className="btn-primary">
              {loading ? "AUTHORIZING TRANSFER..." : "EXECUTE STRATEGIC TRANSFER"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: "2.5rem" }}>
        <h4 className="tactical-font" style={{ marginBottom: "1rem", fontSize: "1rem" }}>Logistics Transfer History</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Execution Time</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Asset identity</th>
                <th>Qty</th>
                <th>Auth Officer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: "0.8rem", color: "var(--secondary-text)" }}>{r.created_at}</td>
                  <td className="tactical-font">{r.from_base_id}</td>
                  <td className="tactical-font" style={{ color: "var(--accent-color)" }}>{r.to_base_id}</td>
                  <td style={{ fontWeight: 500 }}>
                    <span style={{ color: "var(--secondary-text)", fontSize: "0.8rem" }}>{r.asset_type}</span> - {r.name}
                  </td>
                  <td className="tactical-font" style={{ color: "var(--accent-color)", fontSize: "1.1rem" }}>{r.quantity}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>{r.created_by}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "var(--secondary-text)" }}>
                    No recorded transfers in sector logs.
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

