import React, { useEffect, useMemo, useState } from "react";
import Dashboard from "./components/Dashboard.jsx";
import Purchases from "./components/Purchases.jsx";
import Transfers from "./components/Transfers.jsx";
import Assignments from "./components/Assignments.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function readToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function writeToken(token) {
  try {
    localStorage.setItem("token", token);
  } catch {
    // ignore
  }
}

function clearToken() {
  try {
    localStorage.removeItem("token");
  } catch {
    // ignore
  }
}

async function apiFetch(path, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export default function App() {
  const [token, setToken] = useState(readToken());
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState("dashboard");
  const [bases, setBases] = useState([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");

  const effectiveBaseId = useMemo(() => {
    if (!user) return "";
    if (user.role === "ADMIN" || user.role === "COMMANDER") {
      return selectedBaseId || user.baseId || "";
    }
    return user.baseId || "";
  }, [selectedBaseId, user]);

  async function refreshMe(nextToken) {
    const me = await apiFetch("/api/auth/me", { token: nextToken });
    setUser(me.user);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) return;
      try {
        await refreshMe(token);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to authenticate");
          setToken("");
          clearToken();
          setUser(null);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) return;
      try {
        const me = await refreshMe(token);
        if (!cancelled) return me;
      } catch {
        // handled elsewhere
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token || !user) return;
      try {
        const res = await apiFetch("/api/bases", { token });
        if (!cancelled) setBases(res.items || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load bases");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    if (!user) return;
    // Preselect base for admin/commander.
    if (user.role === "ADMIN" || user.role === "COMMANDER") {
      setSelectedBaseId(user.baseId || (bases[0] ? bases[0].code : ""));
    } else {
      setSelectedBaseId(user.baseId || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bases]);

  async function onLogin(username, password) {
    setError("");
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { username, password }
    });
    const nextToken = res.token;
    setToken(nextToken);
    writeToken(nextToken);
    await refreshMe(nextToken);
    setActive("dashboard");
  }

  function onLogout() {
    clearToken();
    setToken("");
    setUser(null);
    setBases([]);
    setSelectedBaseId("");
  }

  if (!token || !user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2 className="tactical-font">Military Asset Mgmt</h2>
          <p style={{ color: "var(--secondary-text)", marginBottom: "2rem", fontSize: "0.9rem" }}>
            Authorized Personnel Only. Log in to manage base assets.
          </p>
          <LoginForm onLogin={onLogin} error={error} />
          <div className="demo-users">
            DEMO CREDENTIALS:
            <div>
              <code>admin / admin123</code> (High Command)
            </div>
            <div>
              <code>commander / commander123</code> (Base Commander)
            </div>
            <div>
              <code>logistics_a / logistics123</code> (Logistics Officer)
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="top-bar">
        <div>
          <h2 className="tactical-font" style={{ margin: 0, color: "var(--accent-color)" }}>Tactical Asset Command</h2>
          <div style={{ fontSize: "0.8rem", color: "var(--secondary-text)", marginTop: "4px" }}>
            SECURE LINK ESTABLISHED: <span style={{ color: "var(--accent-color)" }}>{user.username}</span> | ROLE: <span style={{ color: "var(--accent-color)" }}>{user.role}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {(user.role === "ADMIN" || user.role === "COMMANDER") && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ margin: 0, textTransform: "uppercase", fontSize: "0.7rem", color: "var(--secondary-text)" }}>Deployment Sector:</label>
              <select 
                value={effectiveBaseId} 
                onChange={(e) => setSelectedBaseId(e.target.value)}
                style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem" }}
              >
                {bases.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="logout-btn" onClick={onLogout}>Terminate Session</button>
        </div>
      </header>

      <main className="main-content">
        <div className="nav-container">
          <button 
            className={`nav-button ${active === "dashboard" ? "active" : ""}`}
            onClick={() => setActive("dashboard")}
          >
            Tactical Overview
          </button>
          <button 
            className={`nav-button ${active === "purchases" ? "active" : ""}`}
            onClick={() => setActive("purchases")}
          >
            Procurement & Logistics
          </button>
          <button 
            className={`nav-button ${active === "assignments" ? "active" : ""}`}
            onClick={() => setActive("assignments")}
          >
            Unit Assignments
          </button>
          <button 
            className={`nav-button ${active === "transfers" ? "active" : ""}`}
            onClick={() => setActive("transfers")}
          >
            Strategic Transfers
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="view-container">
          {active === "dashboard" && <Dashboard token={token} baseId={effectiveBaseId} />}
          {active === "purchases" && <Purchases token={token} baseId={effectiveBaseId} />}
          {active === "assignments" && <Assignments token={token} baseId={effectiveBaseId} />}
          {active === "transfers" && <Transfers token={token} user={user} baseId={effectiveBaseId} bases={bases} />}
        </div>
      </main>
    </div>
  );
}

function LoginForm({ onLogin, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onLogin(username, password);
        } catch (err) {
          // error displayed by parent
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-group">
        <label>Operator Identification</label>
        <input 
          placeholder="USERNAME"
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          required
        />
      </div>
      <div className="form-group">
        <label>Security Clearance Code</label>
        <input 
          type="password" 
          placeholder="PASSWORD"
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required
        />
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Authorizing..." : "Initialize Command"}
      </button>
      {error && <div className="error-msg" style={{ marginTop: "1rem" }}>{error}</div>}
    </form>
  );
}

