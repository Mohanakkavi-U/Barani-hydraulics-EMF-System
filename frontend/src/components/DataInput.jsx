import { useState } from "react";

const FIELDS = [
  {
    key: "voltage_v",
    label: "Voltage",
    unit: "V",
    placeholder: "220.0",
    hint: "Normal range: 210 – 240 V",
    color: "cyan",
    icon: "⚡",
    min: 0, max: 500,
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
    key: "power_kw",
    label: "Power",
    unit: "kW",
    placeholder: "3.3",
    hint: "Active power consumed",
    color: "purple",
    icon: "⊛",
    min: 0, max: 10000,
  },
  {
    key: "energy_kwh",
    label: "Energy Consumption",
    unit: "kWh",
    placeholder: "0.055",
    hint: "Cumulative energy for this interval",
    color: "green",
    icon: "◈",
    min: 0, max: 100000,
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
    key: "frequency_hz",
    label: "Frequency",
    unit: "Hz",
    placeholder: "50.0",
    hint: "Normal: 49.8 – 50.2 Hz",
    color: "teal",
    icon: "∿",
    min: 0, max: 100,
  },
];

const EMPTY = {
  machine_id: "",
  voltage_v: "", current_a: "", power_kw: "",
  energy_kwh: "", power_factor: "", frequency_hz: "",
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
    };
    FIELDS.forEach(({ key }) => { payload[key] = parseFloat(form[key]); });
    payload.notes = form.notes;

    await onSubmit(payload);
    setForm(EMPTY);
    setTouched({});
    setErrors({});
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const autofill = () => {
    setForm({
      machine_id: machines.length > 0 ? machines[0].id : "",
      voltage_v: (220 + Math.random() * 10 - 5).toFixed(1),
      current_a: (10 + Math.random() * 20).toFixed(2),
      power_kw:  (2 + Math.random() * 5).toFixed(2),
      energy_kwh:(0.01 + Math.random() * 0.2).toFixed(4),
      power_factor: (0.85 + Math.random() * 0.15).toFixed(3),
      frequency_hz: (49.8 + Math.random() * 0.4).toFixed(2),
      notes: "Auto-filled test data",
    });
    setErrors({});
  };

  const hintClass = (key) => {
    const v = parseFloat(form[key]);
    if (!form[key] || isNaN(v)) return "";
    if (key === "power_factor") return v < 0.85 ? "error" : v < 0.95 ? "warning" : "";
    if (key === "frequency_hz") return v < 49.5 || v > 50.5 ? "error" : v < 49.8 || v > 50.2 ? "warning" : "";
    if (key === "voltage_v") return v < 200 || v > 250 ? "error" : v < 210 || v > 240 ? "warning" : "";
    return "";
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Data <span>Entry</span></div>
        <div className="page-subtitle">Manual parameter input · Real-time validation</div>
      </div>

      <div className="input-layout" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Main Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⊕ New Reading</div>
            <button className="btn btn-ghost" onClick={autofill} style={{ fontSize: 11, padding: "6px 14px" }}>
              ⟳ Auto-fill Test Data
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ fontSize: 14, fontWeight: 700 }}>1. Select Machine</label>
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
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {touched.machine_id && errors.machine_id && <div className="form-hint error">⚠ {errors.machine_id}</div>}
            </div>

            <label className="form-label" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "block" }}>2. Enter Parameters</label>
            <div className="form-grid">
              {FIELDS.map((field) => (
                <div className="form-group" key={field.key}>
                  <label className="form-label">
                    <span style={{ marginRight: 6, color: `var(--accent-${field.color})` }}>{field.icon}</span>
                    {field.label}
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
                      style={
                        touched[field.key] && errors[field.key]
                          ? { borderColor: "var(--accent-red)" }
                          : form[field.key] && !errors[field.key]
                          ? { borderColor: "var(--accent-green)" }
                          : {}
                      }
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
            <div className="card-title" style={{ marginBottom: 14 }}>◈ Preview</div>
            {FIELDS.map((f) => (
              <div key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-dim)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: 1 }}>{f.label.toUpperCase()}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: form[f.key] ? `var(--accent-${f.color})` : "var(--text-muted)", fontWeight: 600 }}>
                  {form[f.key] || "—"} <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{f.unit}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Threshold Reference */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>⚑ Threshold Ref</div>
            {[
              { label: "Voltage", ok: "210–240V", warn: "200–210 / 240–250V", crit: "<200 or >250V" },
              { label: "Power Factor", ok: "≥ 0.95", warn: "0.85–0.95", crit: "< 0.85" },
              { label: "Frequency", ok: "49.8–50.2Hz", warn: "49.5–49.8 / 50.2–50.5Hz", crit: "Outside 49.5–50.5Hz" },
            ].map((t) => (
              <div key={t.label} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
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
