param (
    [string]$VideoPath = "https://motionbgs.com/media/1194/vegeta-ultra-ego.3840x2160.mp4",
    [int]$ScalePercent = 100,
    [int]$VolumePercent = 0,
    [string]$VideoFilter = "none",
    [string]$StartPaused = "false",
    [Int64]$WindowHandle = 0,
    [string]$StartTime = "",
    [string]$EndTime = "",
    [string]$MpvPath = "",
    [double]$Speed = 1.0,
    [int]$BlurStrength = 0
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
Add-Content -Path $PidFile -Value $PID

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
$mpv = if ($MpvPath -ne "") { $MpvPath } else { "C:\Program Files\MPV Player\mpv.exe" }
if (-not (Test-Path $mpv)) {
    Write-Host "mpv.exe not found at $mpv. Attempting 'where mpv' fallback..." -ForegroundColor Yellow
    $mpv = where.exe mpv | Select-Object -First 1
    if (-not $mpv -or -not (Test-Path $mpv)) {
        Write-Host "FATAL: mpv.exe not found. Install from: https://mpv.io/" -ForegroundColor Red
        exit
    }
}

for ($idx = 0; $idx -lt $screens.Count; $idx++) {
    $s = $screens[$idx]
    $width = $s.Bounds.Width
    $height = $s.Bounds.Height
    $X = $s.Bounds.X
    $Y = $s.Bounds.Y

    $targetWidth = [Math]::Max(2, [int]([Math]::Round(($width * $ScalePercent / 100.0) / 2) * 2))
    $targetHeight = [Math]::Max(2, [int]([Math]::Round(($height * $ScalePercent / 100.0) / 2) * 2))
    $mute = if ($VolumePercent -le 0 -or $idx -gt 0) { "yes" } else { "no" } # Mute others
    
    switch ($VideoFilter) {
        "grayscale" { $filterChain = "scale=${targetWidth}:${targetHeight},format=gray" }
        "vivid" { $filterChain = "scale=${targetWidth}:${targetHeight},eq=contrast=1.12:brightness=0:saturation=1.35:gamma=1.0" }
        "soft" { $filterChain = "scale=${targetWidth}:${targetHeight},eq=contrast=0.94:brightness=0.04:saturation=0.88:gamma=1.0" }
        "noir" { $filterChain = "scale=${targetWidth}:${targetHeight},format=gray,eq=contrast=1.15:brightness=-0.04" }
        "retro" { $filterChain = "scale=${targetWidth}:${targetHeight},hue=h=8:s=0.92,eq=contrast=1.05:brightness=0.03:saturation=1.18" }
        default { $filterChain = "scale=${targetWidth}:${targetHeight}" }
    }

    if ($BlurStrength -gt 0) {
        $filterChain += ",boxblur=${BlurStrength}:${BlurStrength}"
    }

    $ipc_server = "\\.\pipe\itlives-mpv-$idx"
    $stArg = if ($StartTime -ne "") { "--start=$StartTime" } else { "" }
    $etArg = if ($EndTime -ne "") { "--end=$EndTime" } else { "" }
    $pauseVal = if ($StartPaused -match '^(1|true|yes)$') { "yes" } else { "no" }
    
    # Build Argument list as a single robust string for maximum compatibility
    $mpvArgs = @()
    if ($stArg -ne "") { $mpvArgs += $stArg }
    if ($etArg -ne "") { $mpvArgs += $etArg }
    
    $mpvArgs += @(
        "--input-ipc-server=$ipc_server",
        "--loop=inf",
        "--mute=$mute",
        "--volume=${VolumePercent}",
        "--speed=${Speed}",
        "--pause=$pauseVal",
        "--no-osc",
        "--no-osd-bar",
        "--no-border",
        "--no-config",
        "--input-default-bindings=no",
        "--input-vo-keyboard=no",
        "--show-in-taskbar=no",
        "--keepaspect=no",
        "--force-window=yes",
        "--geometry=${width}x${height}+${X}+${Y}",
        "--ontop=no",
        "--vo=gpu-next",
        "--gpu-api=d3d11",
        "--hwdec=d3d11va",
        "--gpu-context=d3d11",
        "--panscan=1.0",
        "--vf=$filterChain",
        "--demuxer-max-bytes=32M",
        "--demuxer-max-back-bytes=16M",
        "--cache=no",
        "--vd-lavc-fast",
        "--vd-lavc-skiploopfilter=all",
        "--vd-lavc-threads=1",
        "--dither-depth=no",
        "--icc-profile-auto=no",
        "--terminal=no"
    )

    if ($WindowHandle -eq 0) { $mpvArgs += "--wid=0" }

    # Quoting the VideoPath is CRITICAL for spaces (e.g., HIGH 002.mp4)
    $FinalArgString = ($mpvArgs -join ' ') + " `"$VideoPath`""
    
    Write-Host "[Engine] Video Path: $VideoPath" -ForegroundColor Cyan
    Write-Host "[Engine] MPV Executable: $mpv" -ForegroundColor Cyan
    Write-Host "[Engine] Constructed Args: $FinalArgString" -ForegroundColor Gray
    
    $stdoutLog = Join-Path $LogDir "mpv_out_$idx.log"
    $stderrLog = Join-Path $LogDir "mpv_err_$idx.log"
    
    try {
        $mpvProc = Start-Process -FilePath $mpv -ArgumentList $FinalArgString -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru -NoNewWindow
        if ($null -eq $mpvProc) {
            Write-Host "CRITICAL: Start-Process returned null!" -ForegroundColor Red
        } else {
            Add-Content -Path $PidFile -Value $mpvProc.Id
        }
    } catch {
        Write-Host "CRITICAL ERROR: Failed to launch mpv: $_" -ForegroundColor Red
    }

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
