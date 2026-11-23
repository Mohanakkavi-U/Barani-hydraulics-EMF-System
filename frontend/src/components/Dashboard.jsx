import { useMemo, useState, useEffect } from "react";

function GaugeRing({ value, max, color, label, unit }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 44; /* Increased from 40 */
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="gauge-wrap">
      <div className="gauge-ring">
        <svg viewBox="0 0 100 100" width="120" height="120">
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
          <span style={{ color, fontSize: 24 }}>{value != null ? value.toFixed(1) : "—"}</span>
          <span className="gauge-ring-unit" style={{ fontSize: 14 }}>{unit}</span>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-accent)", marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

function Sparkline({ data, color, height = 48 }) {
  if (!data || data.length === 0) return <div style={{ height, background: "var(--border-dim)", borderRadius: 3, opacity: 0.1 }} />;
  
  const isSingle = data.length === 1;

  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 280;
  const h = height;
  const pts = isSingle 
    ? [`0,${h - ((data[0].value - min) / range) * (h - 6) - 3}`, `${w},${h - ((data[0].value - min) / range) * (h - 6) - 3}`]
    : data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((d.value - min) / range) * (h - 6) - 3;
        return `${x},${y}`;
      });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts.join(" ")}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      {!isSingle && (
        <polygon
          fill={`url(#sg-${color.replace("#", "")})`}
          points={`0,${h} ${pts.join(" ")} ${w},${h}`}
        />
      )}
      {isSingle ? (
        <circle cx={w/2} cy={h - ((data[0].value - min) / range) * (h - 6) - 3} r="3" fill={color} />
      ) : (
        pts.map((p, i) => {
          const [x, y] = p.split(",");
          return <circle key={i} cx={x} cy={y} r="1.5" fill={color} />;
        })
      )}
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="metric-value" style={{ fontSize: 48 }}>{value != null ? (typeof value === "number" ? value.toFixed(2) : value) : "—"}</span>
        <span className="metric-unit" style={{ fontSize: 16 }}>{unit}</span>
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

export default function Dashboard({ readings, latestReading, alerts, machines, onToggleStatus, onAddMachine, onDeleteMachine }) {
  const [selectedForSum, setSelectedForSum] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMachine, setNewMachine] = useState({ name: "", plc_ip: "", plc_db_number: "" });

  const getLatestForMachine = (id) => {
    const machineReadings = readings.filter(r => r.machine_id == id);
    return machineReadings.length > 0 ? machineReadings[0] : null;
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
        voltage += (last.voltage_ln_v || 0);
        count++;
      }
    });

    return { 
      power, 
      energy, 
      avgVoltageLN: count > 0 ? voltage / count : 0,
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
    
    const payload = {
      name: newMachine.name,
      plc_ip: newMachine.plc_ip || null,
      plc_db_number: newMachine.plc_db_number ? parseInt(newMachine.plc_db_number) : null
    };
    
    onAddMachine(payload);
    setNewMachine({ name: "", plc_ip: "", plc_db_number: "" });
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
              <label>AVG VOLTAGE LN</label>
              <div className="val">{summedMetrics.avgVoltageLN.toFixed(1)} <span>V</span></div>
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
            <div className="form-group-inline" style={{ flexWrap: "wrap", gap: 15 }}>
              <div>
                <label className="form-label">Machine Name*</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Machine LA6"
                  required
                  value={newMachine.name}
                  onChange={e => setNewMachine({...newMachine, name: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">PLC IP Address (Optional)</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. 192.168.0.20"
                  value={newMachine.plc_ip}
                  onChange={e => setNewMachine({...newMachine, plc_ip: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">PLC DB Number</label>
                <input 
                  className="form-input" 
                  type="number"
                  placeholder="e.g. 1"
                  value={newMachine.plc_db_number}
                  onChange={e => setNewMachine({...newMachine, plc_db_number: e.target.value})}
                  style={{ width: "100px" }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end", marginBottom: "2px" }}>Add Machine</button>
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
            onDelete={onDeleteMachine}
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
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.machine_name}</span>
                    <span style={{ fontSize: 13, opacity: 0.7 }}>{new Date(a.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="alert-title" style={{ fontSize: 15 }}>{a.parameter || "Threshold Alert"}</div>
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
          <EnergyChart />
        </div>
      </div>
    </div>
  );
}

function MachineCard({ machine, lastReading, onToggle, onDelete, readings }) {
  const isOff = machine.status === "off";
  
  return (
    <div className={`machine-card ${isOff ? 'off' : 'on'}`}>
      <div className="machine-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={`status-dot ${machine.status}`} style={{ position: "relative", top: "unset", right: "unset", width: 14, height: 14 }}></div>
          <div className="machine-info">
            <div className="machine-name" style={{ fontSize: 20 }}>{machine.name}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="machine-id" style={{ fontSize: 15 }}>ID: #{machine.id}</div>
            </div>
            
            {(machine.operator_name || machine.work_order_id || machine.part_name) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {machine.operator_name && (
                  <span style={{ fontSize: 15, fontWeight: 600, padding: '4px 12px', background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                    👤 Operator: {machine.operator_name}
                  </span>
                )}
                {machine.part_name && (
                  <span style={{ fontSize: 15, fontWeight: 600, padding: '4px 12px', background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                    ⚙ Part: {machine.part_name}
                  </span>
                )}
                {machine.work_order_id && (
                  <span style={{ fontSize: 15, fontWeight: 600, padding: '4px 12px', background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                    📋 W.O: {machine.work_order_id}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", flex: 1 }}>
          <button 
            className={`toggle-btn ${machine.status}`}
            onClick={() => onToggle(machine.id, machine.status)}
          >
            {machine.status.toUpperCase()}
          </button>
          <button 
            className="toggle-btn" 
            style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)" }} 
            onClick={() => onDelete(machine.id)}
            title="Delete Machine"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="machine-grid-small">
        <div className="mini-metric">
          <span className="mini-label">VOLTAGE LN</span>
          <span className="mini-value">{lastReading?.voltage_ln_v?.toFixed(1) || "0.0"} <small>V</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">VOLTAGE LL</span>
          <span className="mini-value">{lastReading?.voltage_ll_v?.toFixed(1) || "0.0"} <small>V</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">CURRENT</span>
          <span className="mini-value">{lastReading?.current_a?.toFixed(1) || "0.0"} <small>A</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">FREQUENCY</span>
          <span className="mini-value">{lastReading?.frequency_hz?.toFixed(1) || "0.0"} <small>Hz</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">POWER</span>
          <span className="mini-value">{lastReading?.power_kw?.toFixed(2) || "0.00"} <small>kW</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">POWER FACTOR</span>
          <span className="mini-value">{lastReading?.power_factor?.toFixed(2) || "0.00"} <small>pf</small></span>
        </div>
        <div className="mini-metric">
          <span className="mini-label">ENERGY</span>
          <span className="mini-value">{lastReading?.energy_kwh?.toFixed(3) || "0.000"} <small>kWh</small></span>
        </div>
      </div>
    </div>
  );
}
function EnergyChart() {
  const [readings, setReadings] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/readings/aggregated");
        const json = await res.json();
        if (Array.isArray(json)) {
          setReadings(json.reverse());
        }
      } catch (e) {
        console.error("Chart load failed", e);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (readings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">◷</div>
        <div className="empty-text">No trend data available</div>
      </div>
    );
  }

  const isSingle = readings.length === 1;

  const w = 900; const h = 200;
  const pad = { top: 12, right: 20, bottom: 32, left: 44 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  const energyVals = readings.map((r) => r.energy_kwh || 0);
  const powerVals = readings.map((r) => r.power_kw || 0);
  const minE = Math.min(...energyVals); const maxE = Math.max(...energyVals) || 1;
  const minP = Math.min(...powerVals);  const maxP = Math.max(...powerVals) || 1;

  const toX = (i) => {
    if (isSingle) return pad.left + iw / 2;
    return pad.left + (i / (readings.length - 1)) * iw;
  };
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
              fontSize="13" textAnchor="end" fontFamily="var(--font-mono)">{l.v}</text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={h - 4} fill="var(--text-muted)"
            fontSize="13" textAnchor="middle" fontFamily="var(--font-mono)">{l.label}</text>
        ))}

        {/* Energy area */}
        {!isSingle && (
          <>
            <polygon fill="url(#ge)"
              points={`${toX(0)},${pad.top + ih} ${ePts} ${toX(readings.length - 1)},${pad.top + ih}`} />
            <polyline fill="none" stroke="#10b981" strokeWidth="2" points={ePts}
              style={{ filter: "drop-shadow(0 0 4px #10b981)" }} />
          </>
        )}
        {readings.map((r, i) => <circle key={`e-${i}`} cx={toX(i)} cy={toYE(r.energy_kwh || 0)} r={isSingle ? "4" : "1.5"} fill="#10b981" />)}

        {/* Power area */}
        {!isSingle && (
          <>
            <polygon fill="url(#gp)"
              points={`${toX(0)},${pad.top + ih} ${pPts} ${toX(readings.length - 1)},${pad.top + ih}`} />
            <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" points={pPts}
              strokeDasharray="6,3"
              style={{ filter: "drop-shadow(0 0 4px #8b5cf6)" }} />
          </>
        )}
        {readings.map((r, i) => <circle key={`p-${i}`} cx={toX(i)} cy={toYP(r.power_kw || 0)} r={isSingle ? "3" : "1.2"} fill="#8b5cf6" />)}

        {/* Legend */}
        <g>
          <circle cx={pad.left + 8} cy={pad.top - 2} r="4" fill="#10b981" />
          <text x={pad.left + 16} y={pad.top + 2} fill="var(--text-secondary)" fontSize="13" fontFamily="var(--font-mono)">Energy (kWh)</text>
          <circle cx={pad.left + 110} cy={pad.top - 2} r="4" fill="#8b5cf6" />
          <text x={pad.left + 118} y={pad.top + 2} fill="var(--text-secondary)" fontSize="13" fontFamily="var(--font-mono)">Power (kW)</text>
        </g>
      </svg>
    </div>
  );
}
