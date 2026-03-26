-- ============================================================
-- Energy Monitoring System – MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS energy_monitor
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE energy_monitor;

-- ── READINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS readings (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    voltage_v    DECIMAL(8,3)  NOT NULL COMMENT 'Volts',
    current_a    DECIMAL(8,3)  NOT NULL COMMENT 'Amperes',
    power_kw     DECIMAL(10,3) NOT NULL COMMENT 'Kilowatts',
    energy_kwh   DECIMAL(12,4) NOT NULL COMMENT 'Kilowatt-hours',
    power_factor DECIMAL(5,4)  NOT NULL COMMENT '0.0000 – 1.0000',
    frequency_hz DECIMAL(7,3)  NOT NULL COMMENT 'Hertz',
    notes        TEXT          COMMENT 'Optional operator note',
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_timestamp (timestamp),
    INDEX idx_voltage   (voltage_v),
    INDEX idx_pf        (power_factor),
    INDEX idx_freq      (frequency_hz)
) ENGINE=InnoDB;

-- ── ALERTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reading_id   INT UNSIGNED  NOT NULL,
    parameter    VARCHAR(64)   NOT NULL COMMENT 'e.g. Voltage, Power Factor',
    severity     ENUM('info','warning','critical') NOT NULL,
    message      TEXT          NOT NULL,
    value        DECIMAL(12,4) NOT NULL COMMENT 'Measured value that triggered alert',
    threshold    VARCHAR(128)  NOT NULL COMMENT 'Human-readable threshold description',
    acknowledged TINYINT(1)    NOT NULL DEFAULT 0,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY fk_reading (reading_id)
        REFERENCES readings(id)
        ON DELETE CASCADE,

    INDEX idx_severity     (severity),
    INDEX idx_acknowledged (acknowledged),
    INDEX idx_created_at   (created_at)
) ENGINE=InnoDB;

-- ── VIEWS ───────────────────────────────────────────────────

-- Hourly energy summary
CREATE OR REPLACE VIEW vw_hourly_summary AS
SELECT
    DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') AS hour_bucket,
    COUNT(*)                 AS sample_count,
    ROUND(AVG(voltage_v),2)  AS avg_voltage_v,
    ROUND(AVG(current_a),2)  AS avg_current_a,
    ROUND(AVG(power_kw),3)   AS avg_power_kw,
    ROUND(SUM(energy_kwh),4) AS total_energy_kwh,
    ROUND(AVG(power_factor),4) AS avg_power_factor,
    ROUND(AVG(frequency_hz),3) AS avg_frequency_hz,
    ROUND(MAX(power_kw),3)   AS peak_power_kw,
    ROUND(MIN(power_factor),4) AS min_power_factor
FROM readings
GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
ORDER BY hour_bucket DESC;

-- Daily summary
CREATE OR REPLACE VIEW vw_daily_summary AS
SELECT
    DATE(timestamp)          AS day,
    COUNT(*)                 AS sample_count,
    ROUND(AVG(voltage_v),2)  AS avg_voltage_v,
    ROUND(AVG(current_a),2)  AS avg_current_a,
    ROUND(AVG(power_kw),3)   AS avg_power_kw,
    ROUND(SUM(energy_kwh),4) AS total_energy_kwh,
    ROUND(AVG(power_factor),4) AS avg_pf,
    ROUND(MIN(power_factor),4) AS min_pf,
    ROUND(MAX(power_kw),3)   AS peak_power_kw
FROM readings
GROUP BY DATE(timestamp)
ORDER BY day DESC;

-- Unacknowledged active alerts
CREATE OR REPLACE VIEW vw_active_alerts AS
SELECT
    a.*,
    r.timestamp      AS reading_time,
    r.voltage_v,
    r.power_factor,
    r.frequency_hz
FROM alerts a
JOIN readings r ON a.reading_id = r.id
WHERE a.acknowledged = 0
ORDER BY
    FIELD(a.severity, 'critical','warning','info'),
    a.created_at DESC;

-- ── SAMPLE DATA (remove before production) ──────────────────
INSERT INTO readings (timestamp, voltage_v, current_a, power_kw, energy_kwh, power_factor, frequency_hz, notes) VALUES
('2025-01-01 08:00:00', 223.5, 12.4, 2.77, 0.0462, 0.975, 50.02, 'Morning shift start'),
('2025-01-01 08:15:00', 221.8, 14.1, 3.13, 0.0521, 0.961, 49.98, NULL),
('2025-01-01 08:30:00', 224.2, 16.8, 3.77, 0.0628, 0.943, 50.01, 'Machine B started'),
('2025-01-01 08:45:00', 218.5, 18.2, 3.98, 0.0663, 0.875, 49.95, 'PF degraded'),
('2025-01-01 09:00:00', 225.0, 15.5, 3.49, 0.0582, 0.958, 50.03, NULL),
('2025-01-01 09:15:00', 196.2, 22.0, 4.32, 0.0720, 0.822, 49.45, 'Low voltage event');
