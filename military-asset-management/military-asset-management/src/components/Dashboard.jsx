import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Dashboard({ token, baseId }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token || !baseId) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/balances?baseId=${encodeURIComponent(baseId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
        if (!cancelled) setItems(data.items || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load balances");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, baseId]);

  const totals = useMemo(() => {
    const byType = {};
    for (const row of items) {
      const t = row.asset_type;
      byType[t] = (byType[t] || 0) + Number(row.quantity || 0);
    }
    return byType;
  }, [items]);

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
        <h3 className="tactical-font" style={{ margin: 0 }}>Strategic Asset Balances</h3>
        <div className="tactical-font" style={{ fontSize: "0.75rem", display: "flex", gap: "15px" }}>
          <span>STATUS: <span className="pulse" style={{ color: "var(--success-color)" }}>NOMINAL</span></span>
          <span>LINK: <span style={{ color: "var(--accent-color)" }}>ENCRYPTED</span></span>
          <span>SYSTEM TIME: {new Date().toISOString().substring(11, 19)} UTC</span>
        </div>
      </div>
      
      {loading && <div style={{ color: "var(--accent-color)", fontFamily: "var(--header-font)", padding: "10px", border: "1px dashed var(--accent-color)", marginBottom: "1rem" }}>
        <span className="pulse">>>> SCANNING INVENTORY SECTORS...</span>
      </div>}
      
      {error && <div className="error-msg">{error}</div>}

      <div className="stats-grid">
        {Object.keys(totals).map((k) => (
          <div key={k} className="stat-card hud-scan">
            <div className="stat-label">{k}</div>
            <div className="stat-value">{totals[k]}</div>
            <div style={{ height: "2px", background: "rgba(0, 255, 202, 0.1)", marginTop: "10px", position: "relative" }}>
               <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "70%", background: "var(--accent-color)", opacity: 0.3 }}></div>
            </div>
          </div>
        ))}
        {Object.keys(totals).length === 0 && !loading && (
          <div className="stat-card" style={{ gridColumn: "1 / -1", textAlign: "center", opacity: 0.5 }}>
            NO ASSET DATA DETECTED IN THIS SECTOR
          </div>
        )}
      </div>

      <div className="table-container hud-scan">
        <table>
          <thead>
            <tr>
              <th>Classification</th>
              <th>Asset Nomenclature</th>
              <th>Unit</th>
              <th>Available Qty</th>
              <th>Last Synced</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={`${row.base_id}-${row.asset_id}`}>
                <td style={{ color: "var(--secondary-text)", fontSize: "0.8rem" }}>{row.asset_type}</td>
                <td style={{ fontWeight: 500, letterSpacing: "0.5px" }}>{row.name}</td>
                <td>{row.unit}</td>
                <td className="tactical-font" style={{ color: "var(--accent-color)", fontSize: "1.1rem" }}>{row.quantity}</td>
                <td style={{ fontSize: "0.75rem", color: "var(--secondary-text)", fontFamily: "var(--header-font)" }}>{row.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: "1rem", display: "flex", gap: "10px" }}>
        <div style={{ background: "rgba(0, 255, 202, 0.05)", padding: "4px 10px", borderRadius: "2px", fontSize: "0.7rem", color: "var(--secondary-text)", border: "1px solid var(--border-color)" }}>
           LATENCY: 24ms
        </div>
        <div style={{ background: "rgba(0, 255, 202, 0.05)", padding: "4px 10px", borderRadius: "2px", fontSize: "0.7rem", color: "var(--secondary-text)", border: "1px solid var(--border-color)" }}>
           UPLINK: ACTIVE
        </div>
      </div>
    </div>
  );
}

