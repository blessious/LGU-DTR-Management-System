@echo off
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
)
echo VITE_API_URL=http://%IP::=%:5000
pause