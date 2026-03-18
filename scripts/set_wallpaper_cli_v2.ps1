
param (
    [string]$VideoPath = "https://motionbgs.com/media/1194/vegeta-ultra-ego.3840x2160.mp4",
    [int]$ScalePercent = 100,
    [int]$VolumePercent = 0,
    [string]$VideoFilter = "none",
    [string]$StartPaused = "false"
)

# Kill the tracked wallpaper mpv process to avoid stacking multiple wallpaper surfaces.
Write-Host "Cleaning up previous wallpaper engine streams..." -ForegroundColor Yellow
$AppRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $AppRoot "runtime"
$LogDir = Join-Path $RuntimeDir "logs"
New-Item -ItemType Directory -Force $LogDir | Out-Null
$PidFile = Join-Path $RuntimeDir "mpv.pid"
if (Test-Path $PidFile) {
    $existingPid = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingPid) {
        Stop-Process -Id ([int]$existingPid) -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "--- Desktop Wallpaper Hook Test (V2) ---" -ForegroundColor Cyan

Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$width = $screen.Width
$height = $screen.Height
$ScalePercent = [Math]::Min([Math]::Max($ScalePercent, 25), 200)
$VolumePercent = [Math]::Min([Math]::Max($VolumePercent, 0), 100)
$StartPaused = $StartPaused -eq "true"
$targetWidth = [Math]::Max(2, [int]([Math]::Round(($width * $ScalePercent / 100.0) / 2) * 2))
$targetHeight = [Math]::Max(2, [int]([Math]::Round(($height * $ScalePercent / 100.0) / 2) * 2))
$mute = if ($VolumePercent -le 0) { "yes" } else { "no" }
$pauseArg = if ($StartPaused) { "yes" } else { "no" }

switch ($VideoFilter) {
    "grayscale" { $filterChain = "scale=${targetWidth}:${targetHeight},format=gray" }
    "vivid" { $filterChain = "scale=${targetWidth}:${targetHeight},eq=contrast=18:brightness=0:saturation=35:gamma=6" }
    "soft" { $filterChain = "scale=${targetWidth}:${targetHeight},eq=contrast=-8:brightness=4:saturation=-12:gamma=4" }
    "noir" { $filterChain = "scale=${targetWidth}:${targetHeight},format=gray,eq=contrast=22:brightness=-4" }
    "retro" { $filterChain = "scale=${targetWidth}:${targetHeight},hue=h=8:s=0.92,eq=contrast=10:brightness=3:saturation=18" }
    default { $filterChain = "scale=${targetWidth}:${targetHeight}" }
}
Write-Host "Primary Screen Dimensions: ${width}x${height}" -ForegroundColor Yellow
Write-Host "Wallpaper render scale: ${ScalePercent}% (${targetWidth}x${targetHeight})" -ForegroundColor Yellow
Write-Host "Wallpaper volume: ${VolumePercent}% (mute=$mute)" -ForegroundColor Yellow
Write-Host "Wallpaper filter: $VideoFilter" -ForegroundColor Yellow

$mpv = "C:\Program Files\MPV Player\mpv.exe"
if (-not (Test-Path $mpv)) {
    Write-Host "mpv.exe not found at $mpv" -ForegroundColor Red
    exit
}

Write-Host "Using mpv: $mpv" -ForegroundColor Green
Write-Host "Playing: $VideoPath" -ForegroundColor Cyan

# mpv's documented win32 special case is --wid=0, which renders above the desktop
# wallpaper and below desktop icons without us creating or resizing WorkerW windows.
$args = "--wid=0 --input-ipc-server=\\.\pipe\openclaw-mpv --loop=inf --mute=$mute --volume=${VolumePercent} --pause=$pauseArg --no-osc --no-osd-bar --no-border --no-config --input-default-bindings=no --input-vo-keyboard=no --show-in-taskbar=no --keepaspect=no --force-window=yes --geometry=${width}x${height}+0+0 --ontop=no --vo=gpu --hwdec=auto-safe --panscan=1.0 --vf=$filterChain --demuxer-max-bytes=128M --demuxer-max-back-bytes=32M --cache=no --vd-lavc-fast --vd-lavc-skiploopfilter=all --terminal=no `"$VideoPath`""

Write-Host "Command: mpv $args" -ForegroundColor DarkGray

$stdoutLog = Join-Path $LogDir "mpv_out.log"
$stderrLog = Join-Path $LogDir "mpv_err.log"
$mpvProc = Start-Process -FilePath $mpv -ArgumentList $args -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
$mpvProc.Id | Set-Content -Path $PidFile -Encoding ascii

Write-Host "Waiting for mpv to attach to the desktop layer (Up to 10s)..." -ForegroundColor Yellow

$mpvHwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 10; $i++) {
    $mpvProc.Refresh()
    $mpvHwnd = $mpvProc.MainWindowHandle
    if ($mpvHwnd -ne [IntPtr]::Zero) {
        Write-Host "mpv window connected in $i seconds!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 1
    if ($mpvProc.HasExited) {
        break
    }
}

if (-not $mpvProc.HasExited) {
    Write-Host "mpv is running on the desktop layer." -ForegroundColor Green
} else {
    Write-Host "mpv exited before it could attach to the desktop layer." -ForegroundColor Red
}

Write-Host "Check desktop output now." -ForegroundColor DarkGreen
exit
