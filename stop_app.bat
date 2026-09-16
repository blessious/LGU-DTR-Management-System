@echo off
setlocal EnableDelayedExpansion
echo Stopping MuniWeb processes...

rem The startup VBS runs the commands hidden, so their window titles cannot be
rem used reliably.  The DTR frontend and backend use the ports below instead.
call :stop_port 8080 Frontend
call :stop_port 5000 Backend

echo.
echo ==========================================
echo   MuniWeb stop attempt complete.
echo ==========================================
pause
exit /b

:stop_port
set "PORT=%~1"
set "NAME=%~2"
set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
    if not defined SEEN_%%P (
        set "SEEN_%%P=1"
        set "FOUND=1"
        echo Stopping %NAME% on port %PORT% - PID %%P...
        taskkill /f /t /pid %%P >nul 2>&1
        if errorlevel 1 (
            echo Could not stop %NAME%. Run stop_app.bat as Administrator.
        ) else (
            echo %NAME% stopped.
        )
    )
)
if not defined FOUND echo %NAME% was not running on port %PORT%.
exit /b
