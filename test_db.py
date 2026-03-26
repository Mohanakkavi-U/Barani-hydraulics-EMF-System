import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD") or "843875",
    "database": os.getenv("DB_NAME", "energy_monitor"),
    "port":     int(os.getenv("DB_PORT", 3306)),
}

try:
    print(f"Connecting to MySQL with user={DB_CONFIG['user']} and host={DB_CONFIG['host']}...")
    conn = mysql.connector.connect(**DB_CONFIG)
    print("Success! connection established.")
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    print("Query executed.")
    conn.close()
    print("Connection closed.")
except mysql.connector.Error as err:
    print(f"Error: {err}")
except Exception as e:
    print(f"Exception: {e}")
