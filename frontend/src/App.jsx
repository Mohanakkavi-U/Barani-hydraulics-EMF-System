import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import DataInput from "./components/DataInput";
import Historical from "./components/Historical";
import Alerts from "./components/Alerts";
import Sidebar from "./components/Sidebar";
import MachineUserSettings from "./components/MachineUserSettings";
import AnalyticsReport from "./components/AnalyticsReport";
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
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

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
      const json = await res.json();
      if (json && json.data) {
        setReadings(json.data);
        setLatestReading(json.data.length > 0 ? json.data[0] : null);
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
    
    // Connect to WebSocket
    const ws = new WebSocket("ws://localhost:8000/ws/readings");
    ws.onmessage = (event) => {
      const newReading = JSON.parse(event.data);
      setReadings((prev) => {
        const next = [newReading, ...prev];
        return next.slice(0, 50); // Keep live array capped at 50
      });
      setLatestReading(newReading);
    };

    // Lightweight polling specifically for active Alerts
    const alertInterval = setInterval(() => {
      fetchAlerts();
    }, 5000);

    return () => {
      ws.close();
      clearInterval(alertInterval);
    };
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

  const acknowledgeAlertsBulk = async (ids) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/acknowledge-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        await fetchAlerts();
        showToast(`Acknowledged ${ids.length} alerts`);
      }
    } catch (e) {
      console.error("Bulk acknowledge failed", e);
      showToast("Failed to acknowledge alerts", "error");
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

  const deleteMachine = async (machineId) => {
    if (!window.confirm("Are you sure you want to delete this machine? This will also delete all its readings and alerts.")) return;
    try {
      const res = await fetch(`${API_BASE}/machines/${machineId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchMachines();
        await fetchReadings(); // Deletion cascade in DB might affect readings/alerts
        await fetchAlerts();
        showToast("Machine deleted successfully");
      } else {
        showToast("Failed to delete machine", "error");
      }
    } catch (e) {
      showToast("Failed to delete machine", "error");
    }
  };

  const updateMachineSettings = async (machineId, settingsData) => {
    try {
      const res = await fetch(`${API_BASE}/machines/${machineId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsData),
      });
      if (!res.ok) {
        throw new Error("Failed to update settings");
      }
      await fetchMachines();
      showToast("Settings updated successfully");
    } catch (e) {
      showToast(`Update error: ${e.message}`, "error");
    }
  };

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter((a) => !a.acknowledged).length : 0;

  return (
    <div className="app-shell" data-theme={theme}>
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        unreadAlerts={unreadAlerts} 
        theme={theme}
        toggleTheme={toggleTheme}
      />
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
              onDeleteMachine={deleteMachine}
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
          {activePage === "settings" && (
            <MachineUserSettings 
              machines={machines} 
              onUpdateSettings={updateMachineSettings} 
            />
          )}
          {activePage === "alerts" && (
            <Alerts 
              alerts={alerts} 
              onAcknowledge={acknowledgeAlert} 
              onAcknowledgeBulk={acknowledgeAlertsBulk} 
            />
          )}
          {activePage === "analytics" && (
            <AnalyticsReport />
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

