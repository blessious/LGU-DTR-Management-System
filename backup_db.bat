@echo off
:: ============================================
:: DTR Database Backup Script
:: Server: 192.168.1.52 | DB: new_dtr
:: ============================================

:: --- CONFIG ---
set DB_HOST=192.168.1.52
set DB_PORT=3306
set DB_USER=adtr
set DB_PASS=adtr
set DB_NAME=new_dtr
set BACKUP_DIR=C:\MuniClockBackup
set MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe

:: --- DATE/TIME STAMP ---
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DATETIME=%%I
set STAMP=%DATETIME:~0,4%-%DATETIME:~4,2%-%DATETIME:~6,2%_%DATETIME:~8,2%%DATETIME:~10,2%%DATETIME:~12,2%

:: --- CREATE BACKUP DIR IF NOT EXISTS ---
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: --- OUTPUT FILE ---
set OUTFILE=%BACKUP_DIR%\%DB_NAME%_%STAMP%.sql

:: --- RUN BACKUP ---
echo.
echo [%DATE% %TIME%] Starting backup of "%DB_NAME%"...
"%MYSQLDUMP%" -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASS% %DB_NAME% > "%OUTFILE%"

:: --- CHECK RESULT ---
if %ERRORLEVEL% == 0 (
    echo [SUCCESS] Backup saved to:
    echo           %OUTFILE%
) else (
    echo [FAILED]  Backup failed! Check mysqldump path and DB credentials.
)

:: --- DELETE BACKUPS OLDER THAN 7 DAYS ---
echo.
echo Cleaning up backups older than 7 days...
forfiles /P "%BACKUP_DIR%" /S /M *.sql /D -7 /C "cmd /c del @path" 2>nul
echo Done.

echo.
pause