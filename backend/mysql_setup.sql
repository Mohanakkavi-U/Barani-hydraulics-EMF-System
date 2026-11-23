    -- MySQL Database Setup for Energy Monitor
-- Run this script in MySQL Workbench

-- Create database
CREATE DATABASE IF NOT EXISTS energy_monitor;
USE energy_monitor;

-- Create tables
CREATE TABLE IF NOT EXISTS machines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'on',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    voltage_ln_v FLOAT NOT NULL,
    voltage_ll_v FLOAT DEFAULT 0,
    current_a FLOAT NOT NULL,
    power_kw FLOAT NOT NULL,
    energy_kwh FLOAT NOT NULL,
    power_factor FLOAT NOT NULL,
    frequency_hz FLOAT NOT NULL,
    notes TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT,
    reading_id INT,
    severity VARCHAR(50) NOT NULL,
    parameter VARCHAR(255),
    message TEXT NOT NULL,
    acknowledged TINYINT DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE CASCADE
);

-- Insert sample data (you can replace this with your actual data)
INSERT INTO machines (id, name, status, created_at) VALUES
(1, 'Machine Shop 1', 'on', '2026-03-26 08:52:40'),
(2, 'LA:1', 'on', '2026-03-26 09:01:29'),
(4, 'L5', 'on', '2026-03-26 10:03:51'),
(5, 'M2', 'on', '2026-03-26 10:14:26'),
(6, 'LA:6', 'on', '2026-03-26 12:00:59'),
(8, 'LA 9', 'on', '2026-03-28 05:12:22'),
(9, 'LA:&', 'on', '2026-03-30 10:35:58');

-- Note: Add your readings and alerts data here
-- You can export your SQLite data and convert it to MySQL INSERT statements