import { useState, useMemo } from "react";

const METRICS = [
  { key: "voltage_ln_v", label: "Voltage LN",   unit: "V",   color: "#00d4ff" },
  { key: "voltage_ll_v", label: "Voltage LL",   unit: "V",   color: "#00d4ff" },
  { key: "current_a",   label: "Current",       unit: "A",   color: "#f59e0b" },
  { key: "power_kw",    label: "Power",         unit: "kW",  color: "#8b5cf6" },
  { key: "energy_kwh",  label: "Energy",        unit: "kWh", color: "#10b981" },
  { key: "power_factor",label: "Power Factor",  unit: "PF",  color: "#ef4444" },
  { key: "frequency_hz",label: "Frequency",     unit: "Hz",  color: "#14b8a6" },
];

function LineChart({ readings, metric }) {
  if (readings.length === 0) return (
    <div className="empty-state" style={{ height: 180 }}>
      <div className="empty-icon">◷</div>
      <div className="empty-text">No data available</div>
    </div>
  );

  // If only 1 reading, we can't draw a line, but we can draw a point
  const isSingle = readings.length === 1;

  const w = 560; const h = 160;
  const pad = { top: 14, right: 16, bottom: 28, left: 46 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  const vals = readings.map((r) => r[metric.key] || 0);
  const min = Math.min(...vals); const max = Math.max(...vals) || 1;

  const toX = (i) => {
    return pad.left + (i / (readings.length - 1 || 1)) * iw;
  };
  const toY = (v) => {
    const range = max - min || 1;
    return pad.top + ih - ((v - min) / range) * ih;
  };

  const pts = isSingle
    ? [`${pad.left},${toY(readings[0][metric.key])}`, `${w - pad.right},${toY(readings[0][metric.key])}`].join(" ")
    : readings.map((r, i) => `${toX(i)},${toY(r[metric.key] || 0)}`).join(" ");
  const gId = `g-${metric.key}`;

  const ticks = 4;
  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => ({
    v: (min + (i / ticks) * (max - min)).toFixed(1),
    y: pad.top + ih - (i / ticks) * ih,
  }));

  const xStep = isSingle ? 1 : Math.max(1, Math.floor(readings.length / 5));
  const xLabels = readings.filter((_, i) => i % xStep === 0).map((r, ii) => {
    const d = new Date(r.timestamp);
    const label = isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    return {
      label,
      x: toX(ii * xStep),
    };
  });

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
          <text x={pad.left - 5} y={l.y + 4} fill="var(--text-muted)" fontSize="12" textAnchor="end" fontFamily="var(--font-mono)">{l.v}</text>
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={h - 4} fill="var(--text-muted)" fontSize="12" textAnchor="middle" fontFamily="var(--font-mono)">{l.label}</text>
      ))}
      {!isSingle && (
        <>
          <polygon fill={`url(#${gId})`}
            points={`${toX(0)},${pad.top + ih} ${pts} ${toX(readings.length - 1)},${pad.top + ih}`} />
          <polyline fill="none" stroke={metric.color} strokeWidth="2" points={pts}
            style={{ filter: `drop-shadow(0 0 4px ${metric.color})` }} />
        </>
      )}
      {isSingle ? (
        <circle 
          cx={pad.left + iw / 2} 
          cy={toY(readings[0][metric.key])} 
          r="4" 
          fill={metric.color} 
          style={{ filter: `drop-shadow(0 0 8px ${metric.color})` }} 
        />
      ) : (
        readings.map((r, i) => (
          <circle key={i} cx={toX(i)} cy={toY(r[metric.key] || 0)} r="2.5"
            fill={metric.color} opacity="0.8" />
        ))
      )}
    </svg>
  );
}


function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border-dim)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color }}>
        {value} <span style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{unit}</span>
      </div>
    </div>
  );
}

export default function Historical({ readings, machines }) {
  const [range, setRange] = useState(50);
  const [manualMode, setManualMode] = useState(false);
  const [manualData, setManualData] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fetching, setFetching] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalManual, setTotalManual] = useState(0);

  const [selectedMetric, setSelectedMetric] = useState("energy_kwh");
  const [selectedMachine, setSelectedMachine] = useState("all");
  const metric = METRICS.find((m) => m.key === selectedMetric);

  const fetchManual = async (newOffset = 0) => {
    if (!startDate || !endDate) return alert("Please select both dates");
    setFetching(true);
    try {
      const formattedStart = startDate.replace("T", " ") + ":00";
      const formattedEnd = endDate.replace("T", " ") + ":59";
      const res = await fetch(`http://localhost:8000/api/readings?start_dt=${encodeURIComponent(formattedStart)}&end_dt=${encodeURIComponent(formattedEnd)}&limit=500&offset=${newOffset}`);
      const json = await res.json();
      if (newOffset === 0) {
        setManualData(json.data);
      } else {
        setManualData(prev => [...prev, ...json.data]);
      }
      setTotalManual(json.total);
      setOffset(newOffset);
      setManualMode(true);
      setRange("All");
    } catch (e) {
      console.error(e);
      alert("Failed to fetch historical data from DB");
    } finally {
      setFetching(false);
    }
  };

  const clearManual = () => {
    setManualMode(false);
    setManualData([]);
    setRange(50);
    setOffset(0);
    setTotalManual(0);
  };

  const filtered = useMemo(() => {
    let data = manualMode ? manualData : readings;
    if (selectedMachine !== "all") {
      data = data.filter(r => String(r.machine_id) === String(selectedMachine));
    }
    return range === "All" ? data : data.slice(0, range);
  }, [readings, manualMode, manualData, range, selectedMachine]);

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
        <div className="page-title" style={{ fontSize: 32 }}>Historical <span>Analysis</span></div>
        <div className="page-subtitle" style={{ fontSize: 15, letterSpacing: 1.5 }}>Trend analysis & comparisons · {filtered.length} readings shown</div>
      </div>

      {/* Controls */}
      <div className="card mb-20">
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div className="form-label" style={{ marginBottom: 12, fontSize: 15, fontWeight: 700 }}>1. Select Machine</div>
            <select 
              className="form-input" 
              value={selectedMachine} 
              onChange={(e) => setSelectedMachine(e.target.value)}
              style={{ minWidth: 260, padding: "10px 14px", fontSize: 16, fontWeight: 600 }}
            >
              <option value="all">All Machines (Aggregate)</option>
              {machines.map(m => {
                const count = readings.filter(r => String(r.machine_id) === String(m.id)).length;
                return (
                  <option key={m.id} value={String(m.id)}>
                    {m.name} ({count} readings)
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>2. Metric</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {METRICS.map((m) => (
                <button key={m.key}
                  className={`btn ${selectedMetric === m.key ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "6px 12px", fontSize: 14, color: selectedMetric === m.key ? undefined : m.color, borderColor: m.color }}
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
              {[20, 50, 100, 500, "All"].map((n) => (
                <button key={n}
                  className={`btn ${range === n ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "6px 12px", fontSize: 14 }}
                  onClick={() => setRange(n)}
                >
                  {n === "All" ? "All" : `Last ${n}`}
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
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>{metric.unit}</span>
        </div>
        {filtered.length > 0 ? (
          <LineChart readings={[...filtered].reverse()} metric={metric} />
        ) : (
          <div className="empty-state" style={{ height: 180 }}>
            <div className="empty-icon">◷</div>
            <div className="empty-text">
              No data for <strong>{selectedMachine === "all" ? "any machine" : machines.find(m => String(m.id) === String(selectedMachine))?.name || "this machine"}</strong>
            </div>
          </div>
        )}
      </div>

      {/* All-metrics mini chart grid */}
      <div className="grid-3 mb-20">
        {METRICS.filter((m) => m.key !== selectedMetric).map((m) => (
          <div key={m.key} className="card" style={{ cursor: "pointer" }} onClick={() => setSelectedMetric(m.key)}>
            <div className="card-header">
              <div className="card-title" style={{ color: m.color, fontSize: 14 }}>{m.label}</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>{m.unit}</span>
            </div>
            <LineChart readings={[...filtered].reverse()} metric={m} />
          </div>
        ))}
      </div>

      {/* Power Factor Distribution */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title">φ Power Factor Distribution</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>{pfDistribution.total} samples</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 14, marginBottom: 4 }}>
                <span className="text-green">Good (≥0.95)</span>
                <span>{pfDistribution.good.toFixed(1)}%</span>
              </div>
              <div className="range-bar"><div className="range-fill" style={{ width: `${pfDistribution.good}%`, background: "var(--accent-green)" }} /></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 14, marginBottom: 4 }}>
                <span className="text-amber">Fair (0.85–0.95)</span>
                <span>{pfDistribution.fair.toFixed(1)}%</span>
              </div>
              <div className="range-bar"><div className="range-fill" style={{ width: `${pfDistribution.fair}%`, background: "var(--accent-amber)" }} /></div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 14, marginBottom: 4 }}>
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

      {/* Manual Data Filter Section */}
      <div className="card mb-20" style={{ border: manualMode ? "1px solid var(--accent-cyan)" : undefined }}>
        <div className="card-header">
          <div className="card-title">Manual DB Filter</div>
          <span style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {manualMode ? "VIEWING MANUAL DATA" : "LIVE STREAMING"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>Start Date & Time</div>
            <input type="datetime-local" className="form-input" style={{ fontSize: 15, padding: "8px 12px" }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>End Date & Time</div>
            <input type="datetime-local" className="form-input" style={{ fontSize: 15, padding: "8px 12px" }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => fetchManual(0)} disabled={fetching} style={{ padding: "8px 16px", minWidth: 140 }}>
            {fetching && offset === 0 ? "Loading..." : "Fetch DB Data"}
          </button>
          {manualMode && (
            <button className="btn btn-ghost" onClick={clearManual} style={{ padding: "8px 16px", color: "var(--accent-red)", borderColor: "var(--accent-red)" }}>
              Clear & Return to Live
            </button>
          )}
        </div>
        {manualMode && offset + 500 < totalManual && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(0, 212, 255, 0.05)", borderTop: "1px solid var(--border-dim)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, color: "var(--text-secondary)" }}>
              Showing {manualData.length} of {totalManual} total records in range
            </span>
            <button className="btn btn-primary" onClick={() => fetchManual(offset + 500)} disabled={fetching}>
              {fetching ? "Loading..." : "Load Next 500"}
            </button>
          </div>
        )}
      </div>

      {/* Full data table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">◈ Data Table</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>{filtered.length} rows</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ background: "var(--bg-deep)" }}>
                <th style={{ padding: "14px 12px", fontSize: 14, fontWeight: 800 }}>#</th>
                <th style={{ padding: "14px 12px", fontSize: 14, fontWeight: 800 }}>Machine</th>
                <th style={{ padding: "14px 12px", fontSize: 14, fontWeight: 800 }}>Timestamp</th>
                <th>Operator</th>
                <th>Work Order</th>
                <th>Part Name</th>
                <th>V (LN)</th>
                <th>V (LL)</th>
                <th>Current (A)</th>
                <th>Power (kW)</th>
                <th>Energy (kWh)</th>
                <th>PF</th>
                <th>Freq (Hz)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const m = machines.find(m => String(m.id) === String(r.machine_id))?.name || `M-${r.machine_id}`;
                return (
                  <tr key={r.id}>
                    <td className="text-muted" style={{ padding: "14px 12px", fontSize: 15, fontFamily: "var(--font-mono)" }}>#{r.id}</td>
                    <td className="text-muted" style={{ padding: "14px 12px", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{m}</td>
                    <td className="text-muted" style={{ padding: "14px 12px", fontSize: 15 }}>{new Date(r.timestamp).toLocaleString("en-IN")}</td>
                    <td className="text-muted">{r.operator_name || "—"}</td>
                    <td className="text-muted">{r.work_order_id || "—"}</td>
                    <td className="text-muted">{r.part_name || "—"}</td>
                    <td className="text-cyan" style={{ padding: "14px 12px", fontSize: 15, fontWeight: 600 }}>{r.voltage_ln_v?.toFixed(1)}</td>
                    <td className="text-cyan" style={{ padding: "14px 12px", fontSize: 15, fontWeight: 600 }}>{r.voltage_ll_v?.toFixed(1)}</td>
                    <td className="text-amber" style={{ padding: "14px 12px", fontSize: 15, fontWeight: 600 }}>{r.current_a?.toFixed(2)}</td>
                    <td className="text-purple" style={{ padding: "14px 12px", fontSize: 16, fontWeight: 600 }}>{r.power_kw?.toFixed(2)}</td>
                    <td className="text-green" style={{ padding: "14px 12px", fontSize: 16, fontWeight: 600 }}>{r.energy_kwh?.toFixed(4)}</td>
                    <td style={{ padding: "14px 12px", fontSize: 16, fontWeight: 700, color: r.power_factor >= 0.95 ? "var(--accent-green)" : r.power_factor >= 0.85 ? "var(--accent-amber)" : "var(--accent-red)" }}>
                      {r.power_factor?.toFixed(3)}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 16 }}>{r.frequency_hz?.toFixed(2)}</td>
                    <td className="text-muted" style={{ fontSize: 14 }}>{r.notes || "—"}</td>
                  </tr>
                );
              })}
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
