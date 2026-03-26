import { useMemo, useState } from "react";

function GaugeRing({ value, max, color, label, unit }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="gauge-wrap">
      <div className="gauge-ring">
        <svg viewBox="0 0 100 100" width="100" height="100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-dim)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="gauge-ring-text">
          <span style={{ color }}>{value != null ? value.toFixed(1) : "—"}</span>
          <span className="gauge-ring-unit">{unit}</span>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function Sparkline({ data, color, height = 48 }) {
  if (!data || data.length < 2) return <div style={{ height, background: "var(--border-dim)", borderRadius: 3, opacity: 0.3 }} />;

  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 280;
  const h = height;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts.join(" ")}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <polygon
        fill={`url(#sg-${color.replace("#", "")})`}
        points={`0,${h} ${pts.join(" ")} ${w},${h}`}
      />
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MetricCard({ label, value, unit, color, icon, trend, sparkData }) {
  const clsMap = { "#00d4ff": "cyan", "#f59e0b": "amber", "#10b981": "green", "#8b5cf6": "purple", "#ef4444": "red", "#14b8a6": "teal" };
  const cls = clsMap[color] || "cyan";

  return (
    <div className={`metric-card ${cls}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-label">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
        <span className="metric-value">{value != null ? (typeof value === "number" ? value.toFixed(2) : value) : "—"}</span>
        <span className="metric-unit">{unit}</span>
      </div>
      {trend && <div className="metric-trend">{trend}</div>}
      {sparkData && (
        <div style={{ marginTop: 10 }}>
          <Sparkline data={sparkData} color={color} height={40} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ readings, latestReading, alerts, machines, onToggleStatus, onAddMachine }) {
  const [selectedForSum, setSelectedForSum] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMachine, setNewMachine] = useState({ name: "", photo_url: "" });

  const getLatestForMachine = (id) => {
    const machineReadings = readings.filter(r => r.machine_id === id);
    return machineReadings.length > 0 ? machineReadings[machineReadings.length - 1] : null;
  };

  const summedMetrics = useMemo(() => {
    let power = 0;
    let energy = 0;
    let voltage = 0;
    let count = 0;

    selectedForSum.forEach(id => {
      const last = getLatestForMachine(id);
      if (last) {
        power += (last.power_kw || 0);
        energy += (last.energy_kwh || 0);
        voltage += (last.voltage_v || 0);
        count++;
      }
    });

    return { 
      power, 
      energy, 
      avgVoltage: count > 0 ? voltage / count : 0,
      count 
    };
  }, [selectedForSum, readings]);

  const toggleSumSelection = (id) => {
    setSelectedForSum(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newMachine.name) return;
    onAddMachine(newMachine);
    setNewMachine({ name: "", photo_url: "" });
    setIsAdding(false);
  };

  const recentAlerts = alerts.filter((a) => !a.acknowledged).slice(0, 4);

  return (
    <div className="dashboard-v2">
      <div className="page-header">
        <div className="page-title">Energy <span>Control Center</span></div>
        <div className="page-subtitle">Real-time monitoring for {machines.length} active machines</div>
      </div>

      {/* Summation / Calculation Tool */}
      <div className="card mb-20 highlight-card">
        <div className="card-header">
          <div className="card-title">Σ Summation Calculator</div>
          <div className="card-desc">Select multiple machines to calculate combined metrics</div>
        </div>
        
        <div className="sum-selector">
          {machines.map(m => (
            <button 
              key={m.id}
              className={`sum-chip ${selectedForSum.includes(m.id) ? 'active' : ''}`}
              onClick={() => toggleSumSelection(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>

        {selectedForSum.length > 0 ? (
          <div className="sum-results">
            <div className="sum-val">
              <label>COMBINED POWER</label>
              <div className="val">{summedMetrics.power.toFixed(2)} <span>kW</span></div>
            </div>
            <div className="sum-val">
              <label>TOTAL ENERGY</label>
              <div className="val">{summedMetrics.energy.toFixed(3)} <span>kWh</span></div>
            </div>
            <div className="sum-val">
              <label>AVG VOLTAGE</label>
              <div className="val">{summedMetrics.avgVoltage.toFixed(1)} <span>V</span></div>
            </div>
            <div className="sum-info">
              {summedMetrics.count} machines included in calculation
            </div>
          </div>
        ) : (
          <div className="empty-sum">Click machine names above to calculate sum</div>
        )}
      </div>

      {/* Machines Grid */}
      <div className="grid-header-row">
        <div className="section-title">Machine Status</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "✕ Close" : "⊕ Add New Machine"}
        </button>
      </div>

      {isAdding && (
        <div className="card mb-20 animate-in">
          <form onSubmit={handleAddSubmit} className="add-machine-form">
            <div className="form-group-inline">
              <div>
                <label className="form-label">Machine Name</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Machine LA6"
                  value={newMachine.name}
                  onChange={e => setNewMachine({...newMachine, name: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Photo URL (Optional)</label>
                <input 
                  className="form-input" 
                  placeholder="https://..."
                  value={newMachine.photo_url}
                  onChange={e => setNewMachine({...newMachine, photo_url: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>Add Machine</button>
            </div>
          </form>
        </div>
      )}

      <div className="machine-grid mb-20">
        {machines.map(m => (
          <MachineCard 
            key={m.id} 
            machine={m} 
            lastReading={getLatestForMachine(m.id)} 
            onToggle={onToggleStatus}
            readings={readings}
          />
        ))}
        {machines.length === 0 && <div className="empty-state">No machines configured</div>}
      </div>

      <div className="grid-2 mb-20">
        {/* Active Alerts */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚑ System Alerts</div>
            <span className="badge badge-crit">{recentAlerts.length} active</span>
          </div>
          {recentAlerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <div className="empty-text">No active alerts</div>
            </div>
          ) : (
            recentAlerts.map((a) => (
              <div key={a.id} className={`alert-item ${a.severity}`} style={{ padding: "10px 12px", marginBottom: 8 }}>
                <div className="alert-content">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 11 }}>{a.machine_name}</span>
                    <span style={{ fontSize: 9, opacity: 0.7 }}>{new Date(a.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="alert-title" style={{ fontSize: 12 }}>{a.parameter}</div>
                  <div className="alert-desc">{a.message}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">◷ Global Energy Trend</div>
          </div>
          <EnergyChart readings={readings.slice(-30)} />
        </div>
      </div>
    </div>
  );
}

function MachineCard({ machine, lastReading, onToggle, readings }) {
  const isOff = machine.status === "off";
  
  const sparkFor = (key) =>
    readings.filter(r => r.machine_id === machine.id).slice(-20).map((r, i) => ({ i, value: r[key] || 0 }));

  return (
    <div className={`machine-card ${isOff ? 'off' : 'on'}`}>
      <div className="machine-header">
        <div className="machine-img-wrap">
          <img src={machine.photo_url || "https://img.icons8.com/bubbles/200/000000/industrial-robot.png"} alt={machine.name} />
          <div className={`status-dot ${machine.status}`}></div>
        </div>
        <div className="machine-info">
          <div className="machine-name">{machine.name}</div>
          <div className="machine-id">ID: #{machine.id}</div>
        </div>
        <button 
          className={`toggle-btn ${machine.status}`}
          onClick={() => onToggle(machine.id, machine.status)}
        >
          {machine.status.toUpperCase()}
        </button>
      </div>

      <div className="machine-grid-small">
        <div className="mini-metric">
          <span className="mini-label">VOLTAGE</span>
          <span className="mini-value">{lastReading?.voltage_v?.toFixed(1) || "0.0"} <small>V</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">POWER</span>
          <span className="mini-value">{lastReading?.power_kw?.toFixed(2) || "0.00"} <small>kW</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">ENERGY</span>
          <span className="mini-value">{lastReading?.energy_kwh?.toFixed(3) || "0.000"} <small>kWh</small></span>
        </div>
      </div>

      <div className="machine-spark">
        <Sparkline data={sparkFor("power_kw")} color={isOff ? "#64748b" : "#8b5cf6"} height={30} />
      </div>
    </div>
  );
}
function EnergyChart({ readings }) {
  if (readings.length < 2) {
    return (
      <div className="empty-state">
        <div className="empty-icon">◷</div>
        <div className="empty-text">Add at least 2 readings to see the trend</div>
      </div>
    );
  }

  const w = 900; const h = 200;
  const pad = { top: 12, right: 20, bottom: 32, left: 44 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  const energyVals = readings.map((r) => r.energy_kwh || 0);
  const powerVals = readings.map((r) => r.power_kw || 0);
  const minE = Math.min(...energyVals); const maxE = Math.max(...energyVals) || 1;
  const minP = Math.min(...powerVals);  const maxP = Math.max(...powerVals) || 1;

  const toX = (i) => pad.left + (i / (readings.length - 1)) * iw;
  const toYE = (v) => pad.top + ih - ((v - minE) / (maxE - minE || 1)) * ih;
  const toYP = (v) => pad.top + ih - ((v - minP) / (maxP - minP || 1)) * ih;

  const ePts = readings.map((r, i) => `${toX(i)},${toYE(r.energy_kwh || 0)}`).join(" ");
  const pPts = readings.map((r, i) => `${toX(i)},${toYP(r.power_kw || 0)}`).join(" ");

  const ticks = 4;
  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = minE + (i / ticks) * (maxE - minE);
    return { v: v.toFixed(1), y: pad.top + ih - (i / ticks) * ih };
  });

  const xStep = Math.max(1, Math.floor(readings.length / 6));
  const xLabels = readings.filter((_, i) => i % xStep === 0).map((r, ii) => ({
    label: new Date(r.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    x: toX(ii * xStep),
  }));

  return (
    <div className="chart-container" style={{ height: h }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1={pad.left} y1={l.y} x2={w - pad.right} y2={l.y}
              stroke="var(--border-dim)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={pad.left - 6} y={l.y + 4} fill="var(--text-muted)"
              fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">{l.v}</text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={h - 4} fill="var(--text-muted)"
            fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">{l.label}</text>
        ))}

        {/* Energy area */}
        <polygon fill="url(#ge)"
          points={`${toX(0)},${pad.top + ih} ${ePts} ${toX(readings.length - 1)},${pad.top + ih}`} />
        <polyline fill="none" stroke="#10b981" strokeWidth="2" points={ePts}
          style={{ filter: "drop-shadow(0 0 4px #10b981)" }} />

        {/* Power area */}
        <polygon fill="url(#gp)"
          points={`${toX(0)},${pad.top + ih} ${pPts} ${toX(readings.length - 1)},${pad.top + ih}`} />
        <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" points={pPts}
          strokeDasharray="6,3"
          style={{ filter: "drop-shadow(0 0 4px #8b5cf6)" }} />

        {/* Legend */}
        <g>
          <circle cx={pad.left + 8} cy={pad.top - 2} r="4" fill="#10b981" />
          <text x={pad.left + 16} y={pad.top + 2} fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-mono)">Energy (kWh)</text>
          <circle cx={pad.left + 110} cy={pad.top - 2} r="4" fill="#8b5cf6" />
          <text x={pad.left + 118} y={pad.top + 2} fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-mono)">Power (kW)</text>
        </g>
      </svg>
    </div>
  );
}
