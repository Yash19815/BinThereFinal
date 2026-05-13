# ─────────────────────────────────────────────────────────────────────────────
# BinThere Build & GitHub Release Script (PowerShell)
# Requires: gh CLI (https://cli.github.com/) logged in via `gh auth login`
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "BinThere - Build & Release"

Write-Host ""
Write-Host "  ██████╗ ██╗███╗   ██╗████████╗██╗  ██╗███████╗██████╗ ███████╗" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║████╗  ██║╚══██╔══╝██║  ██║██╔════╝██╔══██╗██╔════╝" -ForegroundColor Cyan
Write-Host "  ██████╔╝██║██╔██╗ ██║   ██║   ███████║█████╗  ██████╔╝█████╗  " -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║██║╚██╗██║   ██║   ██╔══██║██╔══╝  ██╔══██╗██╔══╝  " -ForegroundColor Cyan
Write-Host "  ██████╔╝██║██║ ╚████║   ██║   ██║  ██║███████╗██║  ██║███████╗" -ForegroundColor Cyan
Write-Host "  ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Build + Release Automation" -ForegroundColor White
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── 1. Check prerequisites ─────────────────────────────────────────────────────
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  ERROR: GitHub CLI (gh) is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Install it from: https://cli.github.com/" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ERROR: GitHub CLI is not authenticated." -ForegroundColor Red
    Write-Host "  Run: gh auth login" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  [OK] All prerequisites satisfied." -ForegroundColor Green
Write-Host ""

# ── 2. Read version from root package.json ────────────────────────────────────
Write-Host "[2/5] Reading version from package.json..." -ForegroundColor Yellow

$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$VERSION = $packageJson.version

if (-not $VERSION) {
    Write-Host "  ERROR: Could not read version from package.json." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$TAG = "v$VERSION"
Write-Host "  Version : $VERSION" -ForegroundColor White
Write-Host "  Tag     : $TAG" -ForegroundColor White
Write-Host ""

# ── 3. Parse release notes from CHANGELOG.md ──────────────────────────────────
Write-Host "[3/5] Extracting release notes from CHANGELOG.md..." -ForegroundColor Yellow

$changelogContent = Get-Content -Path "CHANGELOG.md" -Encoding UTF8
$targetHeader = "## [v$VERSION]"
$startIndex = -1
$endIndex = -1

for ($i = 0; $i -lt $changelogContent.Count; $i++) {
    if ($changelogContent[$i].StartsWith($targetHeader) -and $startIndex -eq -1) {
        $startIndex = $i + 1
    } elseif ($startIndex -gt -1 -and $changelogContent[$i] -match "^## \[") {
        $endIndex = $i
        break
    }
}

if ($startIndex -eq -1) {
    Write-Host ""
    Write-Host "  ERROR: Version [$TAG] section not found in CHANGELOG.md." -ForegroundColor Red
    Write-Host "  Make sure CHANGELOG.md contains a section starting with:" -ForegroundColor Yellow
    Write-Host "    ## [v$VERSION] - YYYY-MM-DD" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

if ($endIndex -eq -1) {
    $releaseNotes = $changelogContent[$startIndex..($changelogContent.Count - 1)] -join "`n"
} else {
    $releaseNotes = $changelogContent[$startIndex..($endIndex - 1)] -join "`n"
}

$releaseNotes = $releaseNotes.Trim()
$tempNotesFile = "_release_notes.tmp"
Set-Content -Path $tempNotesFile -Value $releaseNotes -Encoding UTF8

Write-Host "  [OK] Release notes extracted for $TAG" -ForegroundColor Green
Write-Host ""

# ── 4. Build the Electron app ──────────────────────────────────────────────────
Write-Host "[4/5] Building Electron application..." -ForegroundColor Yellow
Write-Host "  Running: npm run electron:build" -ForegroundColor White
Write-Host "  This may take 2-5 minutes..." -ForegroundColor DarkGray
Write-Host ""

npm run electron:build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ERROR: electron:build failed. Check output above for details." -ForegroundColor Red
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  [OK] Build completed." -ForegroundColor Green
Write-Host ""

# ── 5. Find the built .exe installer ──────────────────────────────────────────
Write-Host "[5/5] Locating installer and publishing GitHub Release..." -ForegroundColor Yellow

# electron-builder names files like: "BinThere Setup 2.13.0.exe"
$exeFiles = Get-ChildItem -Path "dist" -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*$VERSION*" -and $_.Name -notlike "*blockmap*" }

if (-not $exeFiles) {
    # Fallback: any Setup exe in dist
    $exeFiles = Get-ChildItem -Path "dist" -Recurse -Filter "*Setup*.exe" -ErrorAction SilentlyContinue
}

if (-not $exeFiles) {
    Write-Host ""
    Write-Host "  ERROR: Could not find a .exe installer for version $VERSION in the dist/ folder." -ForegroundColor Red
    Write-Host "  Check that electron-builder completed successfully." -ForegroundColor Yellow
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}

$exePath = $exeFiles[0].FullName
Write-Host "  Installer : $exePath" -ForegroundColor White
Write-Host "  Tag       : $TAG" -ForegroundColor White
Write-Host "  Repo      : Yash19815/BinThere-Dashboard" -ForegroundColor White
Write-Host ""
Write-Host "  Creating GitHub Release and uploading installer..." -ForegroundColor White
Write-Host ""

gh release create $TAG `
    $exePath `
    --repo "Yash19815/BinThere-Dashboard" `
    --title "BinThere $TAG" `
    --notes-file $tempNotesFile `
    --latest

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ERROR: GitHub release creation failed." -ForegroundColor Red
    Write-Host "  Common causes:" -ForegroundColor Yellow
    Write-Host "    - Tag $TAG already exists on GitHub (delete it first)" -ForegroundColor Yellow
    Write-Host "    - gh CLI not authenticated (run: gh auth login)" -ForegroundColor Yellow
    Write-Host "    - No internet connection" -ForegroundColor Yellow
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}

# Cleanup
if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }

Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "   SUCCESS!" -ForegroundColor Green
Write-Host "   Release $TAG published to GitHub." -ForegroundColor Green
Write-Host "   https://github.com/Yash19815/BinThere-Dashboard/releases/tag/$TAG" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

Start-Process "https://github.com/Yash19815/BinThere-Dashboard/releases/tag/$TAG"

Read-Host "Press Enter to close"
