#!/usr/bin/env python3
import sys
import os
from PyPDF2 import PdfWriter, PdfReader
import datetime
import calendar

# Import shared configuration and database manager
from config import get_db_config, get_export_path, ensure_export_directories
from database import Database

def get_employees_by_office(db, office, employee_type):
    """Get employees based on office and employee type"""
    query = "SELECT id, name, position, office FROM employees WHERE office = %s AND registered = 1"
    params = [office]
    
    if employee_type == 'regular':
        query += " AND regular = 1"
    elif employee_type == 'jobOrder':
        query += " AND regular = 0"
    
    query += " ORDER BY name"
    
    db.execute(query, params)
    employees = []
    for row in db.fetchall():
        # Convert to dictionary format for compatibility
        employees.append({
            'id': row[0],
            'name': row[1],
            'position': row[2],
            'office': row[3]
        })
    
    return employees

def create_mass_pdf(office, employee_type, noter_signatory, noter_position, 
                   first_month, first_year, first_cut, second_month, second_year, second_cut, output_filename):
    """
    Create a PDF containing DTRs for all employees in the specified office
    """
    
    # Initialize database connection with automatic reconnection support
    db_config = get_db_config()
    db = Database(
        host=db_config.get('host', 'localhost'),
        database=db_config.get('database', 'bless_dtr_test'),
        user=db_config.get('user', 'root'),
        password=db_config.get('password', ''),
        port=db_config.get('port', 3306)
    )
    
    # Get employees
    employees = get_employees_by_office(db, office, employee_type)
    if not employees:
        raise Exception(f"No employees found for office: {office}, type: {employee_type}")
    
    db.close()
    
    print(f"Processing {len(employees)} employees for mass PDF generation")
    
    # Import the existing export_dtr functions
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(script_dir)
    
    # Import the functions from export_dtr
    from export_dtr import export_dtr, detect_shift_type
    
    # Get export path from config
    export_folder = get_export_path()
    
    # Ensure export directories exist
    ensure_export_directories()
    
    # Create output directory
    output_dir = os.path.join(export_folder, 'previews')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)
    
    # Create a PDF merger
    pdf_merger = PdfWriter()
    
    # Alternative approach: Call export_dtr.py for each employee
    for i, employee in enumerate(employees):
        try:
            print(f"Generating PDF for employee {i+1}/{len(employees)}: {employee['name']}")
            
            # Build command to call export_dtr.py
            cmd = [
                'python', 'export_dtr.py',
                str(employee['id']),
                f'{noter_signatory}',
                f'{noter_position}',
                str(first_month),
                str(first_year),
                first_cut,
                str(second_month),
                str(second_year),
                second_cut,
                'pdf',
                'true',  # preview mode
                'false', # don't print
                '""'     # no printer
            ]
            
            # Generate individual PDF
            import subprocess
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=script_dir)
            
            if result.returncode == 0:
                # Extract the generated file path from output
                output_lines = result.stdout.strip().split('\n')
                for line in output_lines:
                    if line.startswith('exports/previews/') and line.endswith('.pdf'):
                        individual_pdf_path = line
                        break
                else:
                    # If we can't extract the path, construct it
                    individual_pdf_path = f"{export_folder}/previews/{employee['id']}.pdf"
                
                full_individual_path = os.path.join(script_dir, individual_pdf_path)
                
                if os.path.exists(full_individual_path):
                    # Add to merged PDF
                    individual_pdf = PdfReader(full_individual_path)
                    pdf_merger.append(individual_pdf)
                    
                    # Clean up individual file
                    os.remove(full_individual_path)
                    print(f"Added {employee['name']} to mass PDF")
                else:
                    print(f"Generated PDF not found for {employee['name']}")
            else:
                print(f"Failed to generate PDF for {employee['name']}: {result.stderr}")
                
        except Exception as e:
            print(f"✗ Error processing {employee['name']}: {str(e)}")
            continue
    
    # Save the merged PDF
    if len(pdf_merger.pages) > 0:
        with open(output_path, 'wb') as output_file:
            pdf_merger.write(output_file)
        
        print(f"SUCCESS: Mass PDF created with {len(pdf_merger.pages)} employees at {output_path}")
        return output_path
    else:
        raise Exception("No PDFs were successfully generated for any employees")

def main():
    if len(sys.argv) < 12:
        print("Usage: python mass_export_dtr.py <office> <employee_type> <noter_signatory> <noter_position> <first_month> <first_year> <first_cut> <second_month> <second_year> <second_cut> <output_filename>")
        print("Example: python mass_export_dtr.py \"Mayor's Office\" \"all\" \"John Doe\" \"Manager\" 10 2025 full 0 0 full mass_output.pdf")
        sys.exit(1)
    
    try:
        office = sys.argv[1]
        employee_type = sys.argv[2]
        noter_signatory = sys.argv[3]
        noter_position = sys.argv[4]
        first_month = int(sys.argv[5])
        first_year = int(sys.argv[6])
        first_cut = sys.argv[7]
        second_month = int(sys.argv[8])
        second_year = int(sys.argv[9])
        second_cut = sys.argv[10]
        output_filename = sys.argv[11]
        
        result_path = create_mass_pdf(
            office=office,
            employee_type=employee_type,
            noter_signatory=noter_signatory,
            noter_position=noter_position,
            first_month=first_month,
            first_year=first_year,
            first_cut=first_cut,
            second_month=second_month,
            second_year=second_year,
            second_cut=second_cut,
            output_filename=output_filename
        )
        
        print(f"FINAL_OUTPUT: {result_path}")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()