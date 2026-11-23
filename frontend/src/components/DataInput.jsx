import { useState } from "react";

const FIELDS = [
  {
    key: "voltage_ln_v",
    label: "Voltage LN",
    unit: "V",
    placeholder: "220.0",
    hint: "Normal range: 210 – 240 V",
    color: "cyan",
    icon: "⚡",
    min: 0, max: 500,
  },
  {
    key: "voltage_ll_v",
    label: "Voltage LL",
    unit: "V",
    placeholder: "415.0",
    hint: "Normal range: 380 – 440 V",
    color: "cyan",
    icon: "⚡",
    min: 0, max: 600,
  },
  {
    key: "current_a",
    label: "Current",
    unit: "A",
    placeholder: "15.0",
    hint: "Normal range: 0 – 100 A",
    color: "amber",
    icon: "〜",
    min: 0, max: 1000,
  },
  {
    key: "power_factor",
    label: "Power Factor",
    unit: "PF",
    placeholder: "0.95",
    hint: "Range: 0.00 – 1.00 (≥ 0.95 ideal)",
    color: "red",
    icon: "φ",
    min: 0, max: 1,
  },
  {
    key: "time_h",
    label: "Time Interval",
    unit: "h",
    placeholder: "1.0",
    hint: "Time in hours",
    color: "blue",
    icon: "◷",
    min: 0, max: 24,
  },
];

const EMPTY = {
  machine_id: "",
  voltage_ln_v: "", voltage_ll_v: "", current_a: "", power_factor: "", time_h: "",
  notes: "",
};

function validate(form) {
  const errs = {};
  if (!form.machine_id) {
    errs.machine_id = "Please select a machine";
  }
  FIELDS.forEach(({ key, label, min, max }) => {
    const v = parseFloat(form[key]);
    if (form[key] === "" || isNaN(v)) {
      errs[key] = `${label} is required`;
    } else if (v < min || v > max) {
      errs[key] = `Expected ${min} – ${max}`;
    }
  });
  return errs;
}

export default function DataInput({ onSubmit, loading, machines }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const calcPower = () => {
    const v = parseFloat(form.voltage_ln_v) || 0;
    const c = parseFloat(form.current_a) || 0;
    const pf = parseFloat(form.power_factor) || 0;
    return (v * c * pf) / 1000;
  };

  const calcEnergy = () => {
    const p = calcPower();
    const t = parseFloat(form.time_h) || 0;
    return p * t;
  };

  const change = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
  };

  const blur = (key) => setTouched((t) => ({ ...t, [key]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setTouched(Object.fromEntries([...FIELDS.map((f) => [f.key, true]), ["machine_id", true]]));
    if (Object.keys(errs).length > 0) return;

    const payload = {
      machine_id: parseInt(form.machine_id),
      voltage_ln_v: parseFloat(form.voltage_ln_v),
      voltage_ll_v: parseFloat(form.voltage_ll_v),
      current_a: parseFloat(form.current_a),
      power_factor: parseFloat(form.power_factor),
      power_kw: calcPower(),
      energy_kwh: calcEnergy(),
      frequency_hz: 50.0, // Default since it was removed from inputs
      notes: form.notes
    };

    await onSubmit(payload);
    setForm(EMPTY);
    setTouched({});
    setErrors({});
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const autofill = () => {
    setForm({
      machine_id: machines.length > 0 ? String(machines[0].id) : "",
      voltage_ln_v: (220 + Math.random() * 10 - 5).toFixed(1),
      voltage_ll_v: (415 + Math.random() * 15 - 7).toFixed(1),
      current_a: (10 + Math.random() * 20).toFixed(2),
      power_factor: (0.85 + Math.random() * 0.15).toFixed(3),
      time_h: (1 + Math.random() * 3).toFixed(2),
      notes: "Auto-filled test data",
    });
    setErrors({});
  };

  const hintClass = (key) => {
    const v = parseFloat(form[key]);
    if (!form[key] || isNaN(v)) return "";
    if (key === "power_factor") return v < 0.85 ? "error" : v < 0.95 ? "warning" : "";
    if (key === "voltage_ln_v") return v < 200 || v > 250 ? "error" : v < 210 || v > 240 ? "warning" : "";
    if (key === "voltage_ll_v") return v < 380 || v > 450 ? "error" : v < 400 || v > 430 ? "warning" : "";
    return "";
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Data <span>Entry</span></div>
        <div className="page-subtitle">Manual parameter input · Auto calculation</div>
      </div>

      <div className="input-layout" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Main Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⊕ New Reading</div>
            <button className="btn btn-ghost" onClick={autofill} style={{ fontSize: 14, padding: "6px 14px", type: "button" }}>
              ⟳ Auto-fill Test Data
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label" style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>1. Select Machine</label>
              <select 
                className="form-input" 
                value={form.machine_id}
                onChange={(e) => change("machine_id", e.target.value)}
                onBlur={() => blur("machine_id")}
                style={
                  touched.machine_id && errors.machine_id
                    ? { borderColor: "var(--accent-red)" }
                    : form.machine_id && !errors.machine_id
                    ? { borderColor: "var(--accent-green)" }
                    : {}
                }
              >
                <option value="">-- Choose Machine --</option>
                {machines.map(m => (
                  <option key={m.id} value={String(m.id)}>{m.name}</option>
                ))}
              </select>
              {touched.machine_id && errors.machine_id && <div className="form-hint error">⚠ {errors.machine_id}</div>}
            </div>

            <label className="form-label" style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "block" }}>2. Enter Parameters</label>
            <div className="form-grid">
              {FIELDS.map((field) => (
                <div className="form-group" key={field.key}>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                    <span>
                      <span style={{ marginRight: 8, color: `var(--accent-${field.color})`, fontSize: 16 }}>{field.icon}</span>
                      {field.label}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--text-muted)", marginLeft: "auto", fontWeight: 700 }}>
                      IN {field.unit}
                    </span>
                  </label>
                  <div className="form-input-wrap">
                    <input
                      className="form-input"
                      type="number"
                      step="any"
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => change(field.key, e.target.value)}
                      onBlur={() => blur(field.key)}
                      style={{
                        padding: "14px 16px",
                        fontSize: "18px",
                        fontWeight: 700,
                        ...(touched[field.key] && errors[field.key]
                          ? { borderColor: "var(--accent-red)" }
                          : form[field.key] && !errors[field.key]
                          ? { borderColor: "var(--accent-green)" }
                          : {})
                      }}
                    />
                    <span className="form-unit">{field.unit}</span>
                  </div>
                  {touched[field.key] && errors[field.key] ? (
                    <div className="form-hint error">⚠ {errors[field.key]}</div>
                  ) : (
                    <div className={`form-hint ${hintClass(field.key)}`}>{field.hint}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Notes (optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="Any observation or note..."
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
                style={{ paddingRight: 14 }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "⟳ Submitting..." : "⊕ Record Reading"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setForm(EMPTY); setTouched({}); setErrors({}); }}>
                ✕ Clear
              </button>
            </div>
          </form>
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Live Preview */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>◈ Preview & Formulas</div>
            
            {/* Input Variables */}
            {FIELDS.map((f) => (
              <div key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)", letterSpacing: 1.5, fontWeight: 700 }}>{f.label.toUpperCase()}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: form[f.key] ? `var(--accent-${f.color})` : "var(--text-muted)", fontWeight: 700 }}>
                  {form[f.key] || "0"} <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{f.unit}</span>
                </span>
              </div>
            ))}

            <div style={{ margin: "14px 0", borderBottom: "1px dashed var(--border-dim)" }}></div>

            {/* Calculated Values */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--accent-purple)", letterSpacing: 1.5, fontWeight: 800 }}>
                POWER
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, fontWeight: 400 }}>(V × A × PF) / 1000</div>
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--accent-purple)", fontWeight: 800 }}>
                {calcPower().toFixed(3)} <span style={{ fontSize: 16, color: "var(--text-muted)", marginLeft: 2 }}>kW</span>
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--accent-green)", letterSpacing: 1.5, fontWeight: 800 }}>
                ENERGY
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, fontWeight: 400 }}>Power (kW) × Time (h)</div>
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--accent-green)", fontWeight: 800 }}>
                {calcEnergy().toFixed(4)} <span style={{ fontSize: 16, color: "var(--text-muted)", marginLeft: 2 }}>kWh</span>
              </span>
            </div>

          </div>

          {/* Threshold Reference */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>⚑ Threshold Ref</div>
            {[
              { label: "Voltage LN", ok: "210–240V", warn: "200–210 / 240–250V", crit: "<200 or >250V" },
              { label: "Voltage LL", ok: "400–430V", warn: "380–400 / 430–450V", crit: "<380 or >450V" },
              { label: "Power Factor", ok: "≥ 0.95", warn: "0.85–0.95", crit: "< 0.85" },
            ].map((t) => (
              <div key={t.label} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-secondary)", letterSpacing: 1, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="badge badge-ok">OK {t.ok}</span>
                  <span className="badge badge-warn" style={{ width: "fit-content" }}>⚠ {t.warn}</span>
                  <span className="badge badge-crit" style={{ width: "fit-content" }}>✕ {t.crit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
