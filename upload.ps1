# ─────────────────────────────────────────────────────────────────────────────
# BinThere GitHub Upload Script (PowerShell)
# Uploads the already-built dist-electron/*.exe to a GitHub Release.
# Requires: gh CLI (https://cli.github.com/) logged in via `gh auth login`
# Run build.ps1 first to produce the installer.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "BinThere - GitHub Upload"

Write-Host ""
Write-Host "  ██████╗ ██╗███╗   ██╗████████╗██╗  ██╗███████╗██████╗ ███████╗" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║████╗  ██║╚══██╔══╝██║  ██║██╔════╝██╔══██╗██╔════╝" -ForegroundColor Cyan
Write-Host "  ██████╔╝██║██╔██╗ ██║   ██║   ███████║█████╗  ██████╔╝█████╗  " -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║██║╚██╗██║   ██║   ██╔══██║██╔══╝  ██╔══██╗██╔══╝  " -ForegroundColor Cyan
Write-Host "  ██████╔╝██║██║ ╚████║   ██║   ██║  ██║███████╗██║  ██║███████╗" -ForegroundColor Cyan
Write-Host "  ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  GitHub Release Upload" -ForegroundColor White
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

$REPO = "Yash19815/BinThere-Dashboard"

# ── [1/4] Check prerequisites ─────────────────────────────────────────────────
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  ERROR: GitHub CLI (gh) is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Install it from: https://cli.github.com/" -ForegroundColor Red
    Write-Host ""
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

# ── [2/4] Read version and locate the built .exe ──────────────────────────────
Write-Host "[2/4] Reading version and locating installer..." -ForegroundColor Yellow

$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$VERSION = $packageJson.version

if (-not $VERSION) {
    Write-Host "  ERROR: Could not read version from package.json." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$TAG      = "v$VERSION"
$EXE_NAME = "BinThere-Setup-$VERSION.exe"
$exePath  = Join-Path "dist-electron" $EXE_NAME

# If canonical name not found, fall back to any .exe in dist-electron
if (-not (Test-Path $exePath)) {
    Write-Host "  [INFO] '$EXE_NAME' not found — searching dist-electron for any .exe..." -ForegroundColor DarkGray
    $fallback = Get-ChildItem -Path "dist-electron" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue
    if (-not $fallback) {
        $fallback = Get-ChildItem -Path "dist-electron" -Filter "*.exe" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike "*.blockmap" }
    }

    if (-not $fallback) {
        Write-Host ""
        Write-Host "  ERROR: No .exe found in dist-electron/." -ForegroundColor Red
        Write-Host "  Run build.ps1 first to produce the installer." -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    $exePath = $fallback[0].FullName
    Write-Host "  [INFO] Using: $($fallback[0].Name)" -ForegroundColor DarkGray
}

Write-Host "  Version   : $VERSION" -ForegroundColor White
Write-Host "  Tag       : $TAG" -ForegroundColor White
Write-Host "  Installer : $exePath" -ForegroundColor White
Write-Host "  Repo      : $REPO" -ForegroundColor White
Write-Host ""

# ── [3/4] Parse release notes from CHANGELOG.md ───────────────────────────────
Write-Host "[3/4] Extracting release notes from CHANGELOG.md..." -ForegroundColor Yellow

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

Write-Host "  [OK] Release notes extracted for $TAG." -ForegroundColor Green
Write-Host ""

# ── [4/4] Duplicate guard + create/upload GitHub Release ──────────────────────
Write-Host "[4/4] Publishing to GitHub..." -ForegroundColor Yellow

$releaseExists = $false
$assetExists   = $false

try {
    $existingRelease = gh release view $TAG --repo $REPO --json assets 2>&1
    if ($LASTEXITCODE -eq 0) {
        $releaseExists = $true
        $releaseJson   = $existingRelease | ConvertFrom-Json
        $exeAssets     = $releaseJson.assets | Where-Object { $_.name -like "*.exe" }
        $assetExists   = $exeAssets.Count -gt 0
        if ($assetExists) {
            Write-Host "  [INFO] Found existing .exe assets on $TAG :" -ForegroundColor DarkGray
            $exeAssets | ForEach-Object { Write-Host "         - $($_.name)" -ForegroundColor DarkGray }
        }
    }
} catch { }

if ($releaseExists -and $assetExists) {
    Write-Host ""
    Write-Host "  ⚠  Release $TAG already has a .exe on GitHub." -ForegroundColor Yellow
    Write-Host "     You must bump the version in package.json to create a new release," -ForegroundColor White
    Write-Host "     or use release.ps1 which handles version bumping automatically." -ForegroundColor White
    Write-Host ""

    $overwrite = Read-Host "  Overwrite the existing asset anyway? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "  Aborted. No changes made." -ForegroundColor Red
        if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
        Read-Host "Press Enter to exit"
        exit 0
    }

    Write-Host "  Uploading and overwriting existing asset..." -ForegroundColor White
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

} elseif ($releaseExists) {
    Write-Host "  [INFO] Release $TAG exists but has no .exe — uploading now..." -ForegroundColor DarkGray
    gh release upload $TAG $exePath --repo $REPO
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Upload failed." -ForegroundColor Red
        if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
        Read-Host "Press Enter to exit"
        exit 1
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
        Write-Host "    - The commit for this version is not pushed to GitHub yet" -ForegroundColor Yellow
        if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Cleanup temp file
if (Test-Path $tempNotesFile) { Remove-Item $tempNotesFile -Force }

Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "   UPLOAD COMPLETE" -ForegroundColor Green
Write-Host "   Release $TAG published to GitHub." -ForegroundColor Green
Write-Host "   https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

Start-Process "https://github.com/$REPO/releases/tag/$TAG"

Read-Host "Press Enter to close"
