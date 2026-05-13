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

$REPO = "Yash19815/BinThere-Dashboard"

# ── [1/6] Check prerequisites ─────────────────────────────────────────────────
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

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

# ── [2/6] Read version from root package.json ─────────────────────────────────
Write-Host "[2/6] Reading version from package.json..." -ForegroundColor Yellow

$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$VERSION = $packageJson.version

if (-not $VERSION) {
    Write-Host "  ERROR: Could not read version from package.json." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$TAG      = "v$VERSION"
$EXE_NAME = "BinThere-Setup-$VERSION.exe"

Write-Host "  Version : $VERSION" -ForegroundColor White
Write-Host "  Tag     : $TAG" -ForegroundColor White
Write-Host "  EXE     : $EXE_NAME" -ForegroundColor White
Write-Host ""

# ── Duplicate version guard: check if .exe already exists on GitHub ────────────
Write-Host "  Checking if $TAG already exists on GitHub..." -ForegroundColor DarkGray

$releaseExists = $false
$assetExists   = $false

try {
    $existingRelease = gh release view $TAG --repo $REPO --json assets 2>&1
    if ($LASTEXITCODE -eq 0) {
        $releaseExists = $true
        $releaseJson   = $existingRelease | ConvertFrom-Json
        $assetExists   = ($releaseJson.assets | Where-Object { $_.name -eq $EXE_NAME }).Count -gt 0
    }
} catch { }

if ($releaseExists -and $assetExists) {
    Write-Host ""
    Write-Host "  ⚠  Release $TAG already exists on GitHub AND already has an .exe asset ($EXE_NAME)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Options:" -ForegroundColor White
    Write-Host "    [1] Enter a new version number and continue" -ForegroundColor White
    Write-Host "    [2] Overwrite — delete the existing asset and re-upload" -ForegroundColor White
    Write-Host "    [3] Abort" -ForegroundColor White
    Write-Host ""

    $choice = Read-Host "  Enter choice (1/2/3)"

    switch ($choice.Trim()) {
        "1" {
            $newVersion = Read-Host "  Enter new version (e.g. 2.14.0)"
            $newVersion = $newVersion.Trim()
            if (-not ($newVersion -match "^\d+\.\d+\.\d+$")) {
                Write-Host "  ERROR: Invalid version format. Use MAJOR.MINOR.PATCH (e.g. 2.14.0)" -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
            # Patch package.json version in-place using node (avoids regex/escape issues)
            node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$newVersion';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n','utf8');"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ERROR: Failed to update version in package.json." -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
            $VERSION  = $newVersion
            $TAG      = "v$VERSION"
            $EXE_NAME = "BinThere-Setup-$VERSION.exe"
            Write-Host "  [OK] Version updated to $VERSION in package.json." -ForegroundColor Green
            Write-Host "  NOTE: Remember to add a matching ## [v$VERSION] section to CHANGELOG.md" -ForegroundColor Yellow
            Write-Host ""
        }
        "2" {
            Write-Host "  [INFO] Will overwrite existing asset on upload (--clobber)." -ForegroundColor DarkGray
            Write-Host ""
        }
        default {
            Write-Host "  Aborted." -ForegroundColor Red
            exit 0
        }
    }
} elseif ($releaseExists) {
    Write-Host "  [INFO] Release $TAG exists but has no matching .exe asset — will upload fresh." -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "  [OK] No existing release for $TAG — will create fresh." -ForegroundColor DarkGray
    Write-Host ""
}

# ── [3/6] Parse release notes from CHANGELOG.md ───────────────────────────────
Write-Host "[3/6] Extracting release notes from CHANGELOG.md..." -ForegroundColor Yellow

$changelogContent = Get-Content -Path "CHANGELOG.md" -Encoding UTF8
$targetHeader     = "## [v$VERSION]"
$startIndex       = -1
$endIndex         = -1

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

$releaseNotes = if ($endIndex -eq -1) {
    $changelogContent[$startIndex..($changelogContent.Count - 1)] -join "`n"
} else {
    $changelogContent[$startIndex..($endIndex - 1)] -join "`n"
}

$releaseNotes  = $releaseNotes.Trim()
$tempNotesFile = "_release_notes.tmp"
Set-Content -Path $tempNotesFile -Value $releaseNotes -Encoding UTF8

Write-Host "  [OK] Release notes extracted for $TAG" -ForegroundColor Green
Write-Host ""

# ── [4/6] Clean old build artefacts ───────────────────────────────────────────
Write-Host "[4/6] Cleaning old build directories..." -ForegroundColor Yellow

if (Test-Path "dist-electron") { Remove-Item -Recurse -Force "dist-electron" }
if (Test-Path "client\dist")   { Remove-Item -Recurse -Force "client\dist" }

Write-Host "  [OK] dist-electron/ and client/dist/ removed." -ForegroundColor Green
Write-Host ""

# ── [5/6] Build: frontend → rebuild native modules → electron-builder ──────────
Write-Host "[5/6] Building Electron application..." -ForegroundColor Yellow
Write-Host ""

# 5a. Vite frontend build
Write-Host "  [5a] Building React Vite frontend..." -ForegroundColor White
npm run build --prefix client
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Frontend build failed." -ForegroundColor Red
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Frontend built." -ForegroundColor Green
Write-Host ""

# 5b. Rebuild better-sqlite3 for Electron's Node ABI
Write-Host "  [5b] Rebuilding native modules for Electron (better-sqlite3)..." -ForegroundColor White
npm run rebuild
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: electron-rebuild failed." -ForegroundColor Red
    Write-Host "         Run 'npm install' from the project root and retry." -ForegroundColor Yellow
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Native modules rebuilt." -ForegroundColor Green
Write-Host ""

# 5c. Package with electron-builder
Write-Host "  [5c] Packaging with electron-builder (this may take 2-5 minutes)..." -ForegroundColor White
npx electron-builder --win --x64
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: electron-builder failed. Check output above." -ForegroundColor Red
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  [OK] Build completed." -ForegroundColor Green
Write-Host ""

# ── [6/6] Locate installer, rename, publish GitHub Release ────────────────────
Write-Host "[6/6] Locating installer and publishing GitHub Release..." -ForegroundColor Yellow

# Find the .exe — prefer *Setup*.exe, fallback to any .exe in dist-electron
$exeFiles = Get-ChildItem -Path "dist-electron" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue
if (-not $exeFiles) {
    $exeFiles = Get-ChildItem -Path "dist-electron" -Filter "*.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "*.blockmap" }
}

if (-not $exeFiles) {
    Write-Host ""
    Write-Host "  ERROR: No .exe installer found in dist-electron/ after build." -ForegroundColor Red
    if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
    Read-Host "Press Enter to exit"
    exit 1
}

$builtExe  = $exeFiles[0]
$exePath   = $builtExe.FullName
$finalPath = Join-Path (Resolve-Path "dist-electron") $EXE_NAME

# Rename to canonical versioned name if needed
if ($builtExe.Name -ne $EXE_NAME) {
    Rename-Item -Path $exePath -NewName $EXE_NAME
    Write-Host "  [OK] Renamed '$($builtExe.Name)' -> '$EXE_NAME'" -ForegroundColor Green
    $exePath = $finalPath
}

Write-Host "  Installer : $exePath" -ForegroundColor White
Write-Host "  Tag       : $TAG" -ForegroundColor White
Write-Host "  Repo      : $REPO" -ForegroundColor White
Write-Host ""

# Create or upload to release
if ($releaseExists) {
    Write-Host "  Uploading asset to existing release $TAG..." -ForegroundColor White
    gh release upload $TAG $exePath --repo $REPO --clobber
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARN] --clobber failed. Trying delete + re-upload..." -ForegroundColor Yellow
        gh release delete-asset $TAG $EXE_NAME --repo $REPO -y 2>&1 | Out-Null
        gh release upload $TAG $exePath --repo $REPO
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Upload failed." -ForegroundColor Red
            if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
} else {
    Write-Host "  Creating release $TAG and uploading installer..." -ForegroundColor White
    gh release create $TAG $exePath `
        --repo $REPO `
        --title "BinThere $TAG" `
        --notes-file $tempNotesFile `
        --latest
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  ERROR: GitHub release creation failed." -ForegroundColor Red
        Write-Host "  Common causes:" -ForegroundColor Yellow
        Write-Host "    - gh CLI not authenticated (run: gh auth login)" -ForegroundColor Yellow
        Write-Host "    - No internet connection" -ForegroundColor Yellow
        if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Cleanup temp file
if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }

Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "   SUCCESS!" -ForegroundColor Green
Write-Host "   Release $TAG published to GitHub." -ForegroundColor Green
Write-Host "   Installer saved locally: dist-electron\$EXE_NAME" -ForegroundColor White
Write-Host "   https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

Start-Process "https://github.com/$REPO/releases/tag/$TAG"

Read-Host "Press Enter to close"