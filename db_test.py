import json
import serial
import psycopg2

# 1. Database Connection Configuration
DB_CONFIG = dict(
    host="localhost",
    port=5432,
    dbname="livedata",
    user="postgres",
    password="Shravani17(*)"
)

# 2. Bluetooth Serial Configuration
# Replace 'COM3' with the actual Outgoing Bluetooth COM Port of your ESP32
BT_PORT = "COM3"
BAUD_RATE = 115200


def create_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id          SERIAL PRIMARY KEY,
            device_name TEXT NOT NULL,
            temperature DOUBLE PRECISION,
            humidity    DOUBLE PRECISION,
            created_at  TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS messages (
            id          SERIAL PRIMARY KEY,
            sender      TEXT,
            message     TEXT NOT NULL,
            created_at  TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS images (
            id          SERIAL PRIMARY KEY,
            file_name   TEXT NOT NULL,
            file_path   TEXT NOT NULL,
            size_bytes  INTEGER,
            created_at  TIMESTAMP DEFAULT NOW()
        );
    """)


def process_and_insert(data, cur, conn):
    """Parses incoming JSON payloads and routes them to the correct PostgreSQL table."""
    payload_type = data.get("type")

    if payload_type == "sensor_reading":
        cur.execute(
            """
            INSERT INTO sensor_readings (device_name, temperature, humidity)
            VALUES (%s, %s, %s)
            """,
            (data.get("device_name"), data.get("temperature"), data.get("humidity"))
        )
        conn.commit()
        print(f"[Inserted -> sensor_readings]: {data.get('device_name')} | Temp: {data.get('temperature')}°C | Hum: {data.get('humidity')}%")

    elif payload_type == "message":
        cur.execute(
            """
            INSERT INTO messages (sender, message)
            VALUES (%s, %s)
            """,
            (data.get("sender"), data.get("message"))
        )
        conn.commit()
        print(f"[Inserted -> messages]: From: {data.get('sender')} | Message: {data.get('message')}")

    elif payload_type == "image_metadata":
        cur.execute(
            """
            INSERT INTO images (file_name, file_path, size_bytes)
            VALUES (%s, %s, %s)
            """,
            (data.get("file_name"), data.get("file_path"), data.get("size_bytes"))
        )
        conn.commit()
        print(f"[Inserted -> images]: File: {data.get('file_name')} ({data.get('size_bytes')} bytes)")

    else:
        print(f"[Unknown Payload Type]: {data}")


def main():
    conn = None
    bt_serial = None

    try:
        # Step A: Connect to PostgreSQL Database
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print(f"Connected to PostgreSQL database: '{DB_CONFIG['dbname']}'")

        # Step B: Ensure all tables exist
        create_tables(cur)
        conn.commit()
        print("Database tables created/verified successfully.")

        # Step C: Connect to ESP32 Bluetooth
        print(f"Opening Bluetooth connection on {BT_PORT}...")
        bt_serial = serial.Serial(BT_PORT, BAUD_RATE, timeout=3)
        print(f"Connected to ESP32 on {BT_PORT}! Listening for incoming data...\n")

        # Step D: Read incoming lines continuously
        while True:
            if bt_serial.in_waiting > 0:
                raw_line = bt_serial.readline().decode('utf-8', errors='ignore').strip()
                if not raw_line:
                    continue

                try:
                    # Parse JSON stream from ESP32
                    data = json.loads(raw_line)
                    process_and_insert(data, cur, conn)

                except json.JSONDecodeError:
                    print(f"[Raw Serial Text]: {raw_line}")

    except serial.SerialException as e:
        print(f"\nBluetooth Connection Error: {e}")
        print("Please verify ESP32 power status and check the COM port number in Windows Device Manager.")
    except psycopg2.Error as e:
        print(f"\nDatabase Error: {e}")
    except KeyboardInterrupt:
        print("\nStopping Bluetooth listener...")
    finally:
        if bt_serial and bt_serial.is_open:
            bt_serial.close()
            print("Bluetooth serial port closed.")
        if conn:
            conn.close()
            print("PostgreSQL connection closed.")


if __name__ == "__main__":
    main()