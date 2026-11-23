import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import asyncio
from queue import Queue

load_dotenv()

app = FastAPI(title="Energy Monitor API")

reading_broadcast_queue = Queue()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

async def broadcast_worker():
    while True:
        try:
            while not reading_broadcast_queue.empty():
                reading_dict = reading_broadcast_queue.get_nowait()
                await manager.broadcast(reading_dict)
                reading_broadcast_queue.task_done()
        except Exception:
            pass
        await asyncio.sleep(0.1)

@app.on_event("startup")
def startup_event():
    import plc_service
    # If ENABLE_PLC_SERVICE is true in .env, start it
    if os.getenv("ENABLE_PLC_SERVICE", "false").lower() in ["true", "1", "t"]:
        plc_service.start_all_plc_services()
    asyncio.create_task(broadcast_worker())

@app.on_event("shutdown")
def shutdown_event():
    import plc_service
    plc_service.stop_all_plc_services()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MySQL connection details
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "energy_monitor")
DB_PORT = int(os.getenv("DB_PORT", 3306))

def get_db():
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            port=DB_PORT
        )
        return conn
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Create tables
    create_tables_sql = [
        """
        CREATE TABLE IF NOT EXISTS machines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'on',
            plc_ip VARCHAR(255) DEFAULT NULL,
            plc_db_number INT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS readings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            machine_id INT NOT NULL,
            machine_name VARCHAR(255) DEFAULT NULL,
            voltage_ln_v FLOAT NOT NULL,
            voltage_ll_v FLOAT DEFAULT 0,
            current_a FLOAT NOT NULL,
            power_kw FLOAT NOT NULL,
            energy_kwh FLOAT NOT NULL,
            power_factor FLOAT NOT NULL,
            frequency_hz FLOAT NOT NULL,
            notes TEXT,
            operator_name VARCHAR(255) DEFAULT NULL,
            work_order_id VARCHAR(255) DEFAULT NULL,
            part_name VARCHAR(255) DEFAULT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reading_id INT NOT NULL,
            severity VARCHAR(50) NOT NULL,
            parameter VARCHAR(255),
            message TEXT NOT NULL,
            value FLOAT,
            threshold VARCHAR(100),
            acknowledged TINYINT DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS worker_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            machine_id INT NOT NULL,
            machine_name VARCHAR(255) NOT NULL,
            operator_name VARCHAR(255) DEFAULT NULL,
            work_order_id VARCHAR(255) DEFAULT NULL,
            part_name VARCHAR(255) DEFAULT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
        )
        """
    ]

    for sql in create_tables_sql:
        cursor.execute(sql)

    # Automatically alter schemas for non-destructive upgrades
    try:
        cursor.execute("ALTER TABLE machines ADD COLUMN plc_ip VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE machines ADD COLUMN plc_db_number INT DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE machines DROP COLUMN plc_start_offset")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN value FLOAT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN threshold VARCHAR(100)")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE alerts DROP COLUMN machine_id")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE machines ADD COLUMN operator_name VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE machines ADD COLUMN work_order_id VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE machines ADD COLUMN part_name VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE readings ADD COLUMN operator_name VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE readings ADD COLUMN work_order_id VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE readings ADD COLUMN part_name VARCHAR(255) DEFAULT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE readings CHANGE COLUMN voltage_v voltage_ln_v FLOAT NOT NULL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE readings ADD COLUMN voltage_ll_v FLOAT DEFAULT 0 AFTER voltage_ln_v")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE readings MODIFY COLUMN machine_name VARCHAR(255) DEFAULT NULL AFTER machine_id")
    except Exception:
        pass

    # Insert sample if machines is empty
    cursor.execute("SELECT COUNT(*) FROM machines")
    if cursor.fetchone()[0] == 0:
        ip = os.getenv("PLC_IP", "192.168.0.10")
        db_num = int(os.getenv("PLC_DB_NUMBER", 1))
        cursor.execute(
            "INSERT INTO machines (name, status, plc_ip, plc_db_number) VALUES ('Machine Shop 1', 'on', %s, %s)",
            (ip, db_num)
        )
    conn.commit()
    conn.close()

# Run init DB on start
init_db()

class MachineCreate(BaseModel):
    name: str
    plc_ip: Optional[str] = None
    plc_db_number: Optional[int] = None

class MachineSettingsUpdate(BaseModel):
    operator_name: Optional[str] = None
    work_order_id: Optional[str] = None
    part_name: Optional[str] = None

class ReadingCreate(BaseModel):
    machine_id: int
    voltage_ln_v: float
    voltage_ll_v: float
    current_a: float
    power_kw: float
    energy_kwh: float
    power_factor: float
    frequency_hz: float
    notes: Optional[str] = None

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/machines")
def get_machines():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM machines ORDER BY id ASC")
    machines = cursor.fetchall()
    conn.close()
    return machines

@app.post("/api/machines")
def create_machine(mac: MachineCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO machines (name, plc_ip, plc_db_number) VALUES (%s, %s, %s)",
        (mac.name, mac.plc_ip, mac.plc_db_number)
    )
    machine_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Start PLC polling dynamically if IP is provided!
    import plc_service
    if mac.plc_ip and mac.plc_db_number is not None:
        if os.getenv("ENABLE_PLC_SERVICE", "false").lower() in ["true", "1", "t"]:
            plc_service.plc_manager.add_service(machine_id, mac.plc_ip, mac.plc_db_number)
            
    return {"status": "success", "id": machine_id}

@app.put("/api/machines/{machine_id}/status")
def update_machine_status(machine_id: int, status: str):
    if status not in ['on', 'off']:
        raise HTTPException(status_code=400, detail="Invalid status")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE machines SET status = %s WHERE id = %s", (status, machine_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.put("/api/machines/{machine_id}/settings")
def update_machine_settings(machine_id: int, settings: MachineSettingsUpdate):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name, operator_name, work_order_id, part_name FROM machines WHERE id = %s", (machine_id,))
    machine = cursor.fetchone()
    if not machine:
        conn.close()
        raise HTTPException(status_code=404, detail="Machine not found")
        
    cursor.execute(
        "UPDATE machines SET operator_name = %s, work_order_id = %s, part_name = %s WHERE id = %s",
        (settings.operator_name, settings.work_order_id, settings.part_name, machine_id)
    )

    # Retroactively update readings for the same shift if the user is correcting the part name or other details
    cursor.execute(
        """UPDATE readings 
           SET operator_name = %s, work_order_id = %s, part_name = %s 
           WHERE machine_id = %s 
           AND operator_name <=> %s 
           AND work_order_id <=> %s 
           AND part_name <=> %s""",
        (settings.operator_name, settings.work_order_id, settings.part_name,
         machine_id, machine.get('operator_name'), machine.get('work_order_id'), machine.get('part_name'))
    )
    
    # Log this assignment to the worker_details table, keeping it static (one row per machine)
    cursor.execute("SELECT id FROM worker_details WHERE machine_id = %s LIMIT 1", (machine_id,))
    worker_row = cursor.fetchone()
    
    if worker_row:
        # Delete any possible duplicate rows that might have been created previously
        cursor.execute("DELETE FROM worker_details WHERE machine_id = %s AND id != %s", (machine_id, worker_row['id']))
        # Update the single existing row
        cursor.execute(
            """UPDATE worker_details 
               SET machine_name = %s, operator_name = %s, work_order_id = %s, part_name = %s, timestamp = CURRENT_TIMESTAMP
               WHERE id = %s""",
            (machine['name'], settings.operator_name, settings.work_order_id, settings.part_name, worker_row['id'])
        )
    else:
        # Insert the first row for this machine
        cursor.execute(
            """INSERT INTO worker_details (machine_id, machine_name, operator_name, work_order_id, part_name)
               VALUES (%s, %s, %s, %s, %s)""",
            (machine_id, machine['name'], settings.operator_name, settings.work_order_id, settings.part_name)
        )
    
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/machines/{machine_id}/worker_history")
def get_worker_history(machine_id: int):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT id, operator_name, work_order_id, part_name, timestamp as assigned_at
        FROM worker_details
        WHERE machine_id = %s
        ORDER BY timestamp DESC
        LIMIT 20
    """, (machine_id,))
    history = cursor.fetchall()
    for row in history:
        if row.get('assigned_at'):
            row['assigned_at'] = row['assigned_at'].isoformat() + "Z"
    conn.close()
    return history

class BulkDeleteRequest(BaseModel):
    ids: List[int]

@app.post("/api/worker_history/delete-bulk")
def delete_worker_history_bulk(req: BulkDeleteRequest):
    if not req.ids:
        return {"status": "success", "message": "No IDs provided"}
    
    conn = get_db()
    cursor = conn.cursor()
    format_strings = ','.join(['%s'] * len(req.ids))
    cursor.execute(f"DELETE FROM worker_details WHERE id IN ({format_strings})", tuple(req.ids))
    conn.commit()
    conn.close()
    return {"status": "success", "count": len(req.ids)}

@app.delete("/api/machines/{machine_id}")
def delete_machine(machine_id: int):
    conn = get_db()
    cursor = conn.cursor()
    # Check if machine exists
    cursor.execute("SELECT id FROM machines WHERE id = %s", (machine_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Machine not found")

    # Forcefully wipe readings targeting the specific machine first to avoid orphaned records
    cursor.execute("DELETE FROM readings WHERE machine_id = %s", (machine_id,))

    cursor.execute("DELETE FROM machines WHERE id = %s", (machine_id,))
    conn.commit()
    conn.close()
    
    import plc_service
    plc_service.plc_manager.stop_service(machine_id)
    
    return {"status": "success"}

@app.get("/api/readings")
def get_readings(limit: int = 50, offset: int = 0, start_dt: Optional[str] = None, end_dt: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    if start_dt and end_dt:
        cursor.execute("SELECT * FROM readings WHERE timestamp >= %s AND timestamp <= %s ORDER BY timestamp DESC LIMIT %s OFFSET %s", (start_dt, end_dt, limit, offset))
    else:
        cursor.execute("SELECT * FROM readings ORDER BY timestamp DESC LIMIT %s OFFSET %s", (limit, offset))
    readings = cursor.fetchall()
    
    if start_dt and end_dt:
        cursor.execute("SELECT COUNT(*) as count FROM readings WHERE timestamp >= %s AND timestamp <= %s", (start_dt, end_dt))
    else:
        cursor.execute("SELECT COUNT(*) as count FROM readings")
    total = cursor.fetchone()["count"]
    conn.close()
    return {"data": readings, "total": total}

@app.get("/api/readings/aggregated")
def get_aggregated_readings(limit: int = 288):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT 
        MIN(timestamp) as timestamp,
        AVG(power_kw) as power_kw,
        MAX(energy_kwh) as energy_kwh
    FROM readings 
    GROUP BY UNIX_TIMESTAMP(timestamp) DIV 300
    ORDER BY UNIX_TIMESTAMP(timestamp) DIV 300 DESC
    LIMIT %s
    """
    cursor.execute(query, (limit,))
    data = cursor.fetchall()
    conn.close()
    return data

@app.websocket("/ws/readings")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

def evaluate_thresholds(reading: ReadingCreate, reading_id: int, cursor):
    alerts = []
    
    v = reading.voltage_ln_v
    if v < 200 or v > 260:
        alerts.append(("critical", "Voltage LN", f"Voltage LN critical: {v}V", float(v), "<200 or >260"))
    elif v < 210 or v > 240:
        alerts.append(("warning", "Voltage LN", f"Voltage LN warning: {v}V", float(v), "<210 or >240"))

    c = reading.current_a
    if c > 150:
        alerts.append(("critical", "Current", f"Current critical: {c}A", float(c), ">150"))
    elif c > 100:
        alerts.append(("warning", "Current", f"Current warning: {c}A", float(c), ">100"))

    pf = reading.power_factor
    if pf < 0.8:
        alerts.append(("critical", "Power Factor", f"Power factor critical: {pf}", float(pf), "<0.8"))
    elif pf < 0.95:
        alerts.append(("warning", "Power Factor", f"Power factor warning: {pf}", float(pf), "<0.95"))

    f = reading.frequency_hz
    if f < 49.0 or f > 51.0:
        alerts.append(("critical", "Frequency", f"Frequency critical: {f}Hz", float(f), "<49.0 or >51.0"))
    elif f < 49.5 or f > 50.5:
        alerts.append(("warning", "Frequency", f"Frequency warning: {f}Hz", float(f), "<49.5 or >50.5"))

    p = reading.power_kw
    if p > 500:
        alerts.append(("warning", "Power", f"Power high warning: {p}kW", float(p), ">500"))

    for severity, parameter, msg, val, thresh in alerts:
        cursor.execute(
            "INSERT INTO alerts (reading_id, severity, parameter, message, value, threshold) VALUES (%s, %s, %s, %s, %s, %s)",
            (reading_id, severity, parameter, msg, val, thresh)
        )

@app.post("/api/readings")
def create_reading(reading: ReadingCreate):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # Grab current worker configurations from the machines table
    cursor.execute("SELECT name, operator_name, work_order_id, part_name FROM machines WHERE id = %s", (reading.machine_id,))
    machine = cursor.fetchone() or {}
    
    cursor.execute(
        """INSERT INTO readings
        (machine_id, machine_name, voltage_ln_v, voltage_ll_v, current_a, power_kw, energy_kwh, power_factor, frequency_hz, notes, operator_name, work_order_id, part_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (reading.machine_id, machine.get("name"), reading.voltage_ln_v, reading.voltage_ll_v, reading.current_a, reading.power_kw,
         reading.energy_kwh, reading.power_factor, reading.frequency_hz, reading.notes,
         machine.get("operator_name"), machine.get("work_order_id"), machine.get("part_name"))
    )
    reading_id = cursor.lastrowid

    if reading_id is not None:
        evaluate_thresholds(reading, reading_id, cursor)

    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/alerts")
def get_alerts(acknowledged: Optional[bool] = None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    # Join with machines to get machine names for the Dashboard
    query = """
        SELECT a.*, m.name as machine_name, DATE_FORMAT(a.timestamp, '%Y-%m-%dT%H:%i:%sZ') as created_at
        FROM alerts a
        JOIN readings r ON a.reading_id = r.id
        JOIN machines m ON r.machine_id = m.id
    """
    if acknowledged is not None:
        val = 1 if acknowledged else 0
        cursor.execute(query + " WHERE a.acknowledged = %s ORDER BY a.timestamp DESC", (val,))
    else:
        cursor.execute(query + " ORDER BY a.timestamp DESC")

    alerts = cursor.fetchall()

    for a in alerts:
        a["acknowledged"] = bool(a["acknowledged"])
    conn.close()
    return alerts

@app.put("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET acknowledged = 1 WHERE id = %s", (alert_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

class BulkAckRequest(BaseModel):
    ids: List[int]

@app.post("/api/alerts/acknowledge-bulk")
def acknowledge_alerts_bulk(req: BulkAckRequest):
    if not req.ids:
        return {"status": "success", "message": "No IDs provided"}
    
    conn = get_db()
    cursor = conn.cursor()
    format_strings = ','.join(['%s'] * len(req.ids))
    cursor.execute(f"UPDATE alerts SET acknowledged = 1 WHERE id IN ({format_strings})", tuple(req.ids))
    conn.commit()
    conn.close()
    return {"status": "success", "count": len(req.ids)}

@app.get("/api/reports/analytics")
def get_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    machine_id: Optional[int] = Query(None),
    operator_name: Optional[str] = Query(None),
    shift: Optional[str] = Query(None)
):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    filters = []
    params = []
    
    if start_date:
        filters.append("timestamp >= %s")
        params.append(start_date)
    if end_date:
        filters.append("timestamp <= %s")
        params.append(end_date)
    if machine_id:
        filters.append("machine_id = %s")
        params.append(machine_id)
    if operator_name and operator_name.strip():
        filters.append("operator_name = %s")
        params.append(operator_name)
    if shift:
        if shift == "1st Shift (6AM - 2PM)":
            filters.append("HOUR(timestamp) >= 6 AND HOUR(timestamp) < 14")
        elif shift == "2nd Shift (2PM - 10PM)":
            filters.append("HOUR(timestamp) >= 14 AND HOUR(timestamp) < 22")
        elif shift == "3rd Shift (10PM - 6AM)":
            filters.append("(HOUR(timestamp) >= 22 OR HOUR(timestamp) < 6)")
            
    where_clause = " WHERE " + " AND ".join(filters) if filters else ""
    polling_interval = 5 
    
    summary_query = f"""
        SELECT 
            COUNT(*) as total_readings,
            SUM(CASE WHEN current_a > 2.0 THEN 1 ELSE 0 END) as active_readings,
            MAX(energy_kwh) - MIN(energy_kwh) as total_energy,
            AVG(voltage_ln_v) as avg_v_ln,
            AVG(voltage_ll_v) as avg_v_ll,
            AVG(current_a) as avg_current,
            AVG(power_kw) as avg_power,
            MAX(power_kw) as peak_power,
            AVG(power_factor) as avg_pf,
            SUM(CASE WHEN power_factor < 0.9 THEN 1 ELSE 0 END) as poor_pf_readings,
            SUM(CASE WHEN current_a <= 2.0 AND current_a > 0.1 THEN power_kw ELSE 0 END) * ({polling_interval} / 3600.0) as idle_energy_kwh
        FROM readings
        {where_clause}
    """
    cursor.execute(summary_query, tuple(params))
    summary_raw = cursor.fetchone() or {}
    
    total_readings = summary_raw.get("total_readings") or 0
    active_readings = summary_raw.get("active_readings") or 0
    
    summary = {
        "total_energy_kwh": float(summary_raw.get("total_energy") or 0),
        "avg_voltage_ln": float(summary_raw.get("avg_v_ln") or 0),
        "avg_voltage_ll": float(summary_raw.get("avg_v_ll") or 0),
        "avg_current": float(summary_raw.get("avg_current") or 0),
        "avg_power": float(summary_raw.get("avg_power") or 0),
        "peak_power": float(summary_raw.get("peak_power") or 0),
        "avg_pf": float(summary_raw.get("avg_pf") or 0),
        "poor_pf_hours": float(summary_raw.get("poor_pf_readings") or 0) * polling_interval / 3600.0,
        "idle_energy_kwh": float(summary_raw.get("idle_energy_kwh") or 0),
        "total_hours": float(total_readings * polling_interval) / 3600.0,
        "active_hours": float(int(active_readings) if active_readings else 0) * polling_interval / 3600.0,
        "idle_hours": float(total_readings - (int(active_readings) if active_readings else 0)) * polling_interval / 3600.0,
    }
    
    operator_query = f"""
        SELECT 
            COALESCE(operator_name, 'Unknown') as operator,
            SUM(CASE WHEN current_a > 2.0 THEN 1 ELSE 0 END) * {polling_interval} / 3600 as active_hours,
            COUNT(*) * {polling_interval} / 3600 as total_hours
        FROM readings
        {where_clause}
        GROUP BY operator
        ORDER BY active_hours DESC
    """
    cursor.execute(operator_query, tuple(params))
    operator_stats = cursor.fetchall()

    trend_query = f"""
        SELECT 
            DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as time_bucket,
            AVG(power_kw) as avg_power,
            AVG(voltage_ln_v) as avg_voltage,
            MAX(energy_kwh) - MIN(energy_kwh) as energy_consumed
        FROM readings
        {where_clause}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
        LIMIT 100
    """
    cursor.execute(trend_query, tuple(params))
    trend_data = cursor.fetchall()
    
    machine_query = f"""
        SELECT 
            COALESCE(machine_name, CONCAT('Machine ', machine_id)) as machine_name,
            SUM(CASE WHEN current_a > 2.0 THEN 1 ELSE 0 END) * {polling_interval} / 3600 as active_hours,
            MAX(energy_kwh) - MIN(energy_kwh) as energy_consumed
        FROM readings
        {where_clause}
        GROUP BY machine_name, machine_id
        ORDER BY active_hours DESC
    """
    cursor.execute(machine_query, tuple(params))
    machine_stats = cursor.fetchall()

    conn.close()
    
    return {
        "summary": summary,
        "operator_stats": operator_stats,
        "trend_data": trend_data,
        "machine_stats": machine_stats
    }

@app.get("/api/reports/filters")
def get_report_filters():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT DISTINCT operator_name FROM worker_details WHERE operator_name IS NOT NULL AND operator_name != ''")
    operators = [row['operator_name'] for row in cursor.fetchall()]
    cursor.execute("SELECT id, name FROM machines ORDER BY id ASC")
    machines = cursor.fetchall()
    conn.close()
    return {"operators": operators, "machines": machines}

@app.get("/api/reports/detailed")
def get_detailed_report(
    search: Optional[str] = Query(None),
    page: int = Query(1),
    limit: int = Query(10)
):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    offset = (page - 1) * limit
    polling_interval = 5
    
    where_sql = ""
    params = []
    
    if search:
        where_sql = "WHERE (COALESCE(r.machine_name, m.name) LIKE %s OR r.operator_name LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])
        
    query = f"""
        SELECT 
            r.machine_id,
            COALESCE(r.machine_name, m.name) as machine_name,
            COALESCE(r.operator_name, 'Unknown') as operator_name,
            MIN(r.timestamp) as start_time,
            MAX(r.timestamp) as end_time,
            COUNT(r.id) * {polling_interval} / 3600 as total_duration_hours,
            SUM(CASE WHEN r.current_a > 2.0 THEN 1 ELSE 0 END) * {polling_interval} / 3600 as working_hours,
            MAX(r.energy_kwh) - MIN(r.energy_kwh) as energy_used
        FROM readings r
        LEFT JOIN machines m ON r.machine_id = m.id
        {where_sql}
        GROUP BY DATE(r.timestamp), r.machine_id, r.machine_name, m.name, r.operator_name
        ORDER BY end_time DESC
        LIMIT %s OFFSET %s
    """
    
    count_query = f"""
        SELECT COUNT(*) as count FROM (
            SELECT 1 
            FROM readings r
            LEFT JOIN machines m ON r.machine_id = m.id
            {where_sql}
            GROUP BY DATE(r.timestamp), r.machine_id, r.machine_name, m.name, r.operator_name
        ) as sub
    """
    
    cursor.execute(count_query, tuple(params))
    total_count = cursor.fetchone()["count"]
    
    # Execute paginated query
    query_params = params + [limit, offset]
    cursor.execute(query, tuple(query_params))
    rows = cursor.fetchall()
    
    conn.close()
    
    now = datetime.now()
    results = []
    for row in rows:
        end_time = row["end_time"]
        working_hrs_raw = row.get("working_hours")
        total_hrs_raw = row.get("total_duration_hours")
        energy_raw = row.get("energy_used")
        
        working_hours = float(working_hrs_raw) if working_hrs_raw is not None else 0.0
        total_duration = float(total_hrs_raw) if total_hrs_raw is not None else 0.0
        energy_used = float(energy_raw) if energy_raw is not None else 0.0
        
        idle_hours = max(0, total_duration - working_hours)
        efficiency = (working_hours / total_duration * 100) if total_duration > 0 else 0
        
        status = "Offline"
        if end_time:
            time_diff = (now - end_time).total_seconds()
            if time_diff <= 300:
                status = "Running"
            else:
                status = "Idle"
        
        row["start_time"] = row["start_time"].isoformat() + "Z" if row.get("start_time") else None
        row["end_time"] = row["end_time"].isoformat() + "Z" if row.get("end_time") else None
        row["idle_hours"] = idle_hours
        row["efficiency"] = efficiency
        row["status"] = status
        row["working_hours"] = working_hours
        row["total_duration_hours"] = total_duration
        row["energy_used"] = energy_used
        results.append(row)
        
    return {
        "data": results,
        "total": total_count,
        "page": page,
        "limit": limit
    }

@app.get("/api/stats/summary")
def get_summary():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT MIN(voltage_ln_v) as min_v, MAX(voltage_ln_v) as max_v, AVG(voltage_ln_v) as avg_v FROM readings")
    stats = cursor.fetchone() or {}
    conn.close()
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
