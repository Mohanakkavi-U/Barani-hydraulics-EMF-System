"""
Energy Monitoring System - FastAPI Backend
Requirements: pip install fastapi uvicorn mysql-connector-python python-dotenv
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Energy Monitoring System API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
#  DB CONFIG  (set in .env or environment)
# ──────────────────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD") or "843875",
    "database": os.getenv("DB_NAME", "energy_monitor"),
    "port":     int(os.getenv("DB_PORT", 3306)),
}


def get_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Create machines table first
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS machines (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            name         VARCHAR(100)    NOT NULL,
            photo_url    TEXT,
            status       ENUM('on', 'off') DEFAULT 'off',
            is_active    TINYINT(1)      DEFAULT 1,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Ensure all columns exist in machines (migration)
    cursor.execute("SHOW COLUMNS FROM machines")
    cols = [r[0] for r in cursor.fetchall()]
    if "photo_url" not in cols:
        cursor.execute("ALTER TABLE machines ADD COLUMN photo_url TEXT")
    if "status" not in cols:
        cursor.execute("ALTER TABLE machines ADD COLUMN status ENUM('on', 'off') DEFAULT 'off'")
    if "is_active" not in cols:
        cursor.execute("ALTER TABLE machines ADD COLUMN is_active TINYINT(1) DEFAULT 1")
    if "created_at" not in cols:
        cursor.execute("ALTER TABLE machines ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
    conn.commit()
    
    # 2. Seed initial machines if empty
    cursor.execute("SELECT COUNT(*) FROM machines")
    if cursor.fetchone()[0] == 0:
        initial_machines = [
            ("Machine LA1", "https://img.icons8.com/bubbles/200/000000/processor.png", "off"),
            ("Machine LA2", "https://img.icons8.com/bubbles/200/000000/server.png", "off"),
            ("Machine LA3", "https://img.icons8.com/bubbles/200/000000/fan.png", "off"),
            ("Machine LA4", "https://img.icons8.com/bubbles/200/000000/modem.png", "off"),
            ("Machine LA5", "https://img.icons8.com/bubbles/200/000000/engine.png", "off"),
        ]
        cursor.executemany(
            "INSERT INTO machines (name, photo_url, status) VALUES (%s, %s, %s)",
            initial_machines
        )
        conn.commit()

    # 3. Handle readings table
    cursor.execute("SHOW TABLES LIKE 'readings'")
    table_exists = cursor.fetchone()

    if not table_exists:
        cursor.execute("""
            CREATE TABLE readings (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                machine_id   INT             NOT NULL,
                timestamp    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                voltage_v    DECIMAL(8,3)    NOT NULL,
                current_a    DECIMAL(8,3)    NOT NULL,
                power_kw     DECIMAL(10,3)   NOT NULL,
                energy_kwh   DECIMAL(12,4)   NOT NULL,
                power_factor DECIMAL(5,4)    NOT NULL,
                frequency_hz DECIMAL(7,3)    NOT NULL,
                notes        TEXT,
                created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
            )
        """)
    else:
        # Table exists, check for column
        cursor.execute("SHOW COLUMNS FROM readings LIKE 'machine_id'")
        if not cursor.fetchone():
            # Add column as nullable first
            cursor.execute("ALTER TABLE readings ADD COLUMN machine_id INT NULL AFTER id")
            # Update all existing readings to machine #1
            cursor.execute("SELECT id FROM machines LIMIT 1")
            first_m = cursor.fetchone()
            if first_m:
                cursor.execute("UPDATE readings SET machine_id = %s", (first_m[0],))
            # Now make it NOT NULL and add FK
            cursor.execute("ALTER TABLE readings MODIFY COLUMN machine_id INT NOT NULL")
            cursor.execute("ALTER TABLE readings ADD CONSTRAINT fk_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            reading_id   INT             NOT NULL,
            parameter    VARCHAR(64)     NOT NULL,
            severity     ENUM('info','warning','critical') NOT NULL,
            message      TEXT            NOT NULL,
            value        DECIMAL(12,4)   NOT NULL,
            threshold    VARCHAR(128)    NOT NULL,
            acknowledged TINYINT(1)      NOT NULL DEFAULT 0,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()


@app.on_event("startup")
def startup():
    init_db()


# ──────────────────────────────────────────────
#  SCHEMAS
# ──────────────────────────────────────────────

class MachineCreate(BaseModel):
    name: str
    photo_url: Optional[str] = None
    status: Optional[str] = "off"

class Machine(MachineCreate):
    id: int
    is_active: bool
    created_at: datetime

class ReadingCreate(BaseModel):
    machine_id:   int = Field(..., description="Machine ID")
    voltage_v:    float = Field(..., ge=0, le=1000,   description="Voltage in Volts")
    current_a:    float = Field(..., ge=0, le=10000,  description="Current in Amperes")
    power_kw:     float = Field(..., ge=0, le=100000, description="Power in kilowatts")
    energy_kwh:   float = Field(..., ge=0,             description="Energy in kWh")
    power_factor: float = Field(..., ge=0, le=1,       description="Power Factor 0-1")
    frequency_hz: float = Field(..., ge=0, le=100,     description="Frequency in Hz")
    notes:        Optional[str] = None

    @validator("power_factor")
    def pf_range(cls, v):
        if not (0.0 <= v <= 1.0):
            raise ValueError("Power Factor must be between 0 and 1")
        return v


class Reading(ReadingCreate):
    id:         int
    timestamp:  datetime
    created_at: datetime

    class Config:
        orm_mode = True


class Alert(BaseModel):
    id:           int
    reading_id:   int
    parameter:    str
    severity:     str
    message:      str
    value:        float
    threshold:    str
    acknowledged: bool
    created_at:   datetime


# ──────────────────────────────────────────────
#  ALERT ENGINE
# ──────────────────────────────────────────────

THRESHOLDS = {
    "voltage_v": [
        {"severity": "critical", "cond": lambda v: v < 200 or v > 260,
         "msg": lambda v: f"Voltage {v:.1f}V is critically out of range",
         "threshold": "200–260 V"},
        {"severity": "warning",  "cond": lambda v: v < 210 or v > 240,
         "msg": lambda v: f"Voltage {v:.1f}V outside normal range",
         "threshold": "210–240 V"},
    ],
    "current_a": [
        {"severity": "critical", "cond": lambda v: v > 150,
         "msg": lambda v: f"Current {v:.1f}A dangerously high",
         "threshold": "< 150 A"},
        {"severity": "warning",  "cond": lambda v: v > 100,
         "msg": lambda v: f"Current {v:.1f}A above recommended",
         "threshold": "< 100 A"},
    ],
    "power_factor": [
        {"severity": "critical", "cond": lambda v: v < 0.80,
         "msg": lambda v: f"Power Factor {v:.3f} critically low",
         "threshold": ">= 0.80"},
        {"severity": "warning",  "cond": lambda v: v < 0.95,
         "msg": lambda v: f"Power Factor {v:.3f} below ideal",
         "threshold": ">= 0.95"},
    ],
    "frequency_hz": [
        {"severity": "critical", "cond": lambda v: v < 49.0 or v > 51.0,
         "msg": lambda v: f"Frequency {v:.2f}Hz critical deviation",
         "threshold": "49.0–51.0 Hz"},
        {"severity": "warning",  "cond": lambda v: v < 49.5 or v > 50.5,
         "msg": lambda v: f"Frequency {v:.2f}Hz outside normal",
         "threshold": "49.5–50.5 Hz"},
    ],
    "power_kw": [
        {"severity": "warning",  "cond": lambda v: v > 500,
         "msg": lambda v: f"Power {v:.1f}kW above threshold",
         "threshold": "< 500 kW"},
    ],
}


def check_alerts(reading_id: int, data: dict, cursor, conn):
    param_map = {
        "voltage_v":    data["voltage_v"],
        "current_a":    data["current_a"],
        "power_factor": data["power_factor"],
        "frequency_hz": data["frequency_hz"],
        "power_kw":     data["power_kw"],
    }
    label_map = {
        "voltage_v":    "Voltage",
        "current_a":    "Current",
        "power_factor": "Power Factor",
        "frequency_hz": "Frequency",
        "power_kw":     "Power",
    }

    for param, value in param_map.items():
        rules = THRESHOLDS.get(param, [])
        for rule in rules:
            if rule["cond"](value):
                cursor.execute("""
                    INSERT INTO alerts (reading_id, parameter, severity, message, value, threshold)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    reading_id,
                    label_map[param],
                    rule["severity"],
                    rule["msg"](value),
                    value,
                    rule["threshold"],
                ))
                break  # highest-severity only per parameter
    conn.commit()


# ──────────────────────────────────────────────
#  ROUTES
# ──────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# --- Machine Endpoints ---

@app.get("/api/machines", response_model=List[dict])
def get_machines():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM machines WHERE is_active = 1")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        if isinstance(row["created_at"], datetime):
            row["created_at"] = row["created_at"].isoformat()
    return rows

@app.post("/api/machines", response_model=dict, status_code=201)
def create_machine(machine: MachineCreate):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "INSERT INTO machines (name, photo_url, status) VALUES (%s, %s, %s)",
        (machine.name, machine.photo_url, machine.status)
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.execute("SELECT * FROM machines WHERE id = %s", (new_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if isinstance(row["created_at"], datetime):
        row["created_at"] = row["created_at"].isoformat()
    return row

@app.put("/api/machines/{machine_id}/status")
def update_machine_status(machine_id: int, status: str):
    if status not in ["on", "off"]:
        raise HTTPException(status_code=400, detail="Status must be 'on' or 'off'")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE machines SET status = %s WHERE id = %s",
        (status, machine_id)
    )
    conn.commit()
    if cursor.rowcount == 0:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Machine not found")
    cursor.close()
    conn.close()
    return {"message": "Machine status updated"}

# --- Reading Endpoints ---

@app.get("/api/readings", response_model=List[dict])
def get_readings(limit: int = 500, machine_id: Optional[int] = None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    if machine_id:
        cursor.execute(
            "SELECT r.*, m.name as machine_name FROM readings r JOIN machines m ON r.machine_id = m.id WHERE r.machine_id = %s ORDER BY r.timestamp ASC LIMIT %s",
            (machine_id, limit)
        )
    else:
        cursor.execute(
            "SELECT r.*, m.name as machine_name FROM readings r JOIN machines m ON r.machine_id = m.id ORDER BY r.timestamp ASC LIMIT %s",
            (limit,)
        )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        for k, v in row.items():
            if hasattr(v, "__float__"):
                row[k] = float(v)
            if isinstance(v, datetime):
                row[k] = v.isoformat()
    return rows


@app.post("/api/readings", response_model=dict, status_code=201)
def create_reading(body: ReadingCreate):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # Verify machine exists
    cursor.execute("SELECT id FROM machines WHERE id = %s", (body.machine_id,))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Machine not found")

    cursor.execute("""
        INSERT INTO readings
            (machine_id, voltage_v, current_a, power_kw, energy_kwh, power_factor, frequency_hz, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        body.machine_id, body.voltage_v, body.current_a, body.power_kw,
        body.energy_kwh, body.power_factor, body.frequency_hz,
        body.notes,
    ))
    conn.commit()
    new_id = cursor.lastrowid

    check_alerts(new_id, body.dict(), cursor, conn)

    cursor.execute("SELECT * FROM readings WHERE id = %s", (new_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=500, detail="Failed to retrieve created record")

    for k, v in row.items():
        if hasattr(v, "__float__"):
            row[k] = float(v)
        if isinstance(v, datetime):
            row[k] = v.isoformat()
    return row


@app.get("/api/alerts", response_model=List[dict])
def get_alerts(acknowledged: Optional[bool] = None, limit: int = 200):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    if acknowledged is None:
        cursor.execute(
            "SELECT a.*, m.name as machine_name FROM alerts a JOIN readings r ON a.reading_id = r.id JOIN machines m ON r.machine_id = m.id ORDER BY a.created_at DESC LIMIT %s",
            (limit,)
        )
    else:
        cursor.execute(
            "SELECT a.*, m.name as machine_name FROM alerts a JOIN readings r ON a.reading_id = r.id JOIN machines m ON r.machine_id = m.id WHERE a.acknowledged = %s ORDER BY a.created_at DESC LIMIT %s",
            (int(acknowledged), limit),
        )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        for k, v in row.items():
            if hasattr(v, "__float__"):
                row[k] = float(v)
            if isinstance(v, datetime):
                row[k] = v.isoformat()
    return rows


@app.put("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE alerts SET acknowledged = 1 WHERE id = %s", (alert_id,)
    )
    if cursor.rowcount == 0:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "Alert acknowledged"}


@app.get("/api/stats/summary")
def get_summary(machine_id: Optional[int] = None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    where_clause = ""
    params = []
    if machine_id:
        where_clause = "WHERE machine_id = %s"
        params = [machine_id]
        
    query = f"""
        SELECT
            COUNT(*)               AS total_readings,
            AVG(voltage_v)         AS avg_voltage,
            AVG(current_a)         AS avg_current,
            AVG(power_kw)          AS avg_power,
            SUM(energy_kwh)        AS total_energy,
            AVG(power_factor)      AS avg_pf,
            AVG(frequency_hz)      AS avg_freq,
            MAX(power_kw)          AS peak_power,
            MIN(power_factor)      AS min_pf
        FROM readings
        {where_clause}
    """
    cursor.execute(query, params)
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return {k: float(v) if v is not None and hasattr(v, "__float__") else v for k, v in row.items()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
