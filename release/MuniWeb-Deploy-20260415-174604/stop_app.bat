@echo off
echo Stopping MuniWeb processes...

rem Stop titled MuniWeb console windows first.
taskkill /f /t /fi "WINDOWTITLE eq MuniWeb-Frontend*" >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq MuniWeb-Backend*" >nul 2>&1

rem Fallback: stop only processes bound to known MuniWeb ports.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
	taskkill /f /pid %%p >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":8080 .*LISTENING"') do (
	taskkill /f /pid %%p >nul 2>&1
)

echo.
echo ==========================================
echo   MuniWeb processes have been stopped.
echo ==========================================
pause
