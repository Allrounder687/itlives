[CmdletBinding()]
param ()

# Add required assemblies for File Dialog
Add-Type -AssemblyName System.Windows.Forms

# Show Open File Dialog
$openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
$openFileDialog.Title = "Select Live Wallpaper Video"
$openFileDialog.Filter = "Video Files (*.mp4;*.webm;*.mkv)|*.mp4;*.webm;*.mkv|All Files (*.*)|*.*"
$openFileDialog.InitialDirectory = [Environment]::GetFolderPath('MyVideos')

$result = $openFileDialog.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $videoPath = $openFileDialog.FileName
    Write-Host "Selected Video: $videoPath" -ForegroundColor Cyan
    
    # Send magic message to Progman to spawn WorkerW
    $Signature = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    public static IntPtr workerW = IntPtr.Zero;
    
    public static bool EnumWindow(IntPtr handle, IntPtr pointer) {
        IntPtr shell = FindWindowEx(handle, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (shell != IntPtr.Zero) {
            workerW = FindWindowEx(IntPtr.Zero, handle, "WorkerW", null);
        }
        return true;
    }
}
"@
    Add-Type -TypeDefinition $Signature -ErrorAction SilentlyContinue

    $progman = [Win32]::FindWindow("Progman", $null)
    $msgResult = [UIntPtr]::Zero
    [Win32]::SendMessageTimeout($progman, 0x052C, [UIntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$msgResult) | Out-Null
    
    Start-Sleep -Milliseconds 500

    [Win32]::EnumWindows([Win32+EnumWindowsProc]::new($null, [ptr]::new($Win32::type.GetMethod("EnumWindow"))), [IntPtr]::Zero) | Out-Null
    
    $workerw = [Win32]::workerW
    if ($workerw -eq [IntPtr]::Zero) {
        Write-Host "WorkerW not found, falling back to Progman" -ForegroundColor Yellow
        $workerw = $progman
    }

    Write-Host "Target Handle: $workerw" -ForegroundColor Green

    # Execute the existing script
    $ScriptPath = Join-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) "scripts\set_wallpaper_cli_v2.ps1"
    
    if (Test-Path $ScriptPath) {
        Write-Host "Running: $ScriptPath"
        # We run it in a hidden window so it stays detached, but actually we can just invoke it here.
        # It's better to launch it as a detached process or just let it run.
        # Since this script is called by Rainmeter, running it inline will block Rainmeter if we use Wait.
        # But set_wallpaper_cli_v2.ps1 uses Start-Process internally and doesn't block! It exits immediately.
        & $ScriptPath -VideoPath $videoPath -WindowHandle $workerw.ToInt64()
    } else {
        [System.Windows.Forms.MessageBox]::Show("Could not find set_wallpaper_cli_v2.ps1 at $ScriptPath", "Error", "OK", "Error")
    }
}
