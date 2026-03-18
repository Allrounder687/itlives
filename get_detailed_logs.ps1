$StartTime = [DateTime]"3/18/2026 11:40:00 PM"
$EndTime = [DateTime]"3/18/2026 11:50:00 PM"

Write-Host "--- SYSTEM LOGS ---" -ForegroundColor Cyan
try {
    $systemEvents = Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$StartTime; EndTime=$EndTime} -ErrorAction SilentlyContinue | 
                    Where-Object { $_.LevelDisplayName -eq 'Error' -or $_.LevelDisplayName -eq 'Critical' }
    if ($systemEvents) {
        foreach ($e in $systemEvents) {
            [PSCustomObject]@{
                TimeCreated      = $e.TimeCreated
                Id               = $e.Id
                ProviderName     = $e.ProviderName
                LevelDisplayName = $e.LevelDisplayName
                Message          = $e.Message
            } | Format-List
        }
    } else {
        Write-Host "No Critical/Error events found in System log for this timeframe."
    }
} catch {
    Write-Host "Error querying System log: $_"
}

Write-Host "--- APPLICATION LOGS ---" -ForegroundColor Cyan
try {
    $appEvents = Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$StartTime; EndTime=$EndTime} -ErrorAction SilentlyContinue | 
                 Where-Object { $_.LevelDisplayName -eq 'Error' -or $_.LevelDisplayName -eq 'Critical' }
    if ($appEvents) {
        foreach ($e in $appEvents) {
            [PSCustomObject]@{
                TimeCreated      = $e.TimeCreated
                Id               = $e.Id
                ProviderName     = $e.ProviderName
                LevelDisplayName = $e.LevelDisplayName
                Message          = $e.Message
            } | Format-List
        }
    } else {
        Write-Host "No Critical/Error events found in Application log for this timeframe."
    }
} catch {
    Write-Host "Error querying Application log: $_"
}
