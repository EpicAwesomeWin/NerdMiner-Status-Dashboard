@echo off
REM NerdMiner Status Dashboard - Automated Deployment Script
REM Creates a complete deployment package with timestamp

echo ========================================
echo NerdMiner Status Dashboard
echo Automated Deployment Builder
echo ========================================
echo.

REM Get timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%-%datetime:~8,6%

REM Version info
set VERSION=1.0.0
set BUILD=1
set PROJECT_NAME=NerdMiner-Status

REM Create deployment folder name
set DEPLOY_FOLDER=%PROJECT_NAME%-%TIMESTAMP%-v%VERSION%-build%BUILD%
set DEPLOY_PATH=deploy\%DEPLOY_FOLDER%

echo Creating deployment package...
echo Folder: %DEPLOY_FOLDER%
echo.

REM Create deploy directory structure
if not exist "deploy" mkdir "deploy"
if exist "%DEPLOY_PATH%" (
    echo [WARNING] Deployment folder already exists. Removing old version...
    rmdir /s /q "%DEPLOY_PATH%"
)
mkdir "%DEPLOY_PATH%"

echo [1/5] Copying core application files...
copy /Y "index.html" "%DEPLOY_PATH%\" >nul
copy /Y "styles.css" "%DEPLOY_PATH%\" >nul
copy /Y "script.js" "%DEPLOY_PATH%\" >nul
copy /Y "server.py" "%DEPLOY_PATH%\" >nul
copy /Y "database.py" "%DEPLOY_PATH%\" >nul
copy /Y "favicon.svg" "%DEPLOY_PATH%\" >nul
echo    - Copied 6 core files

echo [2/5] Creating setup scripts...

REM Create init_database.py
(
echo #!/usr/bin/env python3
echo """
echo Initialize empty database with schema
echo """
echo import sqlite3
echo import os
echo.
echo def init_database^(^):
echo     db_path = 'nerdminer_history.db'
echo     
echo     # Remove existing database if present
echo     if os.path.exists^(db_path^):
echo         os.remove^(db_path^)
echo         print^(f"Removed existing database: {db_path}"^)
echo     
echo     conn = sqlite3.connect^(db_path^)
echo     cursor = conn.cursor^(^)
echo     
echo     # Create miner_history table
echo     cursor.execute^('''
echo         CREATE TABLE IF NOT EXISTS miner_history ^(
echo             id INTEGER PRIMARY KEY AUTOINCREMENT,
echo             miner_ip TEXT NOT NULL,
echo             miner_name TEXT,
echo             timestamp TEXT NOT NULL,
echo             status TEXT,
echo             hashrate REAL,
echo             shares INTEGER,
echo             accepted_shares INTEGER,
echo             best_difficulty TEXT,
echo             temperature REAL,
echo             uptime TEXT
echo         ^)
echo     '''^)
echo     
echo     # Create miners table
echo     cursor.execute^('''
echo         CREATE TABLE IF NOT EXISTS miners ^(
echo             ip TEXT PRIMARY KEY,
echo             name TEXT,
echo             first_seen TEXT,
echo             last_seen TEXT
echo         ^)
echo     '''^)
echo     
echo     # Create index for faster queries
echo     cursor.execute^('''
echo         CREATE INDEX IF NOT EXISTS idx_miner_timestamp 
echo         ON miner_history^(miner_ip, timestamp^)
echo     '''^)
echo     
echo     conn.commit^(^)
echo     conn.close^(^)
echo     
echo     print^(f"✓ Database initialized: {db_path}"^)
echo     print^("✓ Tables created: miner_history, miners"^)
echo     print^("✓ Index created: idx_miner_timestamp"^)
echo     print^("\nDatabase is ready to use!"^)
echo.
echo if __name__ == '__main__':
echo     init_database^(^)
) > "%DEPLOY_PATH%\init_database.py"

REM Create SETUP.bat
(
echo @echo off
echo REM NerdMiner Status Dashboard - Windows Setup Script
echo REM Quick setup for Windows users
echo.
echo echo ========================================
echo echo NerdMiner Status Dashboard Setup
echo echo Version: %VERSION% Build %BUILD%
echo echo ========================================
echo echo.
echo.
echo REM Check Python installation
echo python --version ^>nul 2^>^&1
echo if errorlevel 1 ^(
echo     echo [ERROR] Python is not installed!
echo     echo.
echo     echo Please install Python 3.8 or higher from:
echo     echo https://www.python.org/downloads/
echo     echo.
echo     echo Make sure to check "Add Python to PATH" during installation.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo [OK] Python is installed
echo python --version
echo echo.
echo.
echo REM Initialize database
echo echo Initializing database...
echo python init_database.py
echo echo.
echo.
echo echo ========================================
echo echo Setup Complete!
echo echo ========================================
echo echo.
echo echo To start the dashboard:
echo echo 1. Double-click START.bat
echo echo    OR
echo echo 2. Run: python server.py
echo echo.
echo echo Then open your browser to: http://localhost:8000
echo echo.
echo pause
) > "%DEPLOY_PATH%\SETUP.bat"

REM Create START.bat
(
echo @echo off
echo REM NerdMiner Status Dashboard - Start Server
echo title NerdMiner Status Dashboard
echo echo ========================================
echo echo  NerdMiner Status Dashboard - Startup
echo echo ========================================
echo echo.
echo echo Press ENTER to use default port ^(8000^)
echo echo Or enter a custom port number ^(1-65535^):
echo echo.
echo set /p USER_PORT="Port [default: 8000]: "
echo.
echo if "%%USER_PORT%%"=="" ^(
echo     set PORT=8000
echo     echo.
echo     echo Using default port: 8000
echo ^) else ^(
echo     set PORT=%%USER_PORT%%
echo     echo.
echo     echo Using custom port: %%PORT%%
echo ^)
echo.
echo echo.
echo echo ========================================
echo echo  Starting server on http://localhost:%%PORT%%
echo echo  Press Ctrl+C to stop the server
echo echo ========================================
echo echo.
echo python server.py %%PORT%%
) > "%DEPLOY_PATH%\START.bat"

REM Create requirements.txt
(
echo # NerdMiner Status Dashboard - Python Dependencies
echo # No external dependencies required! Uses Python standard library only.
echo # 
echo # Python 3.8 or higher is required.
echo # Built-in modules used:
echo # - http.server
echo # - sqlite3
echo # - json
echo # - urllib
echo # - html.parser
) > "%DEPLOY_PATH%\requirements.txt"

echo    - Created 4 setup files

echo [3/5] Creating documentation...

REM Copy or create README.md, LICENSE, etc. (simplified version for batch)
(
echo # NerdMiner Status Dashboard
echo.
echo **Version:** %VERSION% Build %BUILD%
echo **Date:** %date%
echo.
echo ## Quick Start
echo.
echo ### Windows:
echo 1. Double-click `SETUP.bat`
echo 2. Double-click `START.bat`
echo 3. Open `http://localhost:8000`
echo.
echo ### Mac/Linux:
echo ```bash
echo python3 init_database.py
echo python3 server.py
echo ```
echo.
echo ## Features
echo - Real-time miner monitoring
echo - Historical data tracking
echo - Dark mode support
echo - Responsive design
echo - Zero external dependencies
echo.
echo ## Requirements
echo - Python 3.8 or higher
echo - Modern web browser
echo.
echo ## Documentation
echo See full documentation at: [GitHub Repository URL]
echo.
echo ## License
echo MIT License - See LICENSE file
) > "%DEPLOY_PATH%\README.md"

REM Create LICENSE
(
echo MIT License
echo.
echo Copyright ^(c^) 2026 EpicAwesomeWin
echo.
echo Permission is hereby granted, free of charge, to any person obtaining a copy
echo of this software and associated documentation files ^(the "Software"^), to deal
echo in the Software without restriction, including without limitation the rights
echo to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
echo copies of the Software, and to permit persons to whom the Software is
echo furnished to do so, subject to the following conditions:
echo.
echo The above copyright notice and this permission notice shall be included in all
echo copies or substantial portions of the Software.
echo.
echo THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
echo IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
echo FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
echo AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
echo LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
echo OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
echo SOFTWARE.
) > "%DEPLOY_PATH%\LICENSE"

REM Create VERSION.json
(
echo {
echo   "project": "%PROJECT_NAME%",
echo   "version": "%VERSION%",
echo   "build": %BUILD%,
echo   "timestamp": "%TIMESTAMP%",
echo   "date": "%date%"
echo }
) > "%DEPLOY_PATH%\VERSION.json"

echo    - Created 3 documentation files

echo [4/5] Cleaning up...
REM Remove database file if exists (users should create fresh)
if exist "%DEPLOY_PATH%\nerdminer_history.db" (
    del /f /q "%DEPLOY_PATH%\nerdminer_history.db"
    echo    - Removed database file ^(users will create fresh^)
)

echo [5/5] Finalizing package...

REM Count files and get size
for /f %%A in ('dir /b /a-d "%DEPLOY_PATH%" ^| find /c /v ""') do set FILE_COUNT=%%A

echo.
echo ========================================
echo Deployment Package Created Successfully!
echo ========================================
echo.
echo Location: %DEPLOY_PATH%
echo Files: %FILE_COUNT%
echo.
echo Package contents:
dir /b "%DEPLOY_PATH%"
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo.
echo 1. Test the package:
echo    cd %DEPLOY_PATH%
echo    SETUP.bat
echo.
echo 2. Distribute:
echo    - ZIP the folder
echo    - Upload to GitHub
echo    - Share with community
echo.
echo Press any key to open deployment folder...
pause >nul
explorer "%DEPLOY_PATH%"
