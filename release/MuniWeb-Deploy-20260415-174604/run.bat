@echo off
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo Starting Frontend...
start /min "MuniWeb-Frontend" cmd /c "title MuniWeb-Frontend && npm run dev"

echo Starting Backend Server...
cd /d "%ROOT_DIR%server"
start /min "MuniWeb-Backend" cmd /c "title MuniWeb-Backend && npm start"

echo.
echo ==========================================
echo   MuniWeb is now running in the background.
echo   Check the taskbar for minimized windows.
echo ==========================================
timeout /t 5

