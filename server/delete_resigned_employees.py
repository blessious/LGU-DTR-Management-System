"""
Resigned Employee Deletion System
Finds inactive employees (no DTR records for X months) and deletes with confirmation
"""

import sys
import mysql.connector
from mysql.connector import Error
from datetime import datetime, timedelta
from pathlib import Path
import logging
import json

# Fix Windows console encoding for UTF-8
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
DB_CONFIG = {
    'host': '192.168.1.52',      # Change if needed
    'user': 'adtr',               # Change if needed
    'password': 'adtr',  # CHANGE THIS
    'database': 'new_dtr'
}

# Inactivity threshold (months)
INACTIVITY_MONTHS = 6

# ============================================================================
# SETUP LOGGING
# ============================================================================
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"resigned_deletion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class ResignedEmployeeDeleter:
    def __init__(self):
        self.connection = None
        self.cursor = None
        self.deleted = []
        self.skipped = []

    def connect(self):
        """Connect to database"""
        try:
            self.connection = mysql.connector.connect(**DB_CONFIG)
            self.cursor = self.connection.cursor(dictionary=True)
            logger.info("[OK] Connected to database")
            return True
        except Error as e:
            logger.error(f"[ERROR] Connection failed: {e}")
            print(f"\n[ERROR] Database connection failed!")
            print(f"   Error: {e}")
            print(f"\n   Check DB_CONFIG at top of script:")
            print(f"   - host: {DB_CONFIG['host']}")
            print(f"   - user: {DB_CONFIG['user']}")
            print(f"   - database: {DB_CONFIG['database']}")
            return False

    def disconnect(self):
        """Close connection"""
        if self.connection and self.connection.is_connected():
            self.cursor.close()
            self.connection.close()
            logger.info("Database disconnected")

    def get_inactive_employees(self, months=INACTIVITY_MONTHS):
        """Find employees with no DTR for X months"""
        cutoff_date = datetime.now() - timedelta(days=months*30)
        
        query = """
            SELECT 
                e.id,
                e.name,
                e.position,
                e.office,
                e.regular,
                MAX(d.date) as last_dtr_date,
                COUNT(d.id) as total_dtrs
            FROM employees e
            LEFT JOIN dtrs d ON e.id = d.employee_id
            WHERE e.regular = 0
            GROUP BY e.id
            HAVING MAX(d.date) < %s OR MAX(d.date) IS NULL
            ORDER BY COALESCE(MAX(d.date), '1970-01-01') ASC
        """
        
        try:
            self.cursor.execute(query, (cutoff_date,))
            employees = self.cursor.fetchall()
            logger.info(f"Found {len(employees)} employees with no DTR for {months}+ months")
            return employees
        except Error as e:
            logger.error(f"Error fetching employees: {e}")
            return []

    def print_header(self):
        """Print ASCII header"""
        print("\n" + "=" * 100)
        print("RESIGNED EMPLOYEE DELETION SYSTEM".center(100))
        print("=" * 100)
        print(f"\nFinding JO/COS employees with NO DTR records for {INACTIVITY_MONTHS}+ months...\n")

    def print_employees_table(self, employees):
        """Print formatted table of employees"""
        if not employees:
            print("[OK] No inactive employees found!\n")
            return False

        print(f"\n{'#':<4} {'ID':<7} {'Name':<35} {'Last DTR':<15} {'Position':<30} {'Office':<25}")
        print("-" * 116)
        
        for idx, emp in enumerate(employees, 1):
            last_dtr = emp['last_dtr_date'].strftime('%Y-%m-%d') if emp['last_dtr_date'] else 'NEVER'
            emp_type = '(JO/COS)' if emp['regular'] == 0 else '(Regular)'
            name = f"{emp['name'][:31]} {emp_type}"
            print(f"{idx:<4} {emp['id']:<7} {name:<35} {last_dtr:<15} {emp['position'][:28]:<30} {emp['office'][:23]:<25}")
        
        print("-" * 116)
        print(f"\nTotal: {len(employees)} inactive employees")
        return True

    def get_employee_data(self, emp_id):
        """Get full employee data"""
        try:
            query = "SELECT * FROM employees WHERE id = %s"
            self.cursor.execute(query, (emp_id,))
            return self.cursor.fetchone()
        except Error as e:
            logger.error(f"Error fetching employee {emp_id}: {e}")
            return None

    def delete_employee(self, emp_id, emp_name):
        """Delete employee"""
        try:
            emp_data = self.get_employee_data(emp_id)
            if not emp_data:
                logger.warning(f"Employee {emp_id} not found")
                return False

            query = "DELETE FROM employees WHERE id = %s"
            self.cursor.execute(query, (emp_id,))
            self.connection.commit()

            self.deleted.append({
                "id": emp_id,
                "name": emp_name,
                "timestamp": datetime.now().isoformat(),
                "data": emp_data
            })
            
            logger.info(f"[DELETED] {emp_name} (ID: {emp_id})")
            return True
        except Error as e:
            logger.error(f"Error deleting {emp_id}: {e}")
            self.connection.rollback()
            return False

    def confirm_deletion(self, employees):
        """Interactive confirmation"""
        print("\n" + "=" * 100)
        print("DELETION CONFIRMATION".center(100))
        print("=" * 100)
        print("\n[MENU] For each employee, enter:")
        print("   [Y] Delete")
        print("   [N] Skip")
        print("   [A] Delete all remaining")
        print("   [Q] Quit\n")
        
        deleted_count = 0
        
        for idx, emp in enumerate(employees, 1):
            print(f"\n[{idx}/{len(employees)}] {emp['name']}")
            print(f"    Position: {emp['position']}")
            print(f"    Office: {emp['office']}")
            print(f"    Last DTR: {emp['last_dtr_date'].strftime('%Y-%m-%d') if emp['last_dtr_date'] else 'NEVER'}")
            
            while True:
                choice = input("    [Y]es / [N]o / [A]ll / [Q]uit: ").strip().upper()
                
                if choice == 'Y':
                    if self.delete_employee(emp['id'], emp['name']):
                        print("    [OK] Deleted")
                        deleted_count += 1
                    break
                elif choice == 'N':
                    self.skipped.append({"id": emp['id'], "name": emp['name']})
                    print("    [SKIP] Skipped")
                    break
                elif choice == 'A':
                    print("\n    Deleting all remaining...\n")
                    for remaining in employees[idx-1:]:
                        if self.delete_employee(remaining['id'], remaining['name']):
                            deleted_count += 1
                            print(f"    [OK] {remaining['name']}")
                    return deleted_count
                elif choice == 'Q':
                    print("\n    [CANCEL] Cancelled by user")
                    return deleted_count
                else:
                    print("    [ERROR] Invalid choice. Try again.")
        
        return deleted_count

    def print_summary(self):
        """Print summary report"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_deleted": len(self.deleted),
            "total_skipped": len(self.skipped),
            "deleted_employees": self.deleted,
            "skipped_employees": self.skipped
        }
        
        # Save report
        report_file = log_dir / f"deletion_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        # Print summary
        print("\n" + "=" * 100)
        print("SUMMARY".center(100))
        print("=" * 100)
        print(f"\n[OK] Deleted: {len(self.deleted)}")
        print(f"[SKIP] Skipped: {len(self.skipped)}")
        print(f"\nLog file: {log_file}")
        print(f"Report file: {report_file}")
        print("\n" + "=" * 100 + "\n")

    def run(self):
        """Main execution"""
        self.print_header()
        
        # Connect
        if not self.connect():
            return
        
        try:
            # Fetch inactive employees
            employees = self.get_inactive_employees(INACTIVITY_MONTHS)
            
            # Display
            if not self.print_employees_table(employees):
                return
            
            # Confirm
            proceed = input("\n[WARN] Proceed with deletion? (yes/no): ").strip().lower()
            if proceed != 'yes':
                print("[CANCEL] Operation cancelled.")
                return
            
            # Delete
            self.confirm_deletion(employees)
            
            # Summary
            self.print_summary()
            
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            print(f"\n[ERROR] Error: {e}")
        finally:
            self.disconnect()


def main():
    """Entry point"""
    deleter = ResignedEmployeeDeleter()
    deleter.run()


if __name__ == "__main__":
    main()
