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
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@ -ErrorAction SilentlyContinue | Out-Null

$LogFile = "c:\Users\allro\.itlives\apps\itlives\windows_log_tree.txt"
"Starting Complete Desktop Window Tree Inspection..." | Out-File $LogFile

[Win32]::EnumWindows({
    param($hwnd, $lParam)
    $sb = New-Object System.Text.StringBuilder 256
    [Win32]::GetClassName($hwnd, $sb, 256) | Out-Null
    $className = $sb.ToString()

    if ($className -eq "WorkerW" -or $className -eq "Progman") {
        $found_pid = 0
        [Win32]::GetWindowThreadProcessId($hwnd, [ref]$found_pid) | Out-Null
        
        $shell = [Win32]::FindWindowEx($hwnd, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
        
        $prev = [Win32]::GetWindow($hwnd, 3) # GW_HWNDPREV
        $prevClass = ""
        if ($prev -ne [IntPtr]::Zero) {
            $nsb = New-Object System.Text.StringBuilder 256
            [Win32]::GetClassName($prev, $nsb, 256) | Out-Null
            $prevClass = $nsb.ToString()
        }

        $next = [Win32]::GetWindow($hwnd, 2) # GW_HWNDNEXT
        $nextClass = ""
        if ($next -ne [IntPtr]::Zero) {
            $nsb = New-Object System.Text.StringBuilder 256
            [Win32]::GetClassName($next, $nsb, 256) | Out-Null
            $nextClass = $nsb.ToString()
        }

        # Add line by line to prevent truncation
        "----------------------------------------" | Out-File $LogFile -Append
        "HWND: $hwnd" | Out-File $LogFile -Append
        "Class: $className" | Out-File $LogFile -Append
        "PID: $found_pid" | Out-File $LogFile -Append
        "HasShell: $($shell -ne [IntPtr]::Zero)" | Out-File $LogFile -Append
        "PrevHWND: $prev | PrevClass: $prevClass" | Out-File $LogFile -Append
        "NextHWND: $next | NextClass: $nextClass" | Out-File $LogFile -Append
    }
    return $true
}, [IntPtr]::Zero)

"Done!" | Out-File $LogFile -Append
Get-Content $LogFile
