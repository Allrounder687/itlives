$events = Get-WinEvent -LogName System -MaxEvents 50 | Where-Object { $_.LevelDisplayName -eq 'Error' -or $_.LevelDisplayName -eq 'Critical' }
foreach ($e in $events) {
    [PSCustomObject]@{
        TimeCreated      = $e.TimeCreated
        Id               = $e.Id
        LevelDisplayName = $e.LevelDisplayName
        Message          = $e.Message
    } | Format-List
}
