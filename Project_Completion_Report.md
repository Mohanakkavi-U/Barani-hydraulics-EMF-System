# Comprehensive Project Report
## Project Title: Energy Management and Machine Shop Efficiency Monitoring System

---

### 1. Project Overview & Uses
The **Energy Management and Machine Shop Efficiency Monitoring System** is a robust, full-stack Progressive Web Application (PWA) designed to bring real-time visibility, traceability, and accountability to industrial shop floors. 

**Primary Uses:**
- **Centralized Supervision:** Replaces manual logging and disconnected meters with a centralized web dashboard to monitor multiple machines simultaneously.
- **Cost-Per-Part Tracking:** Links electrical consumption data directly to the active operator, work order, and the specific part being manufactured to accurately calculate energy costs per unit.
- **Equipment Protection:** Provides immediate alerting on harmful power conditions (like voltage spikes or low power factor) to prevent premature equipment failure.

---

### 2. Technology Stack & Developing Platform
The project employs a modern, decoupled architecture focusing on high performance and real-time data streaming.

#### Frontend (Client-Side)
* **Framework:** React 18 powered by Vite for rapid development and optimized production builds.
* **Styling:** Vanilla CSS Variables tailored for a dark, high-visibility industrial aesthetic without relying on bulky external frameworks.
* **Performance:** `react-window` for DOM virtualization, enabling the browser to render massive amounts of historical data without lagging or crashing.
* **Platform:** Progressive Web App (PWA) standards configured via web app manifest, allowing frictionless installation on desktop (Windows/Mac/Linux) and mobile devices.

#### Backend (Server-Side)
* **Framework:** Python 3.10+ with **FastAPI** and Uvicorn.
* **Real-time Pipeline:** Multi-threaded architecture using **WebSockets** to continuously stream live machine data to the frontend, eliminating the overhead of traditional HTTP polling.
* **PLC Integration:** Custom Python services to dynamically interface with Siemens S7-1200 PLCs over Ethernet, capable of reading industrial DB (Data Block) registers.

#### Database
* **Database Management System:** MySQL
* **Integration:** `mysql-connector-python` for scalable, concurrent storage of continuous telemetry data, replacing the earlier SQLite implementation to handle production-level constraints.

---

### 3. Key Features
1. **Dynamic Siemens PLC Integration:** Users can dynamically add new Siemens PLCs directly from the dashboard by entering an IP address and DB Number. The backend automatically spawns a threaded polling service for that machine.
2. **Real-time Event-Driven Dashboard:** Features animated gauges, sparkline trends, and 6 live metrics (Voltage LN, Voltage LL, Current, Power, Energy, Power Factor, Frequency). WebSockets push data sub-second for instantaneous UI updates.
3. **Machine & Worker Traceability (Context Logs):** A dedicated "Machine User Settings" page allows managers to assign specific Operators, Work Orders, and Part Names to active machines. This data is injected into every subsequent PLC reading in the database.
4. **Intelligent Alerting Engine:** Automatically evaluates every incoming reading against configurable safety thresholds. Triggers Visual Alerts for Critical (🔴) and Warning (🟡) conditions, and features bulk-acknowledgment functionality.
5. **Advanced Historical Analysis:** Provides time-range selectors, statistical summaries (Min, Max, Avg, Total), multi-metric comparison grids, and server-side paginated tables to analyze long-term machine performance.

---

### 4. Advantages of the Project
* **High Visibility UI:** The interface abandons standard corporate web designs in favor of a "Shop-Floor First" approach—featuring massive fonts, high-contrast dark modes, and physical-style toggle indicators built for readability from a distance.
* **Highly Scalable Architecture:** By shifting from a REST-polling mechanism to WebSockets coupled with DOM Virtualization, the application can monitor dozens of machines simultaneously without overwhelming network bandwidth or freezing the user's browser.
* **No-Code Expansion:** Adding a new machine requires zero code changes. You simply input the IP onto the frontend, and the backend dynamically scales its background threads.
* **Enhanced Accountability:** Retains a "Worker History" log, allowing administrators to audit which worker produced what part and exactly how efficiently the machine ran during that shift. 

---

### 5. Efficiency in Energy Monitoring
This system fundamentally shifts energy management from being a reactive, end-of-month manual calculation to a proactive, real-time optimization tool.

* **Reactive Power Mitigation:** By continuously monitoring the **Power Factor (PF)** natively alongside active power, managers can instantly spot and correct inefficient loads (PF < 0.8) which usually incur hefty penalties from utility providers.
* **Granular Process Verification:** Capturing metrics like transient spikes in Current or Power provides insights into the physical health of machine tooling. An unexpected rise in power to cut the exact same part over time serves as predictive maintenance data, indicating a dull tool or failing spindle motor.
* **Automated Data Integrity:** Manual data entry allows human error, whereas direct PLC data ensures 100% accurate, high-frequency baseline data for energy audits and lean manufacturing initiatives.
