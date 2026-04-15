#!/usr/bin/env python3
"""
Wrapper to call the refresh_dtr function from Node.js
"""

import sys
import os
import json

# Add the current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Import from your DTR file
try:
    from dtr import DTR
except ImportError as e:
    print(f"Import error: {e}", file=sys.stderr)
    print("Python path:", sys.path, file=sys.stderr)
    sys.exit(1)

def refresh_dtr_wrapper(employee_id=0):
    """Wrapper function that Node.js can call"""
    try:
        # Initialize your DTR class
        print("Initializing DTR class...", file=sys.stderr)
        dtr_app = DTR()
        
        print(f"Calling refresh_dtr for employee {employee_id}...", file=sys.stderr)
        # Call the refresh function
        dtr_app.refresh_dtr(employee_id)
        
        return {
            "success": True,
            "message": f"DTR refresh completed for employee {employee_id if employee_id else 'all'}"
        }
        
    except Exception as e:
        print(f"Error in refresh_dtr_wrapper: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == '__main__':
    # Get employee_id from command line arguments (0 for all employees)
    employee_id = 0
    if len(sys.argv) > 1:
        try:
            employee_id = int(sys.argv[1])
        except ValueError:
            print(json.dumps({
                "success": False,
                "error": "Employee ID must be a number"
            }))
            sys.exit(1)
    
    print(f"Starting DTR refresh wrapper for employee {employee_id}...", file=sys.stderr)
    
    # Call the refresh function
    result = refresh_dtr_wrapper(employee_id)
    
    # Output result as JSON
    print(json.dumps(result))