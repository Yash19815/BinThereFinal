# Test script to simulate two ESP32 ultrasonic sensors
# Run this script to send random distance readings to the server

$baseUrl = "http://localhost:3001/api/sensor-data"

Write-Host "Starting dual-sensor simulation..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

while ($true) {
    # Generate random distances between 5 and 100 cm
    $sensor1 = [math]::Round((Get-Random -Minimum 5 -Maximum 100) + (Get-Random) * 0.99, 2)
    $sensor2 = [math]::Round((Get-Random -Minimum 5 -Maximum 100) + (Get-Random) * 0.99, 2)
    
    $body = @{ sensor1 = $sensor1; sensor2 = $sensor2 } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json"
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] Sensor1: $sensor1 cm  |  Sensor2: $sensor2 cm  -> $($response.status)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
}
