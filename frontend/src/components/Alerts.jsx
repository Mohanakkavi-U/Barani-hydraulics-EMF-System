import { useState } from "react";

const SEV_ORDER = { critical: 0, warning: 1, info: 2 };

export default function Alerts({ alerts, onAcknowledge }) {
  const [filter, setFilter] = useState("all");
  const [showAcked, setShowAcked] = useState(false);

  const filtered = alerts
    .filter((a) => {
      if (!showAcked && a.acknowledged) return false;
      if (filter === "all") return true;
      return a.severity === filter;
    })
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3));

  const unread = alerts.filter((a) => !a.acknowledged);
  const crits = unread.filter((a) => a.severity === "critical");
  const warns = unread.filter((a) => a.severity === "warning");

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Alerts <span>& Alarms</span></div>
        <div className="page-subtitle">System threshold violations · real-time</div>
      </div>

      {/* Summary strip */}
      <div className="grid-3 mb-20">
        <div className="card" style={{ borderColor: crits.length ? "rgba(239,68,68,0.4)" : undefined }}>
          <div className="metric-label">Critical Alerts</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, color: crits.length ? "var(--accent-red)" : "var(--text-muted)" }}>
            {crits.length}
          </div>
          {crits.length > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-red)", marginTop: 4, animation: "pulse-dot 1.5s infinite" }}>⚑ Requires immediate action</div>}
        </div>
        <div className="card" style={{ borderColor: warns.length ? "rgba(245,158,11,0.4)" : undefined }}>
          <div className="metric-label">Warnings</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, color: warns.length ? "var(--accent-amber)" : "var(--text-muted)" }}>
            {warns.length}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Total Alerts</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, color: "var(--text-secondary)" }}>
            {alerts.length}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            {alerts.filter((a) => a.acknowledged).length} acknowledged
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card mb-20">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginRight: 4, letterSpacing: 1 }}>FILTER:</div>
          {["all", "critical", "warning", "info"].map((f) => (
            <button key={f}
              className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "5px 14px", fontSize: 11 }}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="showAcked" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)}
              style={{ accentColor: "var(--accent-cyan)" }} />
            <label htmlFor="showAcked" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
              Show acknowledged
            </label>
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚑ Alert Log</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} shown</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <div className="empty-text">{filter === "all" ? "No alerts to show" : `No ${filter} alerts`}</div>
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className={`alert-item ${a.acknowledged ? "acknowledged" : a.severity}`}>
              <div className="alert-icon-wrap">
                {a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}
              </div>
              <div className="alert-content">
                <div className="alert-title">{a.parameter}</div>
                <div className="alert-desc">{a.message}</div>
                <div className="alert-meta">
                  Value: <span style={{ color: "var(--text-primary)" }}>{a.value?.toFixed(3)}</span>
                  &nbsp;·&nbsp;Threshold: {a.threshold}
                  &nbsp;·&nbsp;{new Date(a.created_at).toLocaleString("en-IN")}
                </div>
              </div>
              {!a.acknowledged && (
                <button className="alert-ack-btn" onClick={() => onAcknowledge(a.id)}>
                  ✓ ACK
                </button>
              )}
              {a.acknowledged && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>Acknowledged</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
