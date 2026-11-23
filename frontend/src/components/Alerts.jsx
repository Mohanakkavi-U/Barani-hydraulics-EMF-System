import { useState } from "react";

const SEV_ORDER = { critical: 0, warning: 1, info: 2 };

export default function Alerts({ alerts, onAcknowledge, onAcknowledgeBulk }) {
  const [filter, setFilter] = useState("all");
  const [showAcked, setShowAcked] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

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

  const unacknowledgedFiltered = filtered.filter(a => !a.acknowledged);
  const allSelected = unacknowledgedFiltered.length > 0 && unacknowledgedFiltered.every(a => selectedIds.includes(a.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unacknowledgedFiltered.map(a => a.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAck = () => {
    if (selectedIds.length === 0) return;
    onAcknowledgeBulk(selectedIds);
    setSelectedIds([]);
  };

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
          {crits.length > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--accent-red)", marginTop: 4, animation: "pulse-dot 1.5s infinite" }}>⚑ Requires immediate action</div>}
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
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {alerts.filter((a) => a.acknowledged).length} acknowledged
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card mb-20">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)", marginRight: 4, letterSpacing: 1 }}>FILTER:</div>
          {["all", "critical", "warning", "info"].map((f) => (
            <button key={f}
              className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "5px 14px", fontSize: 14 }}
              onClick={() => {
                setFilter(f);
                setSelectedIds([]); // Clear selection when filter changes to avoid confusion
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="showAcked" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)}
                style={{ accentColor: "var(--accent-cyan)" }} />
              <label htmlFor="showAcked" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)", cursor: "pointer" }}>
                Show acknowledged
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {unacknowledgedFiltered.length > 0 && (
        <div className="card mb-10" style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 15, 
          padding: "12px 18px", 
          background: "var(--bg-hover)", 
          border: "1px solid var(--border-bright)",
          boxShadow: "none"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input 
              type="checkbox" 
              checked={allSelected} 
              onChange={toggleSelectAll} 
              style={{ accentColor: "var(--accent-cyan)", width: 16, height: 16 }}
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-secondary)" }}>
              SELECT ALL ({unacknowledgedFiltered.length})
            </span>
          </div>
          
          {selectedIds.length > 0 && (
            <button 
              className="btn btn-primary" 
              style={{ padding: "4px 12px", fontSize: 14, background: "var(--accent-cyan)", color: "var(--bg-main)" }}
              onClick={handleBulkAck}
            >
              ✓ ACKNOWLEDGE SELECTED ({selectedIds.length})
            </button>
          )}
        </div>
      )}

      {/* Alerts list */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚑ Alert Log</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>{filtered.length} shown</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 0" }}>
            <div className="empty-icon">✓</div>
            <div className="empty-text">{filter === "all" ? "No alerts to show" : `No ${filter} alerts`}</div>
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className={`alert-item ${a.acknowledged ? "acknowledged" : a.severity}`} style={{ display: "flex", alignItems: "center" }}>
              {!a.acknowledged && (
                <div style={{ padding: "0 10px 0 5px" }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(a.id)} 
                    onChange={() => toggleSelect(a.id)}
                    style={{ accentColor: "var(--accent-cyan)", width: 15, height: 15 }}
                  />
                </div>
              )}
              {a.acknowledged && <div style={{ width: 30 }}></div>}
              
              <div className="alert-icon-wrap">
                {a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"}
              </div>
              <div className="alert-content" style={{ flex: 1 }}>
                <div className="alert-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {a.machine_name && (
                    <span style={{ 
                      padding: "2px 6px", 
                      background: "var(--bg-deep)", 
                      borderRadius: "4px", 
                      fontSize: "11px", 
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-dim)"
                    }}>
                      {a.machine_name}
                    </span>
                  )}
                  {a.parameter}
                </div>
                <div className="alert-desc">{a.message}</div>
                <div className="alert-meta">
                  {new Date(a.created_at).toLocaleString("en-IN")}
                </div>
              </div>
              {!a.acknowledged && (
                <button className="alert-ack-btn" onClick={() => onAcknowledge(a.id)} style={{ marginLeft: 10 }}>
                  ✓ ACK
                </button>
              )}
              {a.acknowledged && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)", marginLeft: 10 }}>Acknowledged</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
