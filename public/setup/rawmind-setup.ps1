#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Model = "maanis/rawmind"
$Site  = "https://rawmind.maanis.dev" # <-- replace with your actual domain

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    ERROR: $msg" -ForegroundColor Red }

Write-Host "=====================================" -ForegroundColor Magenta
Write-Host "  RawMind setup for $Site" -ForegroundColor Magenta
Write-Host "=====================================" -ForegroundColor Magenta

# ---------- 1. Ollama installed? ----------
Write-Step "Checking for Ollama"
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
    Write-Warn "Ollama not found."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Step "Installing Ollama via winget (a Windows install prompt may appear)"
        winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
        Start-Sleep -Seconds 5
    } else {
        Write-Warn "winget isn't available on this PC. Opening the manual download page instead."
        Start-Process "https://ollama.com/download"
        Write-Host "`nInstall Ollama, then run this script again." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    # refresh PATH for this session after install
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
    if (-not $ollamaCmd) {
        Write-Err "Ollama installed but not found on PATH yet. Close this window, reopen a new terminal, and run the script again."
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Ok "Ollama is installed"

# ---------- 2. Fully stop Ollama (tray app auto-restarts a plain instance, stealing the port) ----------
Write-Step "Stopping any running Ollama processes"
Get-Process ollama, "ollama app" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$portBusy = (Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue)
if ($portBusy) {
    Write-Warn "Port 11434 still busy, force-killing owning process"
    $portBusy | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}
Write-Ok "Port 11434 is free"

# ---------- 3. Set env vars persistently (setx) AND for this session (so it applies immediately) ----------
Write-Step "Configuring Ollama to accept connections from $Site"
setx OLLAMA_ORIGINS "*" | Out-Null
setx OLLAMA_HOST "0.0.0.0:11434" | Out-Null
$env:OLLAMA_ORIGINS = "*"
$env:OLLAMA_HOST = "0.0.0.0:11434"
Write-Ok "OLLAMA_ORIGINS and OLLAMA_HOST set (persisted for future logins too)"

# ---------- 4. Start Ollama server in the background ----------
Write-Step "Starting Ollama server"
Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 3

$serverUp = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $serverUp = $true
        break
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $serverUp) {
    Write-Err "Ollama server didn't come up on localhost:11434. Try running 'ollama serve' manually in a new terminal to see the error."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "Ollama server is running"

# ---------- 5. Pull the model ----------
Write-Step "Pulling model: $Model (first time may take a while)"
ollama pull $Model
Write-Ok "Model ready"

# ---------- 6. cloudflared installed? ----------
Write-Step "Checking for cloudflared"
$cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cfCmd) {
    Write-Warn "cloudflared not found."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Step "Installing cloudflared via winget"
        winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    }
    if (-not $cfCmd) {
        Write-Err "Could not install cloudflared automatically. Install it manually from https://github.com/cloudflare/cloudflared/releases, then run this script again."
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Write-Ok "cloudflared is installed"

# ---------- 7. Start the tunnel and capture its URL ----------
Write-Step "Starting Cloudflare tunnel"
$logFile = Join-Path $env:TEMP "rawmind-tunnel.log"
if (Test-Path $logFile) { Remove-Item $logFile -Force }
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://localhost:11434" -WindowStyle Hidden -RedirectStandardError $logFile

$tunnelUrl = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $match = Select-String -Path $logFile -Pattern "https://[a-zA-Z0-9\-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue
        if ($match) {
            $tunnelUrl = $match.Matches[0].Value
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Err "Couldn't read the tunnel URL yet. Open $logFile to check cloudflared's output, or run manually:`n    cloudflared tunnel --url http://localhost:11434"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "Tunnel URL: $tunnelUrl"

# ---------- 8. Verify the tunnel actually serves Ollama ----------
Write-Step "Verifying the tunnel"
$verified = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "$tunnelUrl/api/tags" -UseBasicParsing -TimeoutSec 5
        if ($resp.StatusCode -eq 200) { $verified = $true; break }
    } catch { Start-Sleep -Seconds 2 }
}

if ($verified) {
    Write-Ok "Tunnel is working"
} else {
    Write-Err "Tunnel didn't respond with 200. Common causes: OLLAMA_ORIGINS/OLLAMA_HOST not picked up yet (try rerunning this script), or the tunnel needs a few more seconds — try the curl command below again shortly."
}

Set-Clipboard -Value $tunnelUrl
Write-Host "`n=====================================" -ForegroundColor Magenta
Write-Host "  Your RawMind connection URL:" -ForegroundColor Magenta
Write-Host "  $tunnelUrl" -ForegroundColor White
Write-Host "  (copied to clipboard)" -ForegroundColor DarkGray
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host "`nOn your phone: open $Site/rawmind/settings, switch to 'Different device',"
Write-Host "paste this URL, and hit Save. Keep this window open while you use RawMind —"
Write-Host "closing it stops both the server and the tunnel.`n"

Read-Host "Press Enter to close (this will stop the tunnel and server)"