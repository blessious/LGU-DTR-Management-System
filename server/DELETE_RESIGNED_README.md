# Delete Resigned Employees - Simple Guide

## Setup (1 minute)

Edit `delete_resigned_employees.py` at the top:

```python
DB_CONFIG = {
    'host': '192.168.1.52',           # Your MySQL host
    'user': 'root',                   # Your MySQL user
    'password': 'your_password',      # ⚠️ CHANGE THIS!
    'database': 'bless_dtr_test'
}

INACTIVITY_MONTHS = 6  # Change if needed (default: 6 months)
```

## Run

```bash
python delete_resigned_employees.py
```

## What It Does

1. **Finds** employees with NO DTR records for 6+ months
2. **Shows** them in a table
3. **Asks confirmation** before deletion
4. **Deletes** individually - you choose each one
5. **Logs everything** to JSON report

## Confirmation Options

```
[Y] Delete this employee
[N] Skip this employee
[A] Delete all remaining
[Q] Quit without deleting
```

## Output Files

- **Log**: `server/logs/resigned_deletion_*.log`
- **Report**: `server/logs/deletion_report_*.json` (all deleted employees)

## Quick Start

```bash
# 1. Edit DB_CONFIG (change password!)
# 2. Run script
python delete_resigned_employees.py

# 3. Review employees found
# 4. Type 'yes' when ready
# 5. Confirm each employee individually
# 6. Check report: cat server/logs/deletion_report_*.json
```

## Recovery

All deleted employees are saved in the JSON report:
```bash
cat server/logs/deletion_report_*.json
```

Use this to restore if needed.
