param (
    [string]$VideoPath = "https://motionbgs.com/media/1194/vegeta-ultra-ego.3840x2160.mp4",
    [int]$ScalePercent = 100,
    [int]$VolumePercent = 0,
    [string]$VideoFilter = "none",
    [string]$StartPaused = "false",
    [Int64]$WindowHandle = 0
)

Write-Host "Cleaning up previous wallpaper engine streams..." -ForegroundColor Yellow
$AppRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $AppRoot "runtime"
$LogDir = Join-Path $RuntimeDir "logs"
New-Item -ItemType Directory -Force $LogDir | Out-Null
$PidFile = Join-Path $RuntimeDir "mpv.pid"

if (Test-Path $PidFile) {
    $pids = Get-Content $PidFile -ErrorAction SilentlyContinue
    foreach ($p in $pids) {
        if ($p -match '^\d+$') {
            Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
        }
    }
}
Clear-Content $PidFile -ErrorAction SilentlyContinue | Out-Null

Write-Host "--- Multi-Monitor Desktop Wallpaper ---" -ForegroundColor Cyan

Add-Type -AssemblyName System.Windows.Forms
$Signature = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
}
"@
Add-Type -TypeDefinition $Signature -ErrorAction SilentlyContinue | Out-Null

$virtual = [System.Windows.Forms.SystemInformation]::VirtualScreen
if ($WindowHandle -ne 0) {
    Write-Host "Resizing target canvas frame to Virtual Screen dimensions: $($virtual.Width)x$($virtual.Height)..." -ForegroundColor Yellow
    [Win32]::SetWindowPos($WindowHandle, [IntPtr]::Zero, $virtual.X, $virtual.Y, $virtual.Width, $virtual.Height, 0x0040 -bor 0x0010 -bor 0x0004)
}

$screens = [System.Windows.Forms.Screen]::AllScreens
$mpv = "C:\Program Files\MPV Player\mpv.exe"
if (-not (Test-Path $mpv)) {
    Write-Host "mpv.exe not found at $mpv" -ForegroundColor Red
    exit
}

for ($idx = 0; $idx -lt $screens.Count; $idx++) {
    $s = $screens[$idx]
    $width = $s.Bounds.Width
    $height = $s.Bounds.Height
    $X = $s.Bounds.X
    $Y = $s.Bounds.Y

    $ScalePercent = [Math]::Min([Math]::Max($ScalePercent, 25), 200)
    $VolumePercent = [Math]::Min([Math]::Max($VolumePercent, 0), 100)
    $StartPaused = $StartPaused -eq "true"
    $targetWidth = [Math]::Max(2, [int]([Math]::Round(($width * $ScalePercent / 100.0) / 2) * 2))
    $targetHeight = [Math]::Max(2, [int]([Math]::Round(($height * $ScalePercent / 100.0) / 2) * 2))
    $mute = if ($VolumePercent -le 0 -or $idx -gt 0) { "yes" } else { "no" } # Mute others
    $pauseArg = if ($StartPaused) { "yes" } else { "no" }

    switch ($VideoFilter) {
        "grayscale" { $filterChain = "scale=${targetWidth}:${targetHeight},format=gray" }
        "vivid" { $filterChain = "scale=${targetWidth}:${targetHeight},eq=contrast=18:brightness=0:saturation=35:gamma=6" }
        "soft" { $filterChain = "scale=${targetWidth}:${targetHeight},eq=contrast=-8:brightness=4:saturation=-12:gamma=4" }
        "noir" { $filterChain = "scale=${targetWidth}:${targetHeight},format=gray,eq=contrast=22:brightness=-4" }
        "retro" { $filterChain = "scale=${targetWidth}:${targetHeight},hue=h=8:s=0.92,eq=contrast=10:brightness=3:saturation=18" }
        default { $filterChain = "scale=${targetWidth}:${targetHeight}" }
    }

    $widArg = if ($WindowHandle -eq 0) { "--wid=0" } else { "" }
    $ipc_server = "\\.\pipe\openclaw-mpv-$idx"

    $args = "$widArg --input-ipc-server=$ipc_server --loop=inf --mute=$mute --volume=${VolumePercent} --pause=$pauseArg --no-osc --no-osd-bar --no-border --no-config --input-default-bindings=no --input-vo-keyboard=no --show-in-taskbar=no --keepaspect=no --force-window=yes --geometry=${width}x${height}+${X}+${Y} --ontop=no --vo=gpu --hwdec=auto-safe --panscan=1.0 --vf=$filterChain --demuxer-max-bytes=128M --demuxer-max-back-bytes=32M --cache=no --vd-lavc-fast --vd-lavc-skiploopfilter=all --terminal=no `"$VideoPath`""

    $stdoutLog = Join-Path $LogDir "mpv_out_$idx.log"
    $stderrLog = Join-Path $LogDir "mpv_err_$idx.log"
    
    $mpvProc = Start-Process -FilePath $mpv -ArgumentList $args -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
    Add-Content -Path $PidFile -Value $mpvProc.Id

    if ($WindowHandle -ne 0) {
        $shell_hwnd = [Win32]::FindWindowEx([IntPtr]$WindowHandle, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
        Write-Host "Shell View Handle inside parent: $shell_hwnd" -ForegroundColor Yellow

        for ($i = 0; $i -lt 10; $i++) {
            $mpvProc.Refresh()
            $mpvHwnd = $mpvProc.MainWindowHandle
            if ($mpvHwnd -ne [IntPtr]::Zero) {
                Write-Host "Reparenting mpv window into target canvas coordinate layer..." -ForegroundColor Yellow
                [Win32]::SetParent($mpvHwnd, [IntPtr]$WindowHandle)

                if ($shell_hwnd -ne [IntPtr]::Zero) {
                    Write-Host "Placing mpv behind desktop icons layer..." -ForegroundColor Green
                    [Win32]::SetWindowPos($mpvHwnd, $shell_hwnd, $X, $Y, $width, $height, 0x0040) # SWP_SHOWWINDOW
                } else {
                    [Win32]::SetWindowPos($mpvHwnd, [IntPtr]::Zero, $X, $Y, $width, $height, 0x0040)
                }
                break
            }
            Start-Sleep -Seconds 1
        }
    }
}

Write-Host "Multi-monitor wallpaper setup done." -ForegroundColor Green
exit
