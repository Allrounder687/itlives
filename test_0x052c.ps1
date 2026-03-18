Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@ -ErrorAction SilentlyContinue | Out-Null

$LogFile = "c:\Users\allro\.openclaw\apps\openclaw-lwp\windows_log_0x052C.txt"
"Triggering 0x052C with 0, 0..." | Out-File $LogFile

$progman = [Win32]::FindWindow("Progman", $null)
"Progman Handle: $progman" | Out-File $LogFile -Append

$result = [IntPtr]::Zero
[Win32]::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$result) | Out-Null

Start-Sleep -Seconds 1
"--- POST 0x052C LISTING ---" | Out-File $LogFile -Append

[Win32]::EnumWindows({
    param($hwnd, $lParam)
    $sb = New-Object System.Text.StringBuilder 256
    [Win32]::GetClassName($hwnd, $sb, 256) | Out-Null
    $className = $sb.ToString()

    if ($className -eq "WorkerW") {
        $shell = [Win32]::FindWindowEx($hwnd, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
        "WorkerW HWND: $hwnd | HasShell: $($shell -ne [IntPtr]::Zero)" | Out-File $LogFile -Append
    }
    return $true
}, [IntPtr]::Zero)

Get-Content $LogFile
