@echo off
REM ============================================================
REM  WorkMate one-click diagnostic launcher
REM  - Double-click to run; no admin required
REM  - Generates "WorkMate-diagnosis-*.txt" in current directory
REM  - Auto-launches Notepad with the report when done
REM ============================================================

setlocal

echo.
echo ============================================================
echo   WorkMate one-click diagnostic script
echo   Collecting system info to troubleshoot "won't open" issues
echo ============================================================
echo.
echo Will collect info and generate a report (~5-10 seconds)...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0WorkMate-diagnose.ps1"

echo.
pause