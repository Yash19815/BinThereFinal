# Test script — simulates dual-sensor readings for Dustbin #001
# sensor1 → Dry Waste compartment, sensor2 → Wet Waste compartment

$baseUrl = "http://localhost:3001/api/sensor-data"

Write-Host "Starting dual-sensor simulation for Dustbin #001..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

while ($true) {
    $sensor1 = [math]::Round((Get-Random -Minimum 5 -Maximum 50) + (Get-Random) * 0.99, 2)
    $sensor2 = [math]::Round((Get-Random -Minimum 5 -Maximum 50) + (Get-Random) * 0.99, 2)

    $body = @{ sensor1 = $sensor1; sensor2 = $sensor2 } | ConvertTo-Json

    try {
        $response  = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json"
        $ts        = Get-Date -Format "HH:mm:ss"
        $dryFill   = $response.data.dry.fill_level_percent
        $wetFill   = $response.data.wet.fill_level_percent
        Write-Host "[$ts] Dry: ${sensor1} cm ($dryFill%)  |  Wet: ${sensor2} cm ($wetFill%)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
}
