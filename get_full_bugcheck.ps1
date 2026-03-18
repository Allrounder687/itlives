$events = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1001} -ErrorAction SilentlyContinue
foreach ($e in $events) {
    if ($e.Message -like "*bugcheck*" -or $e.Message -like "*0x00000139*") {
        Write-Host "--- BUGCHECK SYSTEM EVENT ---" -ForegroundColor Cyan
        $e.Message
        Write-Host "-----------------------------"
    }
}

$werEvents = Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1001} -ErrorAction SilentlyContinue
foreach ($e in $werEvents) {
    if ($e.Message -like "*0x139*" -or $e.Message -like "*Bugcheck*") {
        Write-Host "--- WER APPLICATION EVENT ---" -ForegroundColor Cyan
        $e.Message
        Write-Host "-----------------------------"
    }
}
