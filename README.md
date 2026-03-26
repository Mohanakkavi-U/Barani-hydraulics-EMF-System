# ⚡ Energy Monitoring System
### Machine Shop Efficiency Monitoring — PWA

A full-stack Progressive Web Application for real-time energy monitoring, historical analysis, and intelligent alerting for machine shop environments.

---

## 🏗 Architecture

```
energy-monitor/
├── frontend/          # React 18 + Vite PWA
│   ├── src/
│   │   ├── App.jsx              # Root + state management
│   │   ├── App.css              # Global design system (dark industrial theme)
│   │   └── components/
│   │       ├── Sidebar.jsx      # Navigation + live clock
│   │       ├── Dashboard.jsx    # Live metrics, gauges, sparklines, chart
│   │       ├── DataInput.jsx    # Manual data entry form with validation
│   │       ├── Historical.jsx   # Trend analysis + comparison
│   │       └── Alerts.jsx       # Alert log + acknowledge
│   └── public/manifest.json    # PWA manifest
│
├── backend/
│   ├── main.py                  # FastAPI server + alert engine
│   ├── requirements.txt
│   └── .env.example
│
└── database/
    └── schema.sql               # MySQL tables + views + sample data
```

---

## 🚀 Setup

### 1. MySQL Database

```sql
-- Run schema.sql in your MySQL client:
mysql -u root -p < database/schema.sql
```

### 2. Backend (Python FastAPI)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure database
cp .env.example .env
nano .env                       # Fill in DB_USER, DB_PASSWORD etc.

# Start server
python main.py
# → API running at http://localhost:8000
# → Docs at    http://localhost:8000/docs
```

### 3. Frontend (React)

```bash
cd frontend
npm install
npm run dev
# → App running at http://localhost:5173
```

---

## 📊 Features

### Dashboard
- **6 live metric cards** — Voltage, Current, Power, Energy, PF, Frequency with sparkline trends
- **3 gauge rings** — Power Factor, Frequency, Power (animated SVG)
- **Energy + Power trend chart** — last 30 readings with dual-axis line chart
- **Active alerts panel** — real-time critical/warning display
- **Recent readings table** — last 10 with colour-coded status badges
- **Auto-refresh** every 15 seconds

### Data Entry
- **Validated form** with 6 parameter fields and real-time feedback
- **Auto-fill test data** button for development/testing
- **Live preview panel** showing entered values
- **Threshold reference card** — acceptable ranges at a glance
- Field-level warnings (orange) and errors (red) before submission

### Historical Analysis
- **Metric selector** — switch between all 6 parameters
- **Time range selector** — last 20 / 50 / 100 / 500 readings
- **Statistical summary** — Min, Max, Average, Total
- **6-panel mini chart grid** for comparison
- **Power Factor distribution donut chart**
- **Full data table** with all parameters, sortable by recency

### Alerts & Alarms
- **Auto-generated alerts** on each reading submission via threshold engine
- **Three severity levels**: 🔴 Critical / 🟡 Warning / 🔵 Info
- **One-click acknowledge** to clear active alerts
- **Filter** by severity and show/hide acknowledged
- **Summary strip** — critical count, warning count, total

---

## ⚡ Alert Thresholds

| Parameter    | Warning              | Critical             |
|-------------|----------------------|----------------------|
| Voltage     | < 210V or > 240V     | < 200V or > 260V     |
| Current     | > 100A               | > 150A               |
| Power Factor| < 0.95               | < 0.80               |
| Frequency   | < 49.5 or > 50.5 Hz  | < 49.0 or > 51.0 Hz  |
| Power       | > 500 kW             | —                    |

---

## 🗃 API Endpoints

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| GET    | `/api/health`                   | Health check             |
| GET    | `/api/readings?limit=500`       | Get all readings         |
| POST   | `/api/readings`                 | Create reading + alerts  |
| GET    | `/api/alerts?acknowledged=false`| Get alerts               |
| PUT    | `/api/alerts/{id}/acknowledge`  | Acknowledge an alert     |
| GET    | `/api/stats/summary`            | Aggregate statistics     |

Full interactive API docs: **http://localhost:8000/docs**

---

## 🛠 Tech Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | React 18, Vite, CSS Variables    |
| Backend  | Python 3.10+, FastAPI, Uvicorn   |
| Database | MySQL 8+                         |
| Charts   | Pure SVG (no chart library deps) |
| PWA      | Web App Manifest                 |

---

## 📱 PWA Install

Open in Chrome/Edge → address bar → install icon → "Add to Home Screen"  
Works on desktop (Windows/Mac/Linux) and mobile.

---

## 🔧 Extending

**Add a new parameter:**
1. Add column to `readings` table in `schema.sql`
2. Add field to `ReadingCreate` Pydantic model in `main.py`
3. Add threshold rules in `THRESHOLDS` dict in `main.py`
4. Add field to `FIELDS` array in `DataInput.jsx`
5. Add `MetricCard` in `Dashboard.jsx`

**Add more machines:**  
Add a `machine_id` FK column to `readings` and filter by machine in queries.
