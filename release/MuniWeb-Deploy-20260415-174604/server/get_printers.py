#!/usr/bin/env python3
import win32print
import json

def get_available_printers():
    printers = []
    try:
        # Get all printer names
        printer_list = win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        )
        
        for printer in printer_list:
            printer_name = printer[2]
            printers.append(printer_name)
            
    except Exception as e:
        print(f"Error getting printers: {str(e)}")
    
    return printers

if __name__ == "__main__":
    printers = get_available_printers()
    print(json.dumps(printers))