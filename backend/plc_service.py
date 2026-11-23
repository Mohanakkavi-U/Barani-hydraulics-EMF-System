import os
import time
import threading
import snap7
from snap7.util import get_real
from dotenv import load_dotenv

# Load explicitly to ensure .env is parsed if not already
load_dotenv()

class PLCService(threading.Thread):
    def __init__(self, machine_id: int, ip_address: str, db_number: int, rack: int = 0, slot: int = 1):
        super().__init__()
        self.machine_id = machine_id
        self.ip_address = ip_address
        self.db_number = db_number
        self.rack = rack
        self.slot = slot
        self.plc = snap7.client.Client()
        self.running = False
        self.daemon = True # Allows thread to exit when main program exits

    def connect(self):
        try:
            # Only connect if not connected
            if not self.plc.get_connected():
                self.plc.connect(self.ip_address, self.rack, self.slot)
                print(f"[PLC] Machine {self.machine_id} connected to S7-1200 at {self.ip_address}")
        except Exception as e:
            print(f"[PLC] Machine {self.machine_id} connection failed to {self.ip_address}: {e}")

    def run(self):
        self.running = True
        print(f"[PLC] Background service started for Machine {self.machine_id}. Polling PLC at {self.ip_address}...")
        
        while self.running:
            try:
                self.connect()
                
                if self.plc.get_connected():
                    # Read DB: According to provided memory map
                    # 120 bytes covers up to offset 116 (Total net kWh) + 4 bytes REAL
                    raw_data = self.plc.db_read(self.db_number, 0, 120)
                    
                    voltage_ln_v = get_real(raw_data, 12) # Average Voltage LN
                    voltage_ll_v = get_real(raw_data, 28) # Average Voltage LL
                    current_a = get_real(raw_data, 44)    # Average Current
                    power_kw = get_real(raw_data, 84)     # Total KW
                    power_factor = get_real(raw_data, 108)# Average PF
                    frequency_hz = get_real(raw_data, 112)# Frequency
                    energy_kwh = get_real(raw_data, 116)  # Total net kWh
                    
                    from main import ReadingCreate
                    
                    reading = ReadingCreate(
                        machine_id=self.machine_id,
                        voltage_ln_v=voltage_ln_v,
                        voltage_ll_v=voltage_ll_v,
                        current_a=current_a,
                        power_kw=power_kw,
                        energy_kwh=energy_kwh,
                        power_factor=power_factor,
                        frequency_hz=frequency_hz,
                        notes="Auto-polled from PLC"
                    )
                    
                    self.save_reading_to_db(reading)
                
            except Exception as e:
                print(f"[PLC] Error reading from PLC Machine {self.machine_id}: {e}")
            
            # Sleep for 1 second before next poll
            time.sleep(1)

    def save_reading_to_db(self, reading):
        from main import get_db, evaluate_thresholds
        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            
            # Fetch current worker details
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
            
            # Broadcast delta to active websockets
            from main import reading_broadcast_queue
            from datetime import datetime
            reading_dict = {
                "id": reading_id,
                "machine_id": reading.machine_id,
                "voltage_ln_v": reading.voltage_ln_v,
                "voltage_ll_v": reading.voltage_ll_v,
                "current_a": reading.current_a,
                "power_kw": reading.power_kw,
                "energy_kwh": reading.energy_kwh,
                "power_factor": reading.power_factor,
                "frequency_hz": reading.frequency_hz,
                "notes": reading.notes,
                "operator_name": machine.get("operator_name"),
                "work_order_id": machine.get("work_order_id"),
                "part_name": machine.get("part_name"),
                "timestamp": datetime.now().isoformat()
            }
            reading_broadcast_queue.put(reading_dict)
        except Exception as e:
            print(f"[PLC] Error saving reading to DB: {e}")

    def stop(self):
        self.running = False
        if self.plc.get_connected():
            self.plc.disconnect()
            print(f"[PLC] Machine {self.machine_id} disconnect requested")

class PLCManagerContext:
    def __init__(self):
        self.threads = {}
        
    def add_service(self, machine_id, ip, db_number):
        if not ip or db_number is None:
            return
        # Stop existing thread for same machine if exists
        if machine_id in self.threads:
            self.stop_service(machine_id)
            
        thread = PLCService(machine_id, ip, db_number)
        self.threads[machine_id] = thread
        thread.start()
        
    def stop_service(self, machine_id):
        if machine_id in self.threads:
            self.threads[machine_id].stop()
            self.threads[machine_id].join(timeout=2)
            del self.threads[machine_id]
            
    def stop_all(self):
        for m_id in list(self.threads.keys()):
            self.stop_service(m_id)

plc_manager = PLCManagerContext()

def start_all_plc_services():
    from main import get_db
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        # Only select machines that have a PLC IP assigned
        cursor.execute("SELECT id, plc_ip, plc_db_number FROM machines WHERE plc_ip IS NOT NULL AND plc_ip != ''")
        machines = cursor.fetchall()
        conn.close()
        
        for m in machines:
            plc_manager.add_service(m['id'], m['plc_ip'], m['plc_db_number'])
    except Exception as e:
        print(f"[PLC] Failed to start dynamic PLC services: {e}")

def stop_all_plc_services():
    plc_manager.stop_all()
