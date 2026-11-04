# =============================================================================
# AIoTLibTQB - Public Web Access Launcher via Cloudflare Tunnel (Phuong an 2)
# =============================================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   AIoTLibTQB - PHAT WEB RA INTERNET QUA CLOUDFLARE   " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path "$scriptDir\..\.."
Set-Location $projectRoot

# 1. Kiem tra cac dich vu local
Write-Host "`n[1/3] Kiem tra cac dich vu he thong..." -ForegroundColor White
$port3000 = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
$port8080 = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue

if (-not $port3000) {
    Write-Host "  [CANH BAO] Frontend (port 3000) chua bat!" -ForegroundColor Yellow
    Write-Host "  -> Hay chay: cd frontend; npm run dev" -ForegroundColor Gray
} else {
    Write-Host "  [OK] Frontend dang lang nghe tren port 3000" -ForegroundColor Green
}

if (-not $port8080) {
    Write-Host "  [CANH BAO] Backend (port 8080) chua bat!" -ForegroundColor Yellow
    Write-Host "  -> Hay bat Docker Desktop va chay: docker compose up -d" -ForegroundColor Gray
} else {
    Write-Host "  [OK] Backend dang lang nghe tren port 8080" -ForegroundColor Green
}

# 2. Khoi dong Gateway cuc bo tren port 4000
Write-Host "`n[2/3] Khoi dong AIoT Gateway (Port 4000)..." -ForegroundColor White
$existingGateway = Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue
if (-not $existingGateway) {
    $gatewayProc = Start-Process node -ArgumentList "$scriptDir\gateway.js" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "  [OK] Gateway da khoi dong thanh cong (PID: $($gatewayProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  [OK] Gateway da dang chay san tren port 4000" -ForegroundColor Green
}

# 3. Khoi dong Cloudflare Tunnel
Write-Host "`n[3/3] Dang tao duong ham HTTPS bao mat qua Cloudflare..." -ForegroundColor White
Write-Host "  -> Duong link truy cap tu xa se xuat hien ben duoi (dang https://*.trycloudflare.com)" -ForegroundColor Cyan
Write-Host "  -> Nhan Ctrl+C de dung duong ham bat cu luc nao.`n" -ForegroundColor Gray

& "$scriptDir\cloudflared.exe" tunnel --url http://127.0.0.1:4000
