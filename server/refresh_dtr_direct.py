import mysql.connector
import sys
import json
import time
from datetime import datetime, timedelta
from collections import defaultdict

from config import get_db_config

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

def parse_date(value, label):
    if value in (None, ""):
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError as error:
        raise ValueError(f"Invalid {label}. Use YYYY-MM-DD.") from error


def normalize_scope(payload):
    employee_ids = []
    for value in payload.get("employee_ids") or []:
        employee_id = int(value)
        if employee_id > 0 and employee_id not in employee_ids:
            employee_ids.append(employee_id)

    start_date = parse_date(payload.get("start_date"), "start date")
    end_date = parse_date(payload.get("end_date"), "end date")
    all_history = bool(payload.get("all_history"))
    dry_run = bool(payload.get("dry_run"))

    if not all_history:
        if not start_date or not end_date:
            raise ValueError("Start date and end date are required for a bounded refresh.")
        if start_date > end_date:
            raise ValueError("Start date cannot be after end date.")

    return {
        "employee_ids": employee_ids,
        "start_date": start_date,
        "end_date": end_date,
        "all_history": all_history,
        "dry_run": dry_run,
    }


def time_value(value):
    if value is None:
        return None
    if isinstance(value, timedelta):
        return timedelta_to_time(value)
    return value


def time_tuple(values):
    return tuple(time_value(value) for value in values)


def sql_scope(scope, column, params):
    clauses = []
    employee_ids = scope["employee_ids"]
    if employee_ids:
        clauses.append(f"employee_id IN ({','.join(['%s'] * len(employee_ids))})")
        params.extend(employee_ids)
    if not scope["all_history"]:
        clauses.append(f"{column} >= %s")
        clauses.append(f"{column} < DATE_ADD(%s, INTERVAL 1 DAY)")
        params.extend([scope["start_date"], scope["end_date"]])
    return clauses


def refresh_dtr_range(connection, scope):
    started = time.perf_counter()
    cursor = connection.cursor()

    import_params = []
    import_where = sql_scope(scope, "created_at", import_params)
    import_sql = "SELECT employee_id, created_at FROM imports"
    if import_where:
        import_sql += " WHERE " + " AND ".join(import_where)
    import_sql += " ORDER BY employee_id, created_at"
    cursor.execute(import_sql, import_params)
    import_rows = cursor.fetchall()

    punches = defaultdict(lambda: defaultdict(set))
    for employee_id, created_at in import_rows:
        punches[int(employee_id)][created_at.date()].add(created_at.time())

    employee_ids = sorted(punches)
    if not employee_ids:
        cursor.close()
        return {
            "success": True,
            "records_processed": 0,
            "records_inserted": 0,
            "records_updated": 0,
            "records_unchanged": 0,
            "locked_skipped": 0,
            "employees_processed": 0,
            "punches_processed": len(import_rows),
            "duration_ms": round((time.perf_counter() - started) * 1000),
        }

    placeholders = ",".join(["%s"] * len(employee_ids))
    cursor.execute(
        f"SELECT id, am_in, am_out, pm_in, pm_out FROM employees WHERE id IN ({placeholders})",
        employee_ids,
    )
    schedules = {
        int(row[0]): (row[1], row[2], row[3], row[4])
        for row in cursor.fetchall()
    }

    override_params = list(employee_ids)
    override_where = [f"employee_id IN ({placeholders})"]
    if not scope["all_history"]:
        override_where.extend(["date >= %s", "date <= %s"])
        override_params.extend([scope["start_date"], scope["end_date"]])
    cursor.execute(
        "SELECT employee_id, date, am_in, am_out, pm_in, pm_out "
        "FROM employee_schedules WHERE " + " AND ".join(override_where),
        override_params,
    )
    overrides = {
        (int(row[0]), row[1]): (row[2], row[3], row[4], row[5])
        for row in cursor.fetchall()
    }

    dtr_params = list(employee_ids)
    dtr_where = [f"employee_id IN ({placeholders})"]
    if not scope["all_history"]:
        dtr_where.extend(["date >= %s", "date <= %s"])
        dtr_params.extend([scope["start_date"], scope["end_date"]])
    cursor.execute(
        "SELECT employee_id, date, am_in, am_out, pm_in, pm_out, COALESCE(locked, 0) "
        "FROM dtrs WHERE " + " AND ".join(dtr_where),
        dtr_params,
    )
    existing_rows = {
        (int(row[0]), row[1]): {
            "times": time_tuple(row[2:6]),
            "locked": bool(row[6]),
        }
        for row in cursor.fetchall()
    }

    changes = []
    inserted = 0
    updated = 0
    unchanged = 0
    locked_skipped = 0

    for employee_id, date_punches in punches.items():
        default_schedule = schedules.get(employee_id)
        if not default_schedule:
            continue
        for work_date, raw_times in date_punches.items():
            effective_schedule = overrides.get((employee_id, work_date), default_schedule)
            time_deltas = [
                timedelta(hours=value.hour, minutes=value.minute, seconds=value.second)
                for value in sorted(raw_times)
            ]
            classified = classify_daily_scans(time_deltas, effective_schedule)
            classified_times = time_tuple(classified)
            key = (employee_id, work_date)
            existing = existing_rows.get(key)

            if existing and existing["locked"]:
                locked_skipped += 1
                continue
            if existing and existing["times"] == classified_times:
                unchanged += 1
                continue

            changes.append((employee_id, work_date, *classified_times))
            if existing:
                updated += 1
            else:
                inserted += 1

    if changes and not scope["dry_run"]:
        cursor.executemany(
            """
            INSERT INTO dtrs (employee_id, date, am_in, am_out, pm_in, pm_out, locked)
            VALUES (%s, %s, %s, %s, %s, %s, 0) AS incoming
            ON DUPLICATE KEY UPDATE
                am_in = IF(COALESCE(dtrs.locked, 0) = 1, dtrs.am_in, incoming.am_in),
                am_out = IF(COALESCE(dtrs.locked, 0) = 1, dtrs.am_out, incoming.am_out),
                pm_in = IF(COALESCE(dtrs.locked, 0) = 1, dtrs.pm_in, incoming.pm_in),
                pm_out = IF(COALESCE(dtrs.locked, 0) = 1, dtrs.pm_out, incoming.pm_out)
            """,
            changes,
        )

    cursor.close()
    return {
        "success": True,
        "records_processed": inserted + updated,
        "records_inserted": inserted,
        "records_updated": updated,
        "records_unchanged": unchanged,
        "locked_skipped": locked_skipped,
        "employees_processed": len(employee_ids),
        "punches_processed": len(import_rows),
        "duration_ms": round((time.perf_counter() - started) * 1000),
        "dry_run": scope["dry_run"],
    }


def read_scope_from_cli():
    if len(sys.argv) > 1 and sys.argv[1] == "--json-input":
        payload = json.loads(sys.stdin.read() or "{}")
        return normalize_scope(payload)
    if len(sys.argv) > 1:
        return normalize_scope({"employee_ids": [int(sys.argv[1])], "all_history": True})
    return normalize_scope({"all_history": True})


def main():
    connection = None
    lock_acquired = False
    try:
        scope = read_scope_from_cli()
        connection = mysql.connector.connect(
            host=db_config.get("host"),
            user=db_config.get("user"),
            password=db_config.get("password"),
            database=db_config.get("database"),
            port=db_config.get("port", 3306),
            autocommit=False,
            connection_timeout=10,
        )
        lock_cursor = connection.cursor()
        lock_cursor.execute("SELECT GET_LOCK('muniweb_dtr_refresh', 0)")
        lock_acquired = lock_cursor.fetchone()[0] == 1
        lock_cursor.close()
        if not lock_acquired:
            print(json.dumps({"success": False, "busy": True, "error": "Another DTR refresh is already running."}))
            return 2

        result = refresh_dtr_range(connection, scope)
        if scope["dry_run"]:
            connection.rollback()
        else:
            connection.commit()
        result.update({
            "message": "DTR refresh completed",
            "scope": {
                "employee_ids": scope["employee_ids"],
                "start_date": str(scope["start_date"]) if scope["start_date"] else None,
                "end_date": str(scope["end_date"]) if scope["end_date"] else None,
                "all_history": scope["all_history"],
                "dry_run": scope["dry_run"],
            },
        })
        print(json.dumps(result))
        return 0
    except Exception as error:
        if connection:
            connection.rollback()
        print(json.dumps({"success": False, "error": str(error)}))
        return 1
    finally:
        if connection:
            if lock_acquired:
                try:
                    cursor = connection.cursor()
                    cursor.execute("SELECT RELEASE_LOCK('muniweb_dtr_refresh')")
                    cursor.close()
                except Exception:
                    pass
            connection.close()


if __name__ == "__main__":
    sys.exit(main())
