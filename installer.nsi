; ══════════════════════════════════════════════════════════
;  SchoolTrack — NSIS Installer Script
;  To build the EXE:
;  1. Install NSIS from https://nsis.sourceforge.io/Download
;  2. Right-click this file → "Compile NSIS Script"
;  3. SchoolTrack_Installer.exe will be created
;
;  NOTE: Node.js must be installed on the target PC.
;        Download from: https://nodejs.org (LTS version)
; ══════════════════════════════════════════════════════════

!define APP_NAME "SchoolTrack"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "Your School"
!define INSTALL_DIR "$PROGRAMFILES\SchoolTrack"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\SchoolTrack"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "SchoolTrack_Installer.exe"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin
ShowInstDetails show

; Modern UI
!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Main Application" SecMain
  SetOutPath "$INSTDIR"

  ; Copy all files
  File /r "app\*.*"
  File "server.js"
  File "package.json"
  File "START.bat"
  File "SETUP_AUTOSTART.bat"

  ; Create data directories
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\photos"
  CreateDirectory "$INSTDIR\reports\daily"
  CreateDirectory "$INSTDIR\reports\monthly"
  CreateDirectory "$INSTDIR\backups"

  ; Install npm dependencies
  DetailPrint "Installing Node.js dependencies..."
  nsExec::ExecToLog 'cmd /C "cd /D "$INSTDIR" && npm install --production"'

  ; Create desktop shortcut
  CreateShortcut "$DESKTOP\SchoolTrack.lnk" "$INSTDIR\START.bat" "" "$INSTDIR\icon.ico" 0

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\SchoolTrack"
  CreateShortcut "$SMPROGRAMS\SchoolTrack\SchoolTrack.lnk" "$INSTDIR\START.bat"
  CreateShortcut "$SMPROGRAMS\SchoolTrack\Uninstall SchoolTrack.lnk" "$INSTDIR\Uninstall.exe"

  ; Register uninstaller
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName"      "${APP_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString"  "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion"   "${APP_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher"        "${APP_PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation"  "$INSTDIR"

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Optionally add to startup
  MessageBox MB_YESNO "Would you like SchoolTrack to start automatically when Windows starts?" IDNO SkipAutoStart
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SchoolTrack" '"$INSTDIR\START.bat"'
  SkipAutoStart:

SectionEnd

Section "Uninstall"
  ; Remove files (preserve data folder)
  Delete "$INSTDIR\server.js"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\START.bat"
  Delete "$INSTDIR\SETUP_AUTOSTART.bat"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\node_modules"

  ; Remove shortcuts
  Delete "$DESKTOP\SchoolTrack.lnk"
  Delete "$SMPROGRAMS\SchoolTrack\SchoolTrack.lnk"
  Delete "$SMPROGRAMS\SchoolTrack\Uninstall SchoolTrack.lnk"
  RMDir  "$SMPROGRAMS\SchoolTrack"

  ; Remove registry entries
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SchoolTrack"

  MessageBox MB_OK "SchoolTrack has been uninstalled.$\n$\nYour data folder at $INSTDIR\data has been preserved."
SectionEnd
