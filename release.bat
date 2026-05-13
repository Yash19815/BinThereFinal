@echo off
:: BinThere Release — delegates to release.ps1 to avoid CMD setlocal recursion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1"
