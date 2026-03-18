Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.IO;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
}
"@ -ErrorAction SilentlyContinue | Out-Null

$LogFile = "c:\Users\allro\.openclaw\apps\openclaw-lwp\windows_log.txt"
"Starting Window Enumeration..." | Out-File $LogFile

[Win32]::EnumWindows({
    param($hwnd, $lParam)
    $sb = New-Object System.Text.StringBuilder 256
    [Win32]::GetClassName($hwnd, $sb, 256) | Out-Null
    $className = $sb.ToString()

    if ($className -eq "WorkerW" -or $className -eq "Progman") {
        $shell = [Win32]::FindWindowEx($hwnd, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
        $next = [Win32]::GetWindow($hwnd, 2) # GW_HWNDNEXT
        $nextClass = ""
        if ($next -ne [IntPtr]::Zero) {
            $nsb = New-Object System.Text.StringBuilder 256
            [Win32]::GetClassName($next, $nsb, 256) | Out-Null
            $nextClass = $nsb.ToString()
        }
        "HWND: $hwnd | Class: $className | HasShell: $($shell -ne [IntPtr]::Zero) | NextHWND: $next | NextClass: $nextClass" | Out-File $LogFile -Append
    }
    return $true
}, [IntPtr]::Zero)

Get-Content $LogFile
