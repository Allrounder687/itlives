$StartTime = [DateTime]"3/18/2026 11:40:00 PM"
$EndTime = [DateTime]"3/18/2026 11:47:00 PM"

Write-Host "--- ALL SYSTEM LOGS AROUND CRASH ---" -ForegroundColor Cyan
try {
    $events = Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$StartTime; EndTime=$EndTime} -ErrorAction SilentlyContinue
    if ($events) {
        foreach ($e in $events) {
            [PSCustomObject]@{
                TimeCreated  = $e.TimeCreated
                ProviderName = $e.ProviderName
                Id           = $e.Id
                Level        = $e.LevelDisplayName
                Message      = $e.Message
            } | Format-List
        }
    } else {
        Write-Host "No events found in System log for this timeframe."
    }
} catch {
    Write-Host "Error: $_"
}
