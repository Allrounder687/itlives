Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
    
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@ -ErrorAction SilentlyContinue | Out-Null

# 1. Look for WorkerW (simulating get_desktop_workerw)
# This is a test script to find the target window and reparent mpv
# (We will use the passed $WindowHandle from Rust in final implementation)
# For the test, lets find it directly from the log handle if valid (it was 66086)
$WindowHandle = [IntPtr]66086

# Verify it exists or fallback
# Since standard find without DLL is verbose, let's just create a borderless window, Wait!
# Actually we can run mpv first, then reparent to see if it draws behind icons.
# Let's get a fresh mpv window up top.

$mpv = "C:\Program Files\MPV Player\mpv.exe"
$args = @(
    # "--wid" IS OMITTED!
    "--loop=inf",
    "--no-osc",
    "--no-osd-bar",
    "--no-border",
    "--no-config",
    "--input-default-bindings=no",
    "--input-vo-keyboard=no",
    "--keepaspect=no",
    "--geometry=1920x1080+0+0",
    "C:\Users\allro\.openclaw\apps\openclaw-lwp\runtime\wallpapers\redgifs\motionbgs_9093.mp4"
)

$mpvProc = Start-Process -FilePath $mpv -ArgumentList $args -PassThru

Write-Host "Waiting for mpv window..."
Start-Sleep -Seconds 3
$mpvProc.Refresh()
$mpvHwnd = $mpvProc.MainWindowHandle

if ($mpvHwnd -ne [IntPtr]::Zero) {
    Write-Host "Found mpv handle: $mpvHwnd. Reparenting to $WindowHandle..."
    [Win32]::SetParent($mpvHwnd, $WindowHandle)
    # Resize mpv window inside WorkerW
    [Win32]::SetWindowPos($mpvHwnd, [IntPtr]::Zero, 0, 0, 1920, 1080, 0x0040) # SWP_SHOWWINDOW
    Write-Host "Done!"
} else {
    Write-Host "Failed to get mpv MainWindowHandle!"
}
