@echo off
setlocal
chcp 65001 >nul
set "ROOT=%~dp0"

echo ================================================
echo   WordStairs - starting both services
echo ================================================
echo.

where python >nul 2>nul
if errorlevel 1 (echo [ERROR] Python not found in PATH. & pause & exit /b 1)

where npm >nul 2>nul
if errorlevel 1 (echo [ERROR] npm not found in PATH. & pause & exit /b 1)

echo [0/2] Stopping old instances...
rem 1) kill console windows opened by a previous start.cmd (with their child trees)
taskkill /FI "WINDOWTITLE eq WordStairs-backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WordStairs-frontend*" /T /F >nul 2>&1
rem 2) kill whatever still listens on our ports
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8735 " ^| findstr "LISTENING"') do taskkill /PID %%p /T /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%p /T /F >nul 2>&1
rem 3) kill orphaned python worker children whose parent is gone (they can hold the port)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*spawn_main*' -and -not (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
timeout /t 1 /nobreak >nul 2>&1 || ping -n 2 127.0.0.1 >nul
echo       done.
echo.

echo [1/2] Starting backend FastAPI on http://127.0.0.1:8735 ...
start "WordStairs-backend :8735" /D "%ROOT%backend" cmd /k python -m uvicorn app.main:app --host 127.0.0.1 --port 8735 --reload

echo [2/2] Starting frontend Vite on http://localhost:5173 ...
start "WordStairs-frontend :5173" /D "%ROOT%frontend" cmd /k npm run dev

echo.
echo Both services started fresh. Live logs are shown in their own console windows:
echo   backend  http://127.0.0.1:8735   (API docs at /docs)
echo   frontend http://localhost:5173
echo.
echo To stop a service: close its window, or press Ctrl+C inside it.
echo.
pause
