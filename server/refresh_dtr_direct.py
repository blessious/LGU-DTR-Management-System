import mysql.connector
import sys
import json
import os
import time
import collections
from datetime import datetime, timedelta
from collections import defaultdict

# Import shared configuration
from config import get_db_config

# Database configuration - USE DYNAMIC SETTINGS FROM config.json
db_config_dict = get_db_config()
db_config = {
    'host': db_config_dict.get('host', '192.168.1.52'),
    'user': db_config_dict.get('user', 'adtr'),
    'password': db_config_dict.get('password', 'adtr'),
    'database': db_config_dict.get('database', 'bless_dtr_test'),
    'port': int(db_config_dict.get('port', 3306))
}

def print_header(title):
    print("\n" + "=" * 60)
    print(f"=== {title} ===")
    print("=" * 60)

def print_status(status, message):
    symbols = {
        "ok": "[OK]",
        "warn": "[WARN]",
        "error": "[ERROR]",
        "info": "[INFO]",
        "start": "[...]"
    }
    print(f"{symbols.get(status, '')} {message}")

def print_summary(total, success, failed, duration):
    print("\n" + "-" * 60)
    print(f"SUMMARY: Refresh completed in {duration:.2f} seconds")
    print(f"SUCCESS: {success}")
    print(f"FAILED:  {failed}")
    print(f"TOTAL: {total} employees processed")
    print("-" * 60 + "\n")

def timedelta_to_time(delta):
    """Convert timedelta to time object"""
    if delta is None:
        return None
    fixed_date = datetime(2000, 1, 1)
    result_datetime = fixed_date + delta
    result_time = result_datetime.time()
    return result_time

def get_employee_schedule(cursor, employee_id):
    """Get employee's regular schedule"""
    try:
        cursor.execute("""
            SELECT am_in, am_out, pm_in, pm_out
            FROM employees
            WHERE id = %s
        """, (employee_id,))
        result = cursor.fetchone()
        if result:
            return result
        return None
    except Exception as e:
        print(f"Error getting schedule for employee {employee_id}: {e}")
        return None

def remove_duplicate_imports(cursor, employee_id):
    """Remove duplicate imports for an employee (same employee_id + same minute)"""
    try:
        delete_query = """
            DELETE i1 FROM imports i1
            INNER JOIN imports i2 
            WHERE 
                i1.id < i2.id AND 
                i1.employee_id = i2.employee_id AND 
                i1.employee_id = %s AND
                DATE_FORMAT(i1.created_at, '%Y-%m-%d %H:%i') = DATE_FORMAT(i2.created_at, '%Y-%m-%d %H:%i')
        """
        cursor.execute(delete_query, (employee_id,))
        deleted_count = cursor.rowcount
        if deleted_count > 0:
            print(f"    Removed {deleted_count} duplicate imports")
        return deleted_count
    except Exception as e:
        print(f"    [ERROR] Failed to remove duplicates: {e}")
        return 0

def refresh_employee_dtr(cursor, employee_id):
    """
    Refresh DTR for a single employee with SCHEDULE-DEPENDENT logic
    
    Key Principle: Assignment depends on whether morning work exists
    - Morning work exists → Full day or morning half-day
    - No morning work → Afternoon half-day
    
    Features:
    - Handles all shift types (full day, morning only, afternoon only)
    - Handles early out and late in scenarios
    - Multiple scans (human error)
    - PM_OUT keeps updating to latest scan
    - Dynamic, schedule-sensitive, no hardcoded patterns
    """
    
    # First remove duplicate imports for this employee
    remove_duplicate_imports(cursor, employee_id)
    
    # Get employee schedule
    schedule = get_employee_schedule(cursor, employee_id)
    if not schedule:
        print(f"  [WARN] No schedule found for employee {employee_id}")
        return 0

    regular_am_in, regular_am_out, regular_pm_in, regular_pm_out = schedule
    
    # Get all imports for this employee
    try:
        cursor.execute("""
            SELECT id, employee_id, created_at
            FROM imports
            WHERE employee_id = %s
            ORDER BY created_at
        """, (employee_id,))
        dtrs = cursor.fetchall()
    except Exception as e:
        print(f"  [ERROR] Failed to fetch imports for employee {employee_id}: {e}")
        return 0

    # Group the data by employee_id and date (using defaultdict)
    sorted_data = collections.defaultdict(lambda: collections.defaultdict(set))
    
    for dtr in dtrs:
        id_val, emp_id, dt = dtr
        date_str = dt.date()
        time_str = dt.time()
        sorted_data[emp_id][date_str].add(time_str)

    # Sort the data and format the output
    formatted_data = {}
    for emp_id, date_data in sorted_data.items():
        emp_data = {}
        for date, times in date_data.items():
            emp_data[str(date)] = sorted(times)
        formatted_data[emp_id] = emp_data

    records_processed = 0
    records_skipped_locked = 0

    # Process each date for this employee
    for date_str, times in formatted_data.get(employee_id, {}).items():
        
        sorted_times = sorted(times)
        
        # Convert times to timedelta for easier comparison
        time_deltas = []
        for time in sorted_times:
            td = timedelta(hours=time.hour, minutes=time.minute, seconds=time.second)
            time_deltas.append(td)
        
        # ====== STEP 1: CATEGORIZE SCANS BY TIME PERIOD ======
        lunch_start = regular_am_out  # e.g., 12:00
        lunch_end = regular_pm_in      # e.g., 13:00
        
        morning_scans = []      # Before lunch_start
        lunch_scans = []        # Between lunch_start and lunch_end
        afternoon_scans = []    # After lunch_end
        
        for td in time_deltas:
            if td < lunch_start:
                morning_scans.append(td)
            elif td >= lunch_start and td < lunch_end:
                lunch_scans.append(td)
            else:
                afternoon_scans.append(td)
        
        # ====== STEP 2: DETERMINE SHIFT TYPE ======
        has_morning_work = len(morning_scans) > 0
        has_afternoon_work = len(afternoon_scans) > 0 or len(lunch_scans) > 0
        
        # ====== STEP 3: ASSIGN TIMES BASED ON SHIFT TYPE ======
        am_in = None
        am_out = None
        pm_in = None
        pm_out = None
        
        # ===== MORNING SHIFT LOGIC =====
        if has_morning_work:
            # AM_IN: First morning scan
            am_in = morning_scans[0]
            
            # AM_OUT: Determine when they left
            if lunch_scans:
                # Left for lunch (first lunch scan)
                am_out = lunch_scans[0]
            elif len(morning_scans) > 1:
                # No lunch scans, use last morning scan (must be >1min from AM_IN)
                for scan in reversed(morning_scans):
                    if scan - am_in > timedelta(minutes=1):
                        am_out = scan
                        break
            # If only 1 morning scan and no lunch scans, AM_OUT stays None
        
        # ===== AFTERNOON SHIFT LOGIC =====
        if has_afternoon_work:
            # PM_IN: Determine when they started afternoon
            if has_morning_work:
                # Full day or came back from lunch
                if len(lunch_scans) > 1:
                    # Multiple lunch scans: last lunch = return from lunch
                    pm_in = lunch_scans[-1]
                elif len(afternoon_scans) > 1:
                    # Multiple afternoon scans: first = PM_IN, last = PM_OUT
                    pm_in = afternoon_scans[0]
                elif len(afternoon_scans) == 1:
                    # Single afternoon scan - determine if it's IN or OUT based on schedule
                    single_afternoon = afternoon_scans[0]
                    
                    # Convert schedule times to timedelta for comparison
                    expected_pm_in = regular_pm_in
                    expected_pm_out = regular_pm_out
                    
                    # Calculate distances from expected times
                    distance_to_in = abs((single_afternoon - expected_pm_in).total_seconds())
                    distance_to_out = abs((single_afternoon - expected_pm_out).total_seconds())
                    
                    # Assign based on which expected time it's closer to
                    if distance_to_in < distance_to_out:
                        # Closer to expected return time
                        pm_in = single_afternoon
                    else:
                        # Closer to expected departure time
                        pm_out = single_afternoon
                # else: no afternoon scans and <=1 lunch scan = no proof of return, pm_in stays None
            else:
                # Afternoon-only shift (no morning work)
                if len(lunch_scans) > 1:
                    # Multiple lunch scans
                    am_out = lunch_scans[0]
                    pm_in = lunch_scans[-1]
                elif len(lunch_scans) == 1:
                    # Single lunch scan: treat as PM_IN (arrival)
                    pm_in = lunch_scans[0]
                elif len(afternoon_scans) > 1:
                    # Multiple afternoon scans
                    pm_in = afternoon_scans[0]
                    pm_out = afternoon_scans[-1]
                elif len(afternoon_scans) == 1:
                    # Single afternoon scan - determine if IN or OUT based on schedule
                    single_afternoon = afternoon_scans[0]
                    
                    expected_pm_in = regular_pm_in
                    expected_pm_out = regular_pm_out
                    
                    distance_to_in = abs((single_afternoon - expected_pm_in).total_seconds())
                    distance_to_out = abs((single_afternoon - expected_pm_out).total_seconds())
                    
                    # If scan is VERY far from both expected times (>4 hours from both)
                    # Default to PM_OUT (assume overtime/late departure)
                    max_reasonable_distance = 4 * 3600  # 4 hours in seconds
                    
                    if distance_to_in > max_reasonable_distance and distance_to_out > max_reasonable_distance:
                        # Very late scan - assume departure (overtime)
                        pm_out = single_afternoon
                    elif distance_to_in < distance_to_out:
                        # Closer to expected arrival
                        pm_in = single_afternoon
                    else:
                        # Closer to expected departure
                        pm_out = single_afternoon
                        
            # PM_OUT: Last scan of the day - ONLY if there's a distinct later scan
            if afternoon_scans and pm_in and not pm_out:
                # Look for scans AFTER pm_in
                for scan in afternoon_scans:
                    if scan > pm_in:
                        pm_out = scan
            elif afternoon_scans and not pm_in and len(afternoon_scans) > 1:
                # Multiple afternoon scans, no PM_IN assigned (shouldn't happen but safety)
                pm_out = afternoon_scans[-1]
                    
        # ====== STEP 4: VALIDATION ======
        # Ensure minimum 1-minute gaps
        if am_in and am_out and am_out - am_in <= timedelta(minutes=1):
            am_out = None

        if am_out and pm_in and pm_in - am_out <= timedelta(minutes=1):
            # Very close times might indicate data issue
            pass

        # **NEW: Universal duplicate prevention**
        # If PM_IN and PM_OUT are the same, clear PM_OUT (except single afternoon scan case)
        if pm_in and pm_out and pm_in == pm_out:
            # Only allow duplicate if it's a single scan scenario (afternoon-only, one scan total)
            # Count total scans: if more than 1 scan exists, don't duplicate
            total_scans = len(morning_scans) + len(lunch_scans) + len(afternoon_scans)
            if total_scans > 1:
                # Multiple scans exist - don't duplicate PM_IN to PM_OUT
                pm_out = None
            # else: single scan scenario - keep both (valid)
        
        # Convert timedelta back to time objects
        if am_in:
            am_in = timedelta_to_time(am_in)
        if am_out:
            am_out = timedelta_to_time(am_out)
        if pm_in:
            pm_in = timedelta_to_time(pm_in)
        if pm_out:
            pm_out = timedelta_to_time(pm_out)

        # Check if a DTR with current date exists
        try:
            cursor.execute("""
                SELECT id, locked
                FROM dtrs
                WHERE employee_id = %s AND date = %s
            """, (employee_id, date_str))

            existing = cursor.fetchone()

            if existing:
                dtr_id, locked = existing
                if not locked:
                    # OVERWRITE: Update existing record if not locked
                    cursor.execute("""
                        UPDATE dtrs
                        SET am_in = %s, am_out = %s, pm_in = %s, pm_out = %s, locked = 0
                        WHERE id = %s
                    """, (am_in, am_out, pm_in, pm_out, dtr_id))
                    records_processed += 1
                else:
                    # IMPORT PROTECTION: Skip locked records
                    records_skipped_locked += 1
            else:
                # INSERT: Create new record
                cursor.execute("""
                    INSERT INTO dtrs (employee_id, date, am_in, am_out, pm_in, pm_out, locked)
                    VALUES (%s, %s, %s, %s, %s, %s, 0)
                """, (employee_id, date_str, am_in, am_out, pm_in, pm_out))
                records_processed += 1
                
        except Exception as e:
            print(f"    [ERROR] Failed to update DTR: {e}")
            continue

    if records_skipped_locked > 0:
        print(f"  [INFO] Skipped {records_skipped_locked} locked records for employee {employee_id}")

    return records_processed

def main():
    start_time = time.time()
    employee_id = None
    
    if len(sys.argv) > 1:
        employee_id = sys.argv[1]

    try:
        print_header("DTR Refresh - Schedule-Dependent Logic")
        
        print_status("start", "Connecting to database...")
        db = mysql.connector.connect(**db_config)
        cursor = db.cursor()
        print_status("ok", "Database connection successful")

        if employee_id:
            # Refresh for one employee
            print_header(f"Refreshing DTR for Employee {employee_id}")
            print_status("info", "Processing ALL historical imports for this employee...")
            
            records_processed = refresh_employee_dtr(cursor, employee_id)
            print_status("ok", f"Refreshed employee ID {employee_id} - {records_processed} records processed")
            
            result = {
                'success': True,
                'message': f'DTR refreshed for employee {employee_id}',
                'records_processed': records_processed
            }
        else:
            # Refresh for all employees
            print_header("Refreshing DTR for All Employees")
            print_status("info", "Processing ALL historical imports for all employees...")
            
            cursor.execute("SELECT id FROM employees")
            employees = cursor.fetchall()
            employee_ids = [emp_id for (emp_id,) in employees]
            
            
            success = 0
            failed = 0
            total_records = 0

            for i, emp_id in enumerate(employee_ids, 1):
                try:
                    records_processed = refresh_employee_dtr(cursor, emp_id)
                    
                    success += 1
                    total_records += records_processed
                except Exception as e:
                    
                    failed += 1
                
                # Small delay to not overload the database
                time.sleep(0.01)

            duration = time.time() - start_time
            print_summary(len(employee_ids), success, failed, duration)
            
            result = {
                'success': True,
                'message': 'DTR refreshed for all employees',
                'records_processed': total_records,
                'employees_processed': len(employee_ids),
                'success_count': success,
                'failed_count': failed
            }

        db.commit()
        print_status("ok", "Database changes committed")
        print(json.dumps(result))

    except mysql.connector.Error as err:
        error_msg = f"MySQL Error: {err}"
        print_status("error", error_msg)
        result = {
            'success': False,
            'error': error_msg
        }
        print(json.dumps(result))
        sys.exit(1)
    except Exception as e:
        error_msg = f"Error in main: {str(e)}"
        print_status("error", error_msg)
        result = {
            'success': False,
            'error': error_msg
        }
        print(json.dumps(result))
        sys.exit(1)

    finally:
        if 'db' in locals() and db.is_connected():
            cursor.close()
            db.close()
            print_status("info", "Database connection closed")

if __name__ == '__main__':
    main()