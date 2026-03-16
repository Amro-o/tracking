@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════╗
echo ║   حضور الحلقات — بناء ملف .exe              ║
echo ║   Building Attendance System Launcher EXE   ║
echo ╚══════════════════════════════════════════════╝
echo.

REM التحقق من Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت. يرجى تثبيته من https://nodejs.org
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] تثبيت pkg...
call npm install -g pkg >nul 2>&1
if errorlevel 1 (
    echo [خطأ] فشل تثبيت pkg
    echo [ERROR] Failed to install pkg
    pause
    exit /b 1
)
echo       ✓ pkg مثبت

echo [2/4] التحقق من ملف launcher.js...
if not exist "launcher.js" (
    echo [خطأ] launcher.js غير موجود
    pause
    exit /b 1
)
echo       ✓ launcher.js موجود

echo [3/4] بناء ملف .exe ...
call pkg launcher.js --target node18-win-x64 --output "حضور-الحلقات.exe" --compress GZip
if errorlevel 1 (
    echo.
    echo [خطأ] فشل البناء. جرّب:
    echo         pkg launcher.js --target node18-win-x64 --output attendance.exe
    pause
    exit /b 1
)
echo       ✓ تم إنشاء الملف

echo [4/4] نسخ الملف إلى مجلد app...
if not exist "app" mkdir app
copy /Y "حضور-الحلقات.exe" "app\حضور-الحلقات.exe" >nul 2>&1
echo       ✓ تم النسخ

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   ✅ تم الإنشاء بنجاح!                      ║
echo ║                                              ║
echo ║   الملف: حضور-الحلقات.exe                   ║
echo ║                                              ║
echo ║   انقر نقراً مزدوجاً لتشغيل التطبيق          ║
echo ║   بدون أي نافذة سوداء!                       ║
echo ╚══════════════════════════════════════════════╝
echo.
pause
