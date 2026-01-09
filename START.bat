@echo off
REM NerdMiner Status Dashboard - Start Server
title NerdMiner Status Dashboard
echo ========================================
echo  NerdMiner Status Dashboard - Startup
echo ========================================
echo.
echo Press ENTER to use default port (8000)
echo Or enter a custom port number (1-65535):
echo.
set /p USER_PORT="Port [default: 8000]: "

if "%USER_PORT%"=="" (
    set PORT=8000
    echo.
    echo Using default port: 8000
) else (
    set PORT=%USER_PORT%
    echo.
    echo Using custom port: %PORT%
)

echo.
echo ========================================
echo  Starting server on http://localhost:%PORT%
echo  Press Ctrl+C to stop the server
echo ========================================
echo.
python server.py %PORT%
