#!/usr/bin/env python3
"""
Fetch biometric attendance data and output as JSON
Based on the original dtr.py logic - NO TIME CORRECTION
"""

import sys
import json
import datetime
import zk

# Import shared configuration and database manager
from config import get_db_config
from database import Database

def get_biometric_from_db(biometric_id):
    """Get biometric device info from database"""
    try:
        db_config = get_db_config()
        
        # Use the new Database class with automatic reconnection
        db = Database(
            host=db_config.get('host', '192.168.1.52'),
            user=db_config.get('user', 'adtr'),
            password=db_config.get('password', 'adtr'),
            database=db_config.get('database', 'new_dtr'),
            port=int(db_config.get('port', 3306))
        )
        
        db.execute("SELECT * FROM biometrics WHERE id = %s", (biometric_id,))
        biometric_data = db.fetchone()
        db.close()
        
        return biometric_data
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)
        return None

def fetch_biometric_attendance(biometric_id, start_date=None, end_date=None, employee_id=None):
    """
    Fetch attendance from biometric device
    Uses the ORIGINAL dtr.py logic - attendance.timestamp is used AS-IS
    """
    try:
        # Get biometric device info from database
        biometric_data = get_biometric_from_db(biometric_id)
        
        if not biometric_data:
            raise Exception(f'Biometric device {biometric_id} not found')
        
        # Unpack biometric data tuple (id, name, ip_address, port, active)
        bm_id, bm_name, bm_ip, bm_port, bm_active = biometric_data
        
        print(f"Connecting to biometric device: {bm_ip}:{bm_port}", file=sys.stderr)
        
        # Create ZK instance (same as original dtr.py)
        biometric = zk.ZK(
            bm_ip,
            port=int(bm_port),
            timeout=5000,
            password=0,
            force_udp=False,
            ommit_ping=False
        )
        
        # Connect to device
        print("Attempting to connect to device...", file=sys.stderr)
        connection = biometric.connect()
        print("Successfully connected to device", file=sys.stderr)
        
        # Get device time for debugging
        try:
            device_time = biometric.get_time()
            print(f"Device current time: {device_time}", file=sys.stderr)
        except:
            print("Could not get device time", file=sys.stderr)
        
        # Parse dates if provided
        start = None
        end = None
        if start_date and start_date != 'null' and start_date != '':
            start = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
        if end_date and end_date != 'null' and end_date != '':
            end = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Get attendance from device
        print("Fetching attendance records...", file=sys.stderr)
        attendances = biometric.get_attendance()
        print(f"Found {len(attendances)} raw attendance records", file=sys.stderr)
        
        # Format output - USING ORIGINAL dtr.py LOGIC
        results = []
        for attendance in attendances:
            # ORIGINAL LOGIC: temp_datetime = attendance.timestamp (NO CORRECTION)
            temp_datetime = attendance.timestamp
            
            # ORIGINAL LOGIC: Date filtering on temp_datetime.date()
            if start and end:
                if not (temp_datetime.date() >= start and temp_datetime.date() <= end):
                    continue
            elif start and not end:
                if not (temp_datetime.date() >= start):
                    continue
            elif not start and end:
                if not (temp_datetime.date() <= end):
                    continue
            
            # ORIGINAL LOGIC: employee_number = attendance.user_id
            employee_number = attendance.user_id
            if employee_id and str(employee_number) != str(employee_id):
                continue
            
            # Format for JSON output (same data structure as original)
            formatted_date = temp_datetime.strftime('%Y-%m-%d')
            formatted_time = temp_datetime.strftime('%H:%M:%S')
            full_timestamp = f"{formatted_date} {formatted_time}"
            
            results.append({
                'user_id': str(employee_number),
                'timestamp': full_timestamp,
                'date': formatted_date,
                'time': formatted_time
            })
        
        print(f"Returning {len(results)} filtered records", file=sys.stderr)
        
        # Show sample of what we're returning
        if results:
            print("Sample records (original timestamp from device):", file=sys.stderr)
            for i, record in enumerate(results[:5]):
                print(f"  {i+1}. User {record['user_id']} at {record['timestamp']}", file=sys.stderr)
        
        biometric.disconnect()
        print("Disconnected from biometric device", file=sys.stderr)
        return results
        
    except Exception as e:
        print(f"Error in fetch_biometric_attendance: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: fetch_biometric.py <biometric_id> [start_date] [end_date]", file=sys.stderr)
        print("Example: fetch_biometric.py 1 2024-01-01 2024-01-31", file=sys.stderr)
        sys.exit(1)
    
    try:
        biometric_id = int(sys.argv[1])
        start_date = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != 'null' and sys.argv[2] != '' else None
        end_date = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != 'null' and sys.argv[3] != '' else None
        
        print(f"Starting biometric fetch: id={biometric_id}, start={start_date}, end={end_date}", file=sys.stderr)
        
        # Fetch attendance
        employee_id = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
        attendances = fetch_biometric_attendance(biometric_id, start_date, end_date, employee_id)
        
        # Output as JSON (Node.js will read this)
        print(json.dumps(attendances, separators=(',', ':')))
        
        print(f"Biometric fetch completed successfully. Total records: {len(attendances)}", file=sys.stderr)
        
    except ValueError as e:
        print(f"Error: Biometric ID must be a number. Got: {sys.argv[1]}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
