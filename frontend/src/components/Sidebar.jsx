import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "dashboard", icon: "⬡", label: "Dashboard" },
  { id: "input",     icon: "⊕", label: "Data Entry" },
  { id: "historical",icon: "◷", label: "Historical" },
  { id: "alerts",    icon: "⚑", label: "Alerts" },
];

export default function Sidebar({ activePage, setActivePage, unreadAlerts }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (d) =>
    d.toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = (d) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <div className="logo-bolt">⚡</div>
          <div className="logo-text">ENERGY<br/>MONITOR</div>
        </div>
        <div className="logo-sub">v1.0 · Machine Shop</div>
      </div>

      <div className="sidebar-status">
        <div className="status-dot" />
        <span className="status-label">System Online</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? "active" : ""}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === "alerts" && unreadAlerts > 0 && (
              <span className="nav-badge">{unreadAlerts}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-time" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--accent-cyan)", letterSpacing: 1, marginBottom: 2 }}>
          {fmt(time)}
        </div>
        <div className="sidebar-time">{fmtDate(time)}</div>
      </div>
    </aside>
  );
}
