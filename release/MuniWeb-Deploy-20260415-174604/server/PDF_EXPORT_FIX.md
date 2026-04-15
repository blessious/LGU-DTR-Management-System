# PDF Export Fix and Installation Guide

## Problem Summary
When installing the system on another PC, PDF export fails with the error:
```
{"message":"PDF file not found"}
```

This occurs when trying to access: `http://192.168.0.18:5000/api/dtr/pdf-preview/5491.pdf`

## Root Causes (Fixed)
1. ❌ **Inconsistent path separators** - Code was mixing backslashes (\) with os.path.join()
2. ❌ **Missing preview directory** - The `exports/previews` folder wasn't created automatically
3. ❌ **Path not absolute** - Relative paths weren't being converted to absolute paths correctly
4. ❌ **Lack of auto-initialization** - Directories weren't created when server starts or Python scripts run

## Changes Made

### 1. **server/config.py** - Added directory initialization
- New function: `ensure_export_directories()`
- Automatically creates `exports` and `exports/previews` folders
- Converts relative paths to absolute paths

### 2. **server/export_dtr.py** - Fixed path handling
- Uses `os.path.join()` for all path operations (cross-platform compatible)
- Calls `ensure_export_directories()` before generating PDFs
- Automatically creates parent directories with `exist_ok=True`

### 3. **server/dtr.py** - Fixed path handling
- Replaced backslash f-strings with `os.path.join()`
- Uses `exist_ok=True` to safely create directories

### 4. **server/mass_export_dtr.py** - Fixed path handling
- Imports and calls `ensure_export_directories()`
- Ensures directories exist before processing mass exports

### 5. **server/index.js** - Server initialization
- Automatically creates export directories when server starts
- Handles both absolute and relative paths
- Logs directory creation status
- Fixed PDF endpoint to add `.pdf` extension if missing

## Installation Instructions for New PC

### Step 1: Copy Project Files
```bash
# Copy entire project to the new PC
# Ensure these core files are present:
# - server/config.json
# - server/export_dtr.py
# - server/dtr.py
# - server/mass_export_dtr.py
# - server/index.js
# - server/config.py
```

### Step 2: Update Server Configuration
Edit [server/config.json](server/config.json) with the new PC's database details:
```json
{
  "database": {
    "host": "192.168.x.x",     // IP of MySQL server on new PC
    "user": "adtr",
    "password": "adtr",
    "database": "new_dtr",
    "port": 3306
  },
  "export": {
    "path": "exports"           // Can be relative or absolute path
  }
}
```

### Step 3: Install Python Dependencies
```bash
cd server
pip install -r ..\requirements.txt
```

### Step 4: Start the Server
```bash
# On Windows, run:
node index.js
```

The server will automatically:
- ✅ Create `exports` directory
- ✅ Create `exports/previews` subdirectory
- ✅ Output confirmation messages on startup

### Step 5: Verify PDF Export Works
1. Start the application frontend
2. Navigate to an employee record
3. Click "Export to PDF" or "Generate Preview"
4. Check if PDF shows up without errors

If you see: `Looking for PDF at: ...` messages in the console, the path handling is working correctly.

## Troubleshooting

### Issue: "PDF file not found" still appears

**Check 1: Verify directories exist**
```bash
# On Windows:
dir exports
dir exports\previews
```

If folders don't exist, the server failed to create them. Check server logs for errors.

**Check 2: Check server logs**
Look for these messages when server starts:
```
✅ Created export directory: ...
✅ Created previews directory: ...
```

**Check 3: Check PDF was actually generated**
```bash
# Look for PDF files in:
# \exports\previews\
# Should contain files like: 5491.pdf
dir exports\previews
```

**Check 4: Verify config.json is correct**
```bash
# Open server/config.json and verify:
# - Database host matches the MySQL server IP
# - Export path is valid
```

### Issue: Permission Denied when creating directories

**Solution:**
- Ensure the account running Node.js has write permissions to the server folder
- Try using an absolute path in config.json instead of relative:
```json
{
  "export": {
    "path": "C:\\Users\\admin\\Music\\MuniWeb\\exports"
  }
}
```

### Issue: Path mixing backslashes and forward slashes

**This should be fixed now**. All code uses `os.path.join()` and Node.js `path.join()` which automatically handles the correct separators for each OS.

## Configuration Options

### Using Absolute Path (Recommended for network shares)
```json
{
  "export": {
    "path": "\\\\NETWORK-PC\\shared\\DTR-exports"
  }
}
```

### Using Relative Path (Default)
```json
{
  "export": {
    "path": "exports"
  }
}
```
This creates folder at: `c:\Users\admin\Music\MuniWeb\server\exports`

## Files Modified
- ✅ [server/config.py](server/config.py)
- ✅ [server/export_dtr.py](server/export_dtr.py)
- ✅ [server/dtr.py](server/dtr.py)
- ✅ [server/mass_export_dtr.py](server/mass_export_dtr.py)
- ✅ [server/index.js](server/index.js)

## Testing the Fix

After installation, test with this command:
```bash
# From server directory:
python export_dtr.py <EMPLOYEE_ID> "Test User" "Manager" 1 2025 full 0 0 full pdf true false ""

# Example:
python export_dtr.py 5491 "Test User" "Manager" 1 2025 full 0 0 full pdf true false ""
```

If successful, you'll see:
```
SUCCESS: PDF file saved to exports/previews/5491.pdf
5491.pdf
```

Then try accessing: `http://192.168.0.18:5000/api/dtr/pdf-preview/5491`
