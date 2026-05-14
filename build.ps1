# ─────────────────────────────────────────────────────────────────────────────
# BinThere Build Script (PowerShell)
# Builds the Electron app into dist-electron/ without uploading to GitHub.
# Run this to test the packaged .exe locally before releasing.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "BinThere - Build"

Write-Host ""
Write-Host "  ██████╗ ██╗███╗   ██╗████████╗██╗  ██╗███████╗██████╗ ███████╗" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║████╗  ██║╚══██╔══╝██║  ██║██╔════╝██╔══██╗██╔════╝" -ForegroundColor Cyan
Write-Host "  ██████╔╝██║██╔██╗ ██║   ██║   ███████║█████╗  ██████╔╝█████╗  " -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║██║╚██╗██║   ██║   ██╔══██║██╔══╝  ██╔══██╗██╔══╝  " -ForegroundColor Cyan
Write-Host "  ██████╔╝██║██║ ╚████║   ██║   ██║  ██║███████╗██║  ██║███████╗" -ForegroundColor Cyan
Write-Host "  ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Local Build — No GitHub Upload" -ForegroundColor White
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── [1/4] Check prerequisites ─────────────────────────────────────────────────
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: npx is not available. Reinstall Node.js." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  [OK] All prerequisites satisfied." -ForegroundColor Green
Write-Host ""

# ── [2/4] Read version from root package.json ─────────────────────────────────
Write-Host "[2/4] Reading version from package.json..." -ForegroundColor Yellow

$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$VERSION = $packageJson.version

if (-not $VERSION) {
    Write-Host "  ERROR: Could not read version from package.json." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$EXE_NAME = "BinThere-Setup-$VERSION.exe"

Write-Host "  Version : $VERSION" -ForegroundColor White
Write-Host "  Output  : dist-electron\$EXE_NAME" -ForegroundColor White
Write-Host ""

# ── [3/4] Clean old build artefacts ───────────────────────────────────────────
Write-Host "[3/4] Cleaning old build directories..." -ForegroundColor Yellow

Write-Host "  Terminating existing app processes..." -ForegroundColor DarkGray
taskkill /F /IM BinThere.exe /T 2>$null | Out-Null
taskkill /F /IM node.exe /FI "WINDOWTITLE eq BinThere*" /T 2>$null | Out-Null
Start-Sleep -Seconds 2

if (Test-Path "dist-electron") { Remove-Item -Recurse -Force "dist-electron" }
if (Test-Path "client\dist")   { Remove-Item -Recurse -Force "client\dist" }

Write-Host "  [OK] dist-electron/ and client/dist/ removed." -ForegroundColor Green
Write-Host ""

# ── [4/4] Build ────────────────────────────────────────────────────────────────
Write-Host "[4/4] Building Electron application..." -ForegroundColor Yellow
Write-Host ""

# 4a. Vite frontend build
Write-Host "  [4a] Building React Vite frontend..." -ForegroundColor White
npm run build --prefix client
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Frontend build failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Frontend built." -ForegroundColor Green
Write-Host ""

# 4b. Rebuild better-sqlite3 native module
Write-Host "  [4b] Rebuilding native modules (better-sqlite3)..." -ForegroundColor White
npm run rebuild:sqlite
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Native module rebuild failed." -ForegroundColor Red
    Write-Host "         Run 'npm install' from the project root and retry." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Native modules rebuilt." -ForegroundColor Green
Write-Host ""

# 4c. Package with electron-builder
Write-Host "  [4c] Packaging with electron-builder (this may take 2-5 minutes)..." -ForegroundColor White
npx electron-builder --win --x64
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: electron-builder failed. Check output above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Rename to canonical versioned name if needed
$exeFiles = Get-ChildItem -Path "dist-electron" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue
if (-not $exeFiles) {
    $exeFiles = Get-ChildItem -Path "dist-electron" -Filter "*.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "*.blockmap" }
}

if (-not $exeFiles) {
    Write-Host ""
    Write-Host "  ERROR: No .exe installer found in dist-electron/ after build." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$builtExe = $exeFiles[0]
if ($builtExe.Name -ne $EXE_NAME) {
    Rename-Item -Path $builtExe.FullName -NewName $EXE_NAME
    Write-Host "  [OK] Renamed '$($builtExe.Name)' -> '$EXE_NAME'" -ForegroundColor Green
}

Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "   BUILD COMPLETE" -ForegroundColor Green
Write-Host "   Version  : $VERSION" -ForegroundColor White
Write-Host "   Installer: dist-electron\$EXE_NAME" -ForegroundColor White
Write-Host "   To upload this build to GitHub, run: .\upload.ps1" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

$openFolder = Read-Host "  Open dist-electron folder now? (y/N)"
if ($openFolder -eq "y" -or $openFolder -eq "Y") {
    Start-Process "explorer.exe" "dist-electron"
}

Read-Host "Press Enter to close"
