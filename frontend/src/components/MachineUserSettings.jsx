import { useState, useEffect } from "react";

function SettingsCard({ machine, onSave }) {
  const [formData, setFormData] = useState({
    operator_name: machine.operator_name || "",
    work_order_id: machine.work_order_id || "",
    part_name: machine.part_name || ""
  });
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [deletingHistory, setDeletingHistory] = useState(false);

  // Sync form data if machine changes (e.g. initial load or refetch)
  useEffect(() => {
    setFormData({
      operator_name: machine.operator_name || "",
      work_order_id: machine.work_order_id || "",
      part_name: machine.part_name || ""
    });
  }, [machine]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(machine.id, formData);
    setSaving(false);
  };

  const handleViewHistory = async (e) => {
    e.preventDefault();
    setShowHistory(true);
    setLoadingHistory(true);
    setSelectedHistoryIds([]);
    try {
      const res = await fetch(`http://localhost:8000/api/machines/${machine.id}/worker_history`);
      if (res.ok) {
        const json = await res.json();
        setHistoryData(json);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteHistory = async () => {
    if (selectedHistoryIds.length === 0) return;
    setDeletingHistory(true);
    try {
      const res = await fetch(`http://localhost:8000/api/worker_history/delete-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedHistoryIds })
      });
      if (res.ok) {
        setHistoryData(historyData.filter(h => !selectedHistoryIds.includes(h.id)));
        setSelectedHistoryIds([]);
      }
    } catch (err) {
      console.error("Failed to delete history", err);
    } finally {
      setDeletingHistory(false);
    }
  };

  const toggleHistorySelection = (id) => {
    setSelectedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isOff = machine.status === "off";

  return (
    <div className={`card ${isOff ? 'off' : 'on'}`} style={{ opacity: isOff ? 0.8 : 1 }}>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={`status-dot ${machine.status}`} style={{ position: "relative", top: "unset", right: "unset", width: 12, height: 12 }}></div>
          <div>
            <div className="card-title" style={{ fontSize: 18, color: "var(--text-primary)" }}>{machine.name}</div>
            <div className="card-desc" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>ID: #{machine.id}</div>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Operator Name</label>
          <div className="form-input-wrap">
            <input 
              className="form-input" 
              placeholder="Enter operator name..."
              value={formData.operator_name}
              onChange={e => setFormData({...formData, operator_name: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Work Order ID (Admin fill)</label>
          <div className="form-input-wrap">
            <input 
              className="form-input" 
              placeholder="Enter work order ID..."
              value={formData.work_order_id}
              onChange={e => setFormData({...formData, work_order_id: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Part Name</label>
          <div className="form-input-wrap">
            <input 
              className="form-input" 
              placeholder="Enter part name..."
              value={formData.part_name}
              onChange={e => setFormData({...formData, part_name: e.target.value})}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleViewHistory}>
            View History
          </button>
        </div>
      </form>

      {/* History Overlap Modal */}
      {showHistory && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "var(--bg-card)", zIndex: 10, borderRadius: "var(--radius)",
          padding: "24px", display: "flex", flexDirection: "column",
          border: "2px solid var(--accent-cyan)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="card-title">📖 Worker History Log</div>
            <div style={{ display: "flex", gap: 10 }}>
              {selectedHistoryIds.length > 0 && (
                <button type="button" className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 14, background: "var(--danger-color, #ef4444)", borderColor: "var(--danger-color, #ef4444)" }} onClick={handleDeleteHistory} disabled={deletingHistory}>
                  {deletingHistory ? "DELETING..." : `🗑 REMOVE SELECTED (${selectedHistoryIds.length})`}
                </button>
              )}
              <button type="button" className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 14 }} onClick={() => setShowHistory(false)}>✕ CLOSE</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }} className="table-wrap">
            {loadingHistory ? (
              <div className="empty-state" style={{ height: 100 }}><div className="empty-text">Loading history...</div></div>
            ) : historyData.length === 0 ? (
              <div className="empty-state" style={{ height: 100 }}><div className="empty-text">No worker revisions found.</div></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input 
                        type="checkbox" 
                        checked={selectedHistoryIds.length === historyData.length && historyData.length > 0} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedHistoryIds(historyData.map(h => h.id));
                          else setSelectedHistoryIds([]);
                        }}
                      />
                    </th>
                    <th>Date & Time</th>
                    <th>Operator</th>
                    <th>Work Order</th>
                    <th>Part Name</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((h, i) => (
                    <tr key={i} style={{ background: selectedHistoryIds.includes(h.id) ? "rgba(239, 68, 68, 0.1)" : "transparent" }}>
                      <td style={{ textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedHistoryIds.includes(h.id)} 
                          onChange={() => toggleHistorySelection(h.id)}
                        />
                      </td>
                      <td style={{ fontSize: 14, color: "var(--text-muted)" }}>{new Date(h.assigned_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ fontWeight: 600 }}>{h.operator_name || "—"}</td>
                      <td>{h.work_order_id || "—"}</td>
                      <td>{h.part_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MachineUserSettings({ machines, onUpdateSettings }) {
  return (
    <div className="machine-settings-page">
      <div className="page-header">
        <div className="page-title">Machine <span>User Settings</span></div>
        <div className="page-subtitle">Configure operator and work order details</div>
      </div>
      
      <div className="machine-grid mb-20">
        {machines.map(m => (
          <SettingsCard key={m.id} machine={m} onSave={onUpdateSettings} />
        ))}
        {machines.length === 0 && <div className="empty-state">No machines configured</div>}
      </div>

      <div className="card highlight-card">
        <div className="card-header">
          <div className="card-title">Saved Machine Configurations</div>
          <div className="card-desc">Current settings retrieved from the database</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine Name</th>
                <th>Operator Name</th>
                <th>Work Order ID</th>
                <th>Part Name</th>
              </tr>
            </thead>
            <tbody>
              {machines.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: "700", color: "var(--text-primary)" }}>{m.name}</td>
                  <td>{m.operator_name || <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>Unassigned</span>}</td>
                  <td>{m.work_order_id || <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>—</span>}</td>
                  <td>{m.part_name || <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>—</span>}</td>
                </tr>
              ))}
              {machines.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "20px" }}>No machines available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
