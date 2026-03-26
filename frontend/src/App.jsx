import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import DataInput from "./components/DataInput";
import Historical from "./components/Historical";
import Alerts from "./components/Alerts";
import Sidebar from "./components/Sidebar";
import "./App.css";

const API_BASE = "http://localhost:8000/api";

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [latestReading, setLatestReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/machines`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setMachines(data);
      }
    } catch (e) {
      console.error("Fetch machines failed", e);
    }
  }, []);

  const fetchReadings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/readings`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setReadings(data);
        setLatestReading(data.length > 0 ? data[data.length - 1] : null);
      }
    } catch (e) {
      console.error("Fetch readings failed", e);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setAlerts(data);
      }
    } catch (e) {
      console.error("Fetch alerts failed", e);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
    fetchReadings();
    fetchAlerts();
    const interval = setInterval(() => {
      fetchMachines();
      fetchReadings();
      fetchAlerts();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchReadings, fetchAlerts, fetchMachines]);

  const submitReading = async (formData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Submit failed");
      }
      await fetchReadings();
      await fetchAlerts();
      showToast("Reading recorded successfully");
    } catch (e) {
      showToast(`Submission Error: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleMachineStatus = async (machineId, currentStatus) => {
    const newStatus = currentStatus === "on" ? "off" : "on";
    try {
      const res = await fetch(`${API_BASE}/machines/${machineId}/status?status=${newStatus}`, {
        method: "PUT",
      });
      if (res.ok) {
        await fetchMachines();
        showToast(`Machine ${newStatus.toUpperCase()}`);
      }
    } catch (e) {
      showToast("Failed to update status", "error");
    }
  };

  const acknowledgeAlert = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, { method: "PUT" });
      if (res.ok) {
        await fetchAlerts();
      }
    } catch (e) {
      console.error("Acknowledge alert failed", e);
    }
  };

  const addMachine = async (machineData) => {
    try {
      const res = await fetch(`${API_BASE}/machines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(machineData),
      });
      if (res.ok) {
        await fetchMachines();
        showToast("Machine added successfully");
      }
    } catch (e) {
      showToast("Failed to add machine", "error");
    }
  };

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter((a) => !a.acknowledged).length : 0;

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} setActivePage={setActivePage} unreadAlerts={unreadAlerts} />
      <main className="main-content">
        <div className="page-container">
          {activePage === "dashboard" && (
            <Dashboard 
              readings={readings} 
              latestReading={latestReading} 
              alerts={alerts} 
              machines={machines} 
              onToggleStatus={toggleMachineStatus}
              onAddMachine={addMachine}
            />
          )}
          {activePage === "input" && (
            <DataInput 
              onSubmit={submitReading} 
              loading={loading} 
              machines={machines} 
            />
          )}
          {activePage === "historical" && (
            <Historical readings={readings} machines={machines} />
          )}
          {activePage === "alerts" && (
            <Alerts alerts={alerts} onAcknowledge={acknowledgeAlert} />
          )}
        </div>
      </main>
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span className="toast-icon">{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

