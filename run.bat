@echo off
setlocal
title Virtual Electronics Lab

cd /d "%~dp0"

echo.
echo ==========================================
echo       VIRTUAL ELECTRONICS LAB
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not available in PATH.
    echo Install Node.js 20.19+ or 22.12+ from https://nodejs.org/
    echo Then close and reopen this window and run this file again.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found. Please reinstall Node.js with npm included.
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

if not exist "node_modules\" (
    echo [INFO] Installing project dependencies...
    echo This may take a few minutes and requires an internet connection.
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo If the error persists, send the complete npm error log.
        echo.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Dependencies already installed.
)

echo.
echo [INFO] Starting Virtual Electronics Lab...
echo [INFO] Open this address if the browser does not open automatically:
echo       http://localhost:3000
echo [INFO] Keep this window open while using the lab.
echo [INFO] Press CTRL+C here to stop the server.
echo.

call npm run dev -- --open
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
    echo [ERROR] The development server stopped with an error.
) else (
    echo [INFO] The development server has stopped.
)
pause
exit /b %EXIT_CODE%
