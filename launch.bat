@echo off
setlocal
cd /d "%~dp0"

echo ------------------------------------------
echo OpenClaw Live Wallpaper Engine - Launcher
echo ------------------------------------------
echo.

echo Checking dependencies...

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js to run this app.
    pause
    exit /b 1
)

:: Check if Rust/Cargo is installed
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Rust is not installed. Please install Rust to compile the backend.
    pause
    exit /b 1
)

:: Check if mpv is installed
if not exist "C:\Program Files\MPV Player\mpv.exe" (
    if not exist "C:\Program Files\mpv\mpv.exe" (
        echo [WARNING] MPV Player not found in standard directories. The wallpaper engine requires it.
        echo Consider installing using: winget install shinchiro.mpv
    )
)

echo.
echo Launching Tauri application...
call npx tauri dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Tauri application exited with an error code.
    pause
)

endlocal
