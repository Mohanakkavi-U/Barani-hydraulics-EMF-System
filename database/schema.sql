CREATE DATABASE IF NOT EXISTS energy_monitor;
USE energy_monitor;

CREATE TABLE IF NOT EXISTS machines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status ENUM('on', 'off') DEFAULT 'on',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    voltage_ln_v DECIMAL(10,2) NOT NULL,
    voltage_ll_v DECIMAL(10,2) DEFAULT 0,
    current_a DECIMAL(10,2) NOT NULL,
    power_kw DECIMAL(10,2) NOT NULL,
    energy_kwh DECIMAL(10,4) NOT NULL,
    power_factor DECIMAL(5,3) NOT NULL,
    frequency_hz DECIMAL(5,2) NOT NULL,
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT,
    reading_id INT,
    severity ENUM('critical', 'warning', 'info') NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE CASCADE
);

-- Insert sample machine
INSERT IGNORE INTO machines (id, name, status) VALUES (1, 'Machine Shop 1', 'on');
