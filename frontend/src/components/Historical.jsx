import { useState, useMemo } from "react";

const METRICS = [
  { key: "voltage_v",    label: "Voltage",      unit: "V",   color: "#00d4ff" },
  { key: "current_a",   label: "Current",       unit: "A",   color: "#f59e0b" },
  { key: "power_kw",    label: "Power",         unit: "kW",  color: "#8b5cf6" },
  { key: "energy_kwh",  label: "Energy",        unit: "kWh", color: "#10b981" },
  { key: "power_factor",label: "Power Factor",  unit: "PF",  color: "#ef4444" },
  { key: "frequency_hz",label: "Frequency",     unit: "Hz",  color: "#14b8a6" },
];

function LineChart({ readings, metric }) {
  if (readings.length < 2) return (
    <div className="empty-state" style={{ height: 180 }}>
      <div className="empty-icon">◷</div>
      <div className="empty-text">Need 2+ readings</div>
    </div>
  );

  const w = 560; const h = 160;
  const pad = { top: 14, right: 16, bottom: 28, left: 46 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  const vals = readings.map((r) => r[metric.key] || 0);
  const min = Math.min(...vals); const max = Math.max(...vals) || 1;

  const toX = (i) => pad.left + (i / (readings.length - 1)) * iw;
  const toY = (v) => pad.top + ih - ((v - min) / (max - min || 1)) * ih;

  const pts = readings.map((r, i) => `${toX(i)},${toY(r[metric.key] || 0)}`).join(" ");
  const gId = `g-${metric.key}`;

  const ticks = 4;
  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => ({
    v: (min + (i / ticks) * (max - min)).toFixed(1),
    y: pad.top + ih - (i / ticks) * ih,
  }));

  const xStep = Math.max(1, Math.floor(readings.length / 5));
  const xLabels = readings.filter((_, i) => i % xStep === 0).map((r, ii) => ({
    label: new Date(r.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    x: toX(ii * xStep),
  }));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 160 }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={metric.color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((l, i) => (
        <g key={i}>
          <line x1={pad.left} y1={l.y} x2={w - pad.right} y2={l.y} stroke="var(--border-dim)" strokeWidth="1" strokeDasharray="3,3" />
          <text x={pad.left - 5} y={l.y + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">{l.v}</text>
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={h - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">{l.label}</text>
      ))}
      <polygon fill={`url(#${gId})`}
        points={`${toX(0)},${pad.top + ih} ${pts} ${toX(readings.length - 1)},${pad.top + ih}`} />
      <polyline fill="none" stroke={metric.color} strokeWidth="2" points={pts}
        style={{ filter: `drop-shadow(0 0 4px ${metric.color})` }} />
      {readings.map((r, i) => (
        <circle key={i} cx={toX(i)} cy={toY(r[metric.key] || 0)} r="2.5"
          fill={metric.color} opacity="0.8" />
      ))}
    </svg>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border-dim)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color }}>
        {value} <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{unit}</span>
      </div>
    </div>
  );
}

export default function Historical({ readings, machines }) {
  const [range, setRange] = useState(50);
  const [selectedMetric, setSelectedMetric] = useState("energy_kwh");
  const [selectedMachine, setSelectedMachine] = useState("all");
  const metric = METRICS.find((m) => m.key === selectedMetric);

  const filtered = useMemo(() => {
    let data = readings;
    if (selectedMachine !== "all") {
      data = data.filter(r => r.machine_id === parseInt(selectedMachine));
    }
    return data.slice(-range);
  }, [readings, range, selectedMachine]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const vals = filtered.map((r) => r[selectedMetric] || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      min: Math.min(...vals).toFixed(3),
      max: Math.max(...vals).toFixed(3),
      avg: (sum / vals.length).toFixed(3),
      total: sum.toFixed(3),
    };
  }, [filtered, selectedMetric]);

  const pfDistribution = useMemo(() => {
    const good = filtered.filter((r) => r.power_factor >= 0.95).length;
    const fair = filtered.filter((r) => r.power_factor >= 0.85 && r.power_factor < 0.95).length;
    const poor = filtered.filter((r) => r.power_factor < 0.85).length;
    const total = filtered.length || 1;
    return { good: (good / total) * 100, fair: (fair / total) * 100, poor: (poor / total) * 100, total };
  }, [filtered]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Historical <span>Analysis</span></div>
        <div className="page-subtitle">Trend analysis & comparisons · {filtered.length} readings shown</div>
      </div>

      {/* Controls */}
      <div className="card mb-20">
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>1. Select Machine</div>
            <select 
              className="form-input" 
              value={selectedMachine} 
              onChange={(e) => setSelectedMachine(e.target.value)}
              style={{ minWidth: 200, padding: "8px 12px" }}
            >
              <option value="all">All Machines (Aggregate)</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>2. Metric</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {METRICS.map((m) => (
                <button key={m.key}
                  className={`btn ${selectedMetric === m.key ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "6px 12px", fontSize: 11, color: selectedMetric === m.key ? undefined : m.color, borderColor: m.color }}
                  onClick={() => setSelectedMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>3. Data Points</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[20, 50, 100, 500].map((n) => (
                <button key={n}
                  className={`btn ${range === n ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "6px 12px", fontSize: 11 }}
                  onClick={() => setRange(n)}
                >
                  Last {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid-4 mb-20">
          <StatCard label="Minimum" value={stats.min} unit={metric.unit} color={metric.color} />
          <StatCard label="Maximum" value={stats.max} unit={metric.unit} color={metric.color} />
          <StatCard label="Average" value={stats.avg} unit={metric.unit} color={metric.color} />
          <StatCard label="Total / Sum" value={stats.total} unit={metric.unit} color={metric.color} />
        </div>
      )}

      {/* Main chart */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title" style={{ color: metric.color }}>◷ {metric.label} Trend</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{metric.unit}</span>
        </div>
        <LineChart readings={filtered} metric={metric} />
      </div>

      {/* All-metrics mini chart grid */}
      <div className="grid-3 mb-20">
        {METRICS.filter((m) => m.key !== selectedMetric).map((m) => (
          <div key={m.key} className="card" style={{ cursor: "pointer" }} onClick={() => setSelectedMetric(m.key)}>
            <div className="card-header">
              <div className="card-title" style={{ color: m.color, fontSize: 11 }}>{m.label}</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{m.unit}</span>
            </div>
            <LineChart readings={filtered} metric={m} />
          </div>
        ))}
      </div>

      {/* Power Factor Distribution */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title">φ Power Factor Distribution</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{pfDistribution.total} samples</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 4 }}>
                <span className="text-green">Good (≥0.95)</span>
                <span>{pfDistribution.good.toFixed(1)}%</span>
              </div>
              <div className="range-bar"><div className="range-fill" style={{ width: `${pfDistribution.good}%`, background: "var(--accent-green)" }} /></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 4 }}>
                <span className="text-amber">Fair (0.85–0.95)</span>
                <span>{pfDistribution.fair.toFixed(1)}%</span>
              </div>
              <div className="range-bar"><div className="range-fill" style={{ width: `${pfDistribution.fair}%`, background: "var(--accent-amber)" }} /></div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 4 }}>
                <span className="text-red">Poor (&lt;0.85)</span>
                <span>{pfDistribution.poor.toFixed(1)}%</span>
              </div>
              <div className="range-bar"><div className="range-fill" style={{ width: `${pfDistribution.poor}%`, background: "var(--accent-red)" }} /></div>
            </div>
          </div>

          {/* Donut visual */}
          <svg width="120" height="120" viewBox="0 0 120 120">
            {(() => {
              const r = 50, cx = 60, cy = 60;
              const circ = 2 * Math.PI * r;
              const segs = [
                { pct: pfDistribution.good / 100, color: "#10b981" },
                { pct: pfDistribution.fair / 100, color: "#f59e0b" },
                { pct: pfDistribution.poor / 100, color: "#ef4444" },
              ];
              let offset = 0;
              return segs.map((s, i) => {
                const dash = s.pct * circ;
                const el = (
                  <circle key={i} cx={cx} cy={cy} r={r}
                    fill="none" stroke={s.color} strokeWidth="18"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 60 60)"
                    style={{ filter: `drop-shadow(0 0 4px ${s.color})` }}
                  />
                );
                offset += dash;
                return el;
              });
            })()}
            <text x="60" y="65" textAnchor="middle" fill="var(--text-primary)"
              fontSize="13" fontFamily="var(--font-display)" fontWeight="700">PF</text>
          </svg>
        </div>
      </div>

      {/* Full data table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">◈ Data Table</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} rows</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Voltage (V)</th>
                <th>Current (A)</th>
                <th>Power (kW)</th>
                <th>Energy (kWh)</th>
                <th>PF</th>
                <th>Freq (Hz)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().map((r, idx) => (
                <tr key={r.id}>
                  <td className="text-muted">{filtered.length - idx}</td>
                  <td className="text-muted">{new Date(r.timestamp).toLocaleString("en-IN")}</td>
                  <td className="text-cyan">{r.voltage_v?.toFixed(1)}</td>
                  <td className="text-amber">{r.current_a?.toFixed(2)}</td>
                  <td className="text-purple">{r.power_kw?.toFixed(2)}</td>
                  <td className="text-green">{r.energy_kwh?.toFixed(4)}</td>
                  <td style={{ color: r.power_factor >= 0.95 ? "var(--accent-green)" : r.power_factor >= 0.85 ? "var(--accent-amber)" : "var(--accent-red)" }}>
                    {r.power_factor?.toFixed(3)}
                  </td>
                  <td>{r.frequency_hz?.toFixed(2)}</td>
                  <td className="text-muted" style={{ fontSize: 11 }}>{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state"><div className="empty-icon">◷</div><div className="empty-text">No data in selected range</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
