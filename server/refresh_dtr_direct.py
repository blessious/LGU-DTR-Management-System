import mysql.connector
import sys
import json
import os
import time
import collections
from datetime import datetime, timedelta
from collections import defaultdict

# Import shared configuration and database manager
from config import get_db_config
from database import Database

# Database configuration - USE DYNAMIC SETTINGS FROM config.json (kept for reference)
db_config_dict = get_db_config()
db_config = {
    'host': db_config_dict.get('host', '192.168.1.52'),
    'user': db_config_dict.get('user', 'adtr'),
    'password': db_config_dict.get('password', 'adtr'),
    'database': db_config_dict.get('database', 'new_dtr'),
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


def classify_daily_scans(time_deltas, effective_schedule):
    """Classify one day's ordered punches without reading or writing the database."""
    regular_am_in, regular_am_out, regular_pm_in, regular_pm_out = effective_schedule

    lunch_start = regular_am_out
    lunch_end = regular_pm_in

    morning_scans = []
    lunch_scans = []
    afternoon_scans = []

    for scan in sorted(time_deltas):
        if scan < lunch_start:
            morning_scans.append(scan)
        elif scan < lunch_end:
            lunch_scans.append(scan)
        else:
            afternoon_scans.append(scan)

    has_morning_work = bool(morning_scans)
    has_afternoon_work = bool(lunch_scans or afternoon_scans)

    am_in = None
    am_out = None
    pm_in = None
    pm_out = None

    if has_morning_work:
        am_in = morning_scans[0]

        if lunch_scans:
            am_out = lunch_scans[0]
        elif len(morning_scans) > 1:
            for scan in reversed(morning_scans):
                if scan - am_in > timedelta(minutes=1):
                    am_out = scan
                    break

    if has_afternoon_work:
        if has_morning_work:
            if len(lunch_scans) > 1:
                pm_in = lunch_scans[-1]
            elif len(afternoon_scans) > 1:
                pm_in = afternoon_scans[0]
            elif len(afternoon_scans) == 1:
                single_afternoon = afternoon_scans[0]
                distance_to_in = abs((single_afternoon - regular_pm_in).total_seconds())
                distance_to_out = abs((single_afternoon - regular_pm_out).total_seconds())

                if distance_to_in < distance_to_out:
                    pm_in = single_afternoon
                else:
                    pm_out = single_afternoon
        else:
            # A lunch-window punch followed by distinct PM in/out punches is
            # clear evidence of a missing AM in, not an afternoon-only arrival.
            if len(lunch_scans) == 1 and len(afternoon_scans) >= 2:
                am_out = lunch_scans[0]
                pm_in = afternoon_scans[0]
                pm_out = afternoon_scans[-1]
            elif len(lunch_scans) > 1:
                am_out = lunch_scans[0]
                pm_in = lunch_scans[-1]
            elif len(lunch_scans) == 1:
                pm_in = lunch_scans[0]
            elif len(afternoon_scans) > 1:
                pm_in = afternoon_scans[0]
                pm_out = afternoon_scans[-1]
            elif len(afternoon_scans) == 1:
                single_afternoon = afternoon_scans[0]
                distance_to_in = abs((single_afternoon - regular_pm_in).total_seconds())
                distance_to_out = abs((single_afternoon - regular_pm_out).total_seconds())
                max_reasonable_distance = 4 * 3600

                if distance_to_in > max_reasonable_distance and distance_to_out > max_reasonable_distance:
                    pm_out = single_afternoon
                elif distance_to_in < distance_to_out:
                    pm_in = single_afternoon
                else:
                    pm_out = single_afternoon

        if afternoon_scans and pm_in and not pm_out:
            for scan in afternoon_scans:
                if scan > pm_in:
                    pm_out = scan
        elif afternoon_scans and not pm_in and len(afternoon_scans) > 1:
            pm_out = afternoon_scans[-1]

    if am_in and am_out and am_out - am_in <= timedelta(minutes=1):
        am_out = None

    if pm_in and pm_out and pm_in == pm_out:
        total_scans = len(morning_scans) + len(lunch_scans) + len(afternoon_scans)
        if total_scans > 1:
            pm_out = None

    return am_in, am_out, pm_in, pm_out

def get_employee_schedule(db, employee_id):
    """Get employee's regular schedule"""
    try:
        db.execute("""
            SELECT am_in, am_out, pm_in, pm_out
            FROM employees
            WHERE id = %s
        """, (employee_id,))
        result = db.fetchone()
        if result:
            return result
        return None
    except Exception as e:
        print(f"Error getting schedule for employee {employee_id}: {e}")
        return None

def get_employee_overrides(db, employee_id):
    """Get all schedule overrides for an employee as a dictionary keyed by date string"""
    try:
        db.execute("""
            SELECT date, am_in, am_out, pm_in, pm_out
            FROM employee_schedules
            WHERE employee_id = %s
        """, (employee_id,))
        results = db.fetchall()
        overrides = {}
        for r in results:
            # r[0] is datetime.date, convert to string YYYY-MM-DD
            date_str = str(r[0])
            overrides[date_str] = (r[1], r[2], r[3], r[4])
        return overrides
    except Exception as e:
        print(f"Error getting overrides for employee {employee_id}: {e}")
        return {}

def remove_duplicate_imports(db, employee_id):
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
        db.execute(delete_query, (employee_id,))
        # For rowcount, we need to check if the database object supports it
        # If not, we just print that we attempted the deletion
        deleted_count = getattr(db.cursor, 'rowcount', 0)
        if deleted_count > 0:
            print(f"    Removed {deleted_count} duplicate imports")
        return deleted_count
    except Exception as e:
        print(f"    [ERROR] Failed to remove duplicates: {e}")
        return 0

def refresh_employee_dtr(db, employee_id):
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
    remove_duplicate_imports(db, employee_id)
    
    # Get employee default schedule
    default_schedule = get_employee_schedule(db, employee_id)
    if not default_schedule:
        print(f"  [WARN] No schedule found for employee {employee_id}")
        return 0

    # Get all schedule overrides for this employee
    overrides = get_employee_overrides(db, employee_id)
    
    # Get all imports for this employee
    try:
        db.execute("""
            SELECT id, employee_id, created_at
            FROM imports
            WHERE employee_id = %s
            ORDER BY created_at
        """, (employee_id,))
        dtrs = db.fetchall()
        
        if not dtrs:
            print(f"  [INFO] No imports found for employee {employee_id}")
            return 0
            
    except Exception as e:
        print(f"  [ERROR] Failed to fetch imports for employee {employee_id}: {e}", file=sys.stderr)
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
        
        # Determine the effective schedule for this specific date
        if str(date_str) in overrides:
            effective_schedule = overrides[str(date_str)]
        else:
            effective_schedule = default_schedule

        am_in, am_out, pm_in, pm_out = classify_daily_scans(time_deltas, effective_schedule)
        
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
            db.execute("""
                SELECT id, locked
                FROM dtrs
                WHERE employee_id = %s AND date = %s
            """, (employee_id, date_str))

            existing = db.fetchone()

            if existing:
                dtr_id, locked = existing
                if not locked:
                    # OVERWRITE: Update existing record if not locked
                    db.execute("""
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
                db.execute("""
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
        try:
            # Normalize CLI arg to int so it matches DB integer ids and dict keys.
            employee_id = int(sys.argv[1])
        except ValueError:
            print_status("error", f"Invalid employee id: {sys.argv[1]}")
            print(json.dumps({
                'success': False,
                'error': f'Invalid employee id: {sys.argv[1]}'
            }))
            sys.exit(1)

    try:
        print_header("DTR Refresh - Schedule-Dependent Logic")
        
        print_status("start", "Connecting to database...")
        # Use the new Database class with automatic reconnection support
        db = Database(
            host=db_config.get('host', '192.168.1.52'),
            user=db_config.get('user', 'adtr'),
            password=db_config.get('password', 'adtr'),
            database=db_config.get('database', 'new_dtr'),
            port=db_config.get('port', 3306)
        )
        print_status("ok", "Database connection successful")

        if employee_id:
            # Refresh for one employee
            print_header(f"Refreshing DTR for Employee {employee_id}")
            print_status("info", "Processing ALL historical imports for this employee...")
            
            records_processed = refresh_employee_dtr(db, employee_id)
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
            
            db.execute("SELECT id FROM employees")
            employees = db.fetchall()
            employee_ids = [emp_id for (emp_id,) in employees]
            
            
            success = 0
            failed = 0
            total_records = 0

            for i, emp_id in enumerate(employee_ids, 1):
                try:
                    records_processed = refresh_employee_dtr(db, emp_id)
                    
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

    except Exception as err:
        error_msg = f"Error: {str(err)}"
        print_status("error", error_msg)
        result = {
            'success': False,
            'error': error_msg
        }
        print(json.dumps(result))
        sys.exit(1)

    finally:
        if 'db' in locals():
            try:
                db.close()
                print_status("info", "Database connection closed")
            except:
                pass

if __name__ == '__main__':
    main()
