@echo off
REM Encaminha ao PowerShell. No Ctrl+C, responda S se o CMD perguntar —
REM o Job Object do dev.ps1 já encerra backend/frontend mesmo se o PS for morto.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
exit /b %ERRORLEVEL%
