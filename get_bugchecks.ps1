$events = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1001} -ErrorAction SilentlyContinue
if ($events) {
    foreach ($e in $events) {
        [PSCustomObject]@{
            TimeCreated = $e.TimeCreated
            Message     = $e.Message
        } | Format-List
    }
} else {
    Write-Host "No BugCheck event with ID 1001 found in System log."
}
