@echo off
echo ============================================
echo   ZENTRA PRO - Setup Script
echo ============================================
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)

echo.
echo ============================================
echo   Starting Zentra Pro...
echo ============================================
echo.
npm start

pause
