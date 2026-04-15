#!/usr/bin/env python3
import sys
import os
import yaml
import openpyxl
import datetime
import calendar
import io
import win32print
import win32api
from PyPDF2 import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import mysql.connector
from cryptography.fernet import Fernet

# Import shared configuration and database manager
from config import get_db_config, get_export_path, ensure_export_directories
from database import Database

def detect_shift_type(am_in, pm_out):
    """
    Detect shift type based on schedule times
    Returns: 'morning', 'mid', or 'night'
    """
    if am_in is None or pm_out is None:
        return 'morning'
    
    # Convert to datetime.time if they are timedelta
    if isinstance(am_in, datetime.timedelta):
        am_in_hour = am_in.seconds // 3600
    else:
        am_in_hour = am_in.hour if hasattr(am_in, 'hour') else 0
    
    if isinstance(pm_out, datetime.timedelta):
        pm_out_hour = pm_out.seconds // 3600
    else:
        pm_out_hour = pm_out.hour if hasattr(pm_out, 'hour') else 0
    
    # NIGHT SHIFT: IN around 10PM, OUT around 6AM
    if (am_in_hour >= 20 or am_in_hour <= 2) and (4 <= pm_out_hour <= 8):
        return 'night'
    
    # MID SHIFT: IN around 6AM, OUT around 2PM
    elif (5 <= am_in_hour <= 8) and (13 <= pm_out_hour <= 15):
        return 'mid'
    
    # Default to MORNING SHIFT
    else:
        return 'morning'

def print_file(file_path, printer_name=None):
    """Print file using Windows print API"""
    try:
        if printer_name:
            # Set specific printer
            win32print.SetDefaultPrinter(printer_name)
        
        # Print the file
        win32api.ShellExecute(0, "print", file_path, None, ".", 0)
        return True
    except Exception as e:
        print(f"Print error: {str(e)}")
        return False

def export_dtr(employee_id, noter_signatory, noter_position, first_month, first_year, 
               first_cut='full', second_month=0, second_year=0, second_cut='full', 
               export_to='excel', preview=False, print_file_after_export=False, printer_name=None):
    
    # Get database configuration from config.json
    db_config = get_db_config()
    
    # Ensure export directories exist
    ensure_export_directories()
    
    # Initialize database connection
    db = Database(
        host=db_config.get('host', 'localhost'),
        database=db_config.get('database', 'bless_dtr_test'),
        user=db_config.get('user', 'root'),
        password=db_config.get('password', ''),
        port=db_config.get('port', 3306)
    )
    
    # Get export folder from config
    export_folder = get_export_path()
    
    months = ['January', 'February', 'March', 'April', 'May', 'June', 
              'July', 'August', 'September', 'October', 'November', 'December']
    
    # Get employee data
    employee = db.get_employee(employee_id)
    if not employee:
        raise Exception(f"Employee with ID {employee_id} not found")
    
    employee_name = employee[1]
    employee_signatory = employee[10]
    employee_position = employee[2]
    employee_office = employee[3]
    employee_am_in = employee[5]  # AM in time
    employee_pm_out = employee[8]  # PM out time

    # Detect shift type
    shift_type = detect_shift_type(employee_am_in, employee_pm_out)
    print(f"Detected shift type: {shift_type}")

    # Calculate date range strings
    if first_cut.lower() == 'full':
        first_date_range_string = f'1 - {calendar.monthrange(first_year, first_month)[1]}'
    elif first_cut.lower() == 'first':
        first_date_range_string = '1 - 15'
    elif first_cut.lower() == 'last':
        first_date_range_string = f'16 - {calendar.monthrange(first_year, first_month)[1]}'

    if second_month != 0 and second_year != 0:
        if second_cut.lower() == 'full':
            second_date_range_string = f'1 - {calendar.monthrange(second_year, second_month)[1]}'
        elif second_cut.lower() == 'first':
            second_date_range_string = '1 - 15'
        elif second_cut.lower() == 'last':
            second_date_range_string = f'16 - {calendar.monthrange(second_year, second_month)[1]}'

    # Format regular time - FIXED for timedelta objects
    def format_time(time_obj):
        if not time_obj:
            return "00:00AM"
        
        if isinstance(time_obj, datetime.timedelta):
            # Convert timedelta to hours and minutes
            total_seconds = time_obj.total_seconds()
            hours = int(total_seconds // 3600)
            minutes = int((total_seconds % 3600) // 60)
        elif isinstance(time_obj, str):
            # Parse string time
            hours, minutes = map(int, time_obj.split(':'))
        else:
            # Assume it's a time object
            hours = time_obj.hour
            minutes = time_obj.minute
        
        meridian = 'AM' if hours < 12 else 'PM'
        formatted_hour = hours % 12
        if formatted_hour == 0:
            formatted_hour = 12
        return f"{formatted_hour:02d}:{int(minutes):02d}{meridian}"

    def format_dtr_time(time_obj):
        if not time_obj:
            return ""
        
        if isinstance(time_obj, datetime.timedelta):
            # Convert timedelta to hours and minutes
            total_seconds = time_obj.total_seconds()
            hours = int(total_seconds // 3600)
            minutes = int((total_seconds % 3600) // 60)
        elif isinstance(time_obj, str):
            # Parse string time
            hours, minutes = map(int, time_obj.split(':'))
        else:
            # Assume it's a time object
            hours = time_obj.hour
            minutes = time_obj.minute
        
        # Convert to 12-hour format WITHOUT AM/PM
        formatted_hour = hours % 12
        if formatted_hour == 0:
            formatted_hour = 12
        
        return f"{formatted_hour:02d}:{minutes:02d}"

    in_formatted_time = format_time(employee_am_in)
    out_formatted_time = format_time(employee_pm_out)
    regular_time = f'{in_formatted_time} - {out_formatted_time}'

    # Determine filename
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    if preview:
        # Convert relative path to absolute if needed
        if not os.path.isabs(export_folder):
            export_folder = os.path.join(script_dir, export_folder)
        previews_dir = os.path.join(export_folder, 'previews')
        os.makedirs(previews_dir, exist_ok=True)
        filename = os.path.join(previews_dir, str(employee_id))
    else:
        # Convert relative path to absolute if needed
        if not os.path.isabs(export_folder):
            export_folder = os.path.join(script_dir, export_folder)
        filename = os.path.join(export_folder, employee_office, employee_name, 
                               f'{months[first_month - 1]} {first_year}')
        os.makedirs(os.path.dirname(filename), exist_ok=True)

    now = datetime.datetime.now()
    if not preview:
        second_name_string = ''
        if second_month != 0:
            if months[first_month - 1] != months[second_month - 1]:
                second_name_string = f' - {months[second_month - 1]} {second_year}'
        filename = f'{filename} {second_name_string} v({now.date()}-{now.hour}-{now.minute}-{now.second})'

    file_path = None

    try:
        if export_to.lower() == 'excel':
            # Load the actual template file
            template_path = os.path.join(script_dir, 'templates', 'format.xlsx')
            if not os.path.exists(template_path):
                raise Exception(f"Template file not found: {template_path}")
            
            workbook = openpyxl.load_workbook(filename=template_path)
            sheet = workbook.active

            # Filling in first DTR Excel Template - USING YOUR EXACT COORDINATES
            sheet['A4'] = employee_name
            sheet['A6'] = f'{months[first_month - 1]} {first_date_range_string}, {first_year}'
            sheet['F7'] = regular_time
            sheet['C48'] = employee_signatory.upper()
            sheet['C49'] = employee_position
            sheet['C52'] = noter_signatory.upper()
            sheet['C53'] = noter_position

            # Fill DTR data for first period
            first_employee_dtr = db.get_dtr_by_month(employee_id, first_month, first_year, first_cut)
            for dtr in first_employee_dtr:
                date, am_in, am_out, pm_in, pm_out = dtr
                if date:
                    row = date.day + 10  # Date day + offset
                    
                    # NIGHT SHIFT: Special mapping for Excel display
                    if shift_type == 'night':
                        # Map pm_in (evening) → am_in column in Excel
                        # Map am_out (morning) → pm_out column in Excel
                        sheet[f'B{row}'] = format_dtr_time(pm_in)  # Evening IN goes to AM IN column
                        sheet[f'C{row}'] = ''  # AM OUT column empty for night shift
                        sheet[f'D{row}'] = ''  # PM IN column empty for night shift  
                        sheet[f'E{row}'] = format_dtr_time(am_out)  # Morning OUT goes to PM OUT column
                    else:
                        # Regular mapping for morning/mid shifts
                        sheet[f'B{row}'] = format_dtr_time(am_in)
                        sheet[f'C{row}'] = format_dtr_time(am_out)
                        sheet[f'D{row}'] = format_dtr_time(pm_in)
                        sheet[f'E{row}'] = format_dtr_time(pm_out)

            # Filling in second DTR Excel Template if provided
            if second_month != 0 and second_year != 0:
                sheet['I4'] = employee_name
                sheet['I6'] = f'{months[second_month - 1]} {second_date_range_string}, {second_year}'
                sheet['N7'] = regular_time
                sheet['K48'] = employee_signatory.upper()
                sheet['K49'] = employee_position
                sheet['K52'] = noter_signatory.upper()
                sheet['K53'] = noter_position
                
                # Fill DTR data for second period
                second_employee_dtr = db.get_dtr_by_month(employee_id, second_month, second_year, second_cut)
                for dtr in second_employee_dtr:
                    date, am_in, am_out, pm_in, pm_out = dtr
                    if date:
                        row = date.day + 10  # Date day + offset
                        
                        # NIGHT SHIFT: Special mapping for Excel display
                        if shift_type == 'night':
                            # Map pm_in (evening) → am_in column in Excel
                            # Map am_out (morning) → pm_out column in Excel
                            sheet[f'J{row}'] = format_dtr_time(pm_in)  # Evening IN goes to AM IN column
                            sheet[f'K{row}'] = ''  # AM OUT column empty for night shift
                            sheet[f'L{row}'] = ''  # PM IN column empty for night shift  
                            sheet[f'M{row}'] = format_dtr_time(am_out)  # Morning OUT goes to PM OUT column
                        else:
                            # Regular mapping for morning/mid shifts
                            sheet[f'J{row}'] = format_dtr_time(am_in)
                            sheet[f'K{row}'] = format_dtr_time(am_out)
                            sheet[f'L{row}'] = format_dtr_time(pm_in)
                            sheet[f'M{row}'] = format_dtr_time(pm_out)

            file_path = filename + '.xlsx'
            workbook.save(file_path)
            print(f'SUCCESS: Excel file saved to {file_path}')
            
        elif export_to.lower() == 'pdf':
            # For PDF export - using your template
            template_path = os.path.join(script_dir, 'templates', 'format.pdf')
            if not os.path.exists(template_path):
                raise Exception(f"PDF template file not found: {template_path}")
                
            packet = io.BytesIO()
            can = canvas.Canvas(packet, pagesize=letter)
            
            # Register fonts
            fonts_path = os.path.join(script_dir, 'templates')
            try:
                pdfmetrics.registerFont(TTFont('Calibri', os.path.join(fonts_path, 'Calibri.ttf')))
                pdfmetrics.registerFont(TTFont('Calibri Bold', os.path.join(fonts_path, 'Calibri Bold.ttf')))
                pdfmetrics.registerFont(TTFont('Segoe UI', os.path.join(fonts_path, 'Segoe UI.ttf')))
                pdfmetrics.registerFont(TTFont('Segoe UI Bold', os.path.join(fonts_path, 'Segoe UI Bold.ttf')))
                pdfmetrics.registerFont(TTFont('Times New Roman', os.path.join(fonts_path, 'Times New Roman.ttf')))
            except:
                print("WARNING: Could not load custom fonts, using default fonts")

            # First Page - USING YOUR EXACT COORDINATES
            can.setFont('Segoe UI Bold', 10)
            can.drawCentredString(168.5, 740, employee_name)

            can.setFont('Calibri Bold', 9)
            can.drawCentredString(168.5, 717.5, f'{months[first_month - 1]} {first_date_range_string}, {first_year}')

            can.setFont('Times New Roman', 8)
            can.drawString(213, 704, regular_time)

            can.setFont('Segoe UI Bold', 9)
            can.drawCentredString(178.5, 213.5, employee_signatory.upper())

            can.setFont('Times New Roman', 9)
            can.drawCentredString(178.5, 201, employee_position)

            can.setFont('Segoe UI Bold', 9)
            can.drawCentredString(178.5, 164, noter_signatory.upper())

            can.setFont('Times New Roman', 9)
            can.drawCentredString(178.5, 152, noter_position)

            # Time data for first period
            first_employee_dtr = db.get_dtr_by_month(employee_id, first_month, first_year, first_cut)
            can.setFont('Calibri', 9)

            for dtr in first_employee_dtr:
                date, am_in, am_out, pm_in, pm_out = dtr
                if date:
                    y = 656.5 - ((date.day - 1) * 12)
                    
                    # NIGHT SHIFT: Special mapping for PDF display
                    if shift_type == 'night':
                        # Map pm_in (evening) → am_in position in PDF
                        # Map am_out (morning) → pm_out position in PDF
                        if pm_in:
                            can.drawString(78.5, y, format_dtr_time(pm_in))  # Evening IN goes to AM IN position
                        if am_out:
                            can.drawString(185.6, y, format_dtr_time(am_out))  # Morning OUT goes to PM OUT position
                    else:
                        # Regular mapping for morning/mid shifts
                        if am_in:
                            can.drawString(78.5, y, format_dtr_time(am_in))
                        if am_out:
                            can.drawString(114.2, y, format_dtr_time(am_out))
                        if pm_in:
                            can.drawString(149.9, y, format_dtr_time(pm_in))
                        if pm_out:
                            can.drawString(185.6, y, format_dtr_time(pm_out))
                            
            # Second Page if provided
            if second_month != 0 and second_year != 0:
                can.setFont('Segoe UI Bold', 10)
                can.drawCentredString(423, 740, employee_name)

                can.setFont('Calibri Bold', 9)
                can.drawCentredString(423, 717.5, f'{months[second_month - 1]} {second_date_range_string}, {second_year}')

                can.setFont('Times New Roman', 8)
                can.drawString(467.5, 704, regular_time)

                can.setFont('Segoe UI Bold', 9)
                can.drawCentredString(433, 213.5, employee_signatory.upper())

                can.setFont('Times New Roman', 9)
                can.drawCentredString(433, 201, employee_position)

                can.setFont('Segoe UI Bold', 9)
                can.drawCentredString(433, 164, noter_signatory.upper())

                can.setFont('Times New Roman', 9)
                can.drawCentredString(433, 152, noter_position)

                # Time data for second period
                second_employee_dtr = db.get_dtr_by_month(employee_id, second_month, second_year, second_cut)
                can.setFont('Calibri', 9)

                for dtr in second_employee_dtr:
                    date, am_in, am_out, pm_in, pm_out = dtr
                    if date:
                        y = 656.5 - ((date.day - 1) * 12)
                        
                        # NIGHT SHIFT: Special mapping for PDF display
                        if shift_type == 'night':
                            # Map pm_in (evening) → am_in position in PDF
                            # Map am_out (morning) → pm_out position in PDF
                            if pm_in:
                                can.drawString(333, y, format_dtr_time(pm_in))  # Evening IN goes to AM IN position
                            if am_out:
                                can.drawString(440.1, y, format_dtr_time(am_out))  # Morning OUT goes to PM OUT position
                        else:
                            # Regular mapping for morning/mid shifts
                            if am_in:
                                can.drawString(333, y, format_dtr_time(am_in))
                            if am_out:
                                can.drawString(368.7, y, format_dtr_time(am_out))
                            if pm_in:
                                can.drawString(404.4, y, format_dtr_time(pm_in))
                            if pm_out:
                                can.drawString(440.1, y, format_dtr_time(pm_out))
                
            can.save()
            packet.seek(0)

            # Merge with template
            new_pdf = PdfReader(packet)
            template_pdf = PdfReader(open(template_path, 'rb'))
            output = PdfWriter()
            page = template_pdf.pages[0]
            page.merge_page(new_pdf.pages[0])
            output.add_page(page)
            
            file_path = filename + '.pdf'
            output_stream = open(file_path, 'wb')
            output.write(output_stream)
            output_stream.close()

            print(f'SUCCESS: PDF file saved to {file_path}')

        # Print file if requested
        if print_file_after_export and file_path and os.path.exists(file_path):
            print(f"Printing file: {file_path}")
            if print_file(file_path, printer_name):
                print("SUCCESS: File sent to printer")
            else:
                print("WARNING: File could not be printed")
        
        # Always return the file_path for preview
        if preview and file_path:
            print(file_path)
        
    except Exception as e:
        # If there's an error, make sure file_path is defined before trying to use it
        error_msg = f"ERROR: {str(e)}"
        print(error_msg)
        raise Exception(error_msg)
    
    finally:
        # Always close database connection
        db.cursor.close()
        db.connection.close()

def main():
    if len(sys.argv) < 7:
        print("Usage: python export_dtr.py <employee_id> <noter_signatory> <noter_position> <first_month> <first_year> <first_cut> [second_month] [second_year] [second_cut] [export_to] [preview] [print] [printer_name]")
        print("Example: python export_dtr.py 5491 \"John Doe\" \"Manager\" 10 2025 full 11 2025 last excel false true \"Printer Name\"")
        sys.exit(1)
    
    try:
        # Parse arguments
        employee_id = int(sys.argv[1])
        noter_signatory = sys.argv[2]
        noter_position = sys.argv[3]
        first_month = int(sys.argv[4])
        first_year = int(sys.argv[5])
        first_cut = sys.argv[6]
        
        # Optional arguments
        second_month = int(sys.argv[7]) if len(sys.argv) > 7 else 0
        second_year = int(sys.argv[8]) if len(sys.argv) > 8 else 0
        second_cut = sys.argv[9] if len(sys.argv) > 9 else 'full'
        export_to = sys.argv[10] if len(sys.argv) > 10 else 'excel'
        preview = sys.argv[11].lower() == 'true' if len(sys.argv) > 11 else False
        print_file_after_export = sys.argv[12].lower() == 'true' if len(sys.argv) > 12 else False
        printer_name = sys.argv[13] if len(sys.argv) > 13 else None
        
        export_dtr(
            employee_id=employee_id,
            noter_signatory=noter_signatory,
            noter_position=noter_position,
            first_month=first_month,
            first_year=first_year,
            first_cut=first_cut,
            second_month=second_month,
            second_year=second_year,
            second_cut=second_cut,
            export_to=export_to,
            preview=preview,
            print_file_after_export=print_file_after_export,
            printer_name=printer_name
        )
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()