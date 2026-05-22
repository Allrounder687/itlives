$mpv = "C:\Program Files\MPV Player\mpv.exe"
$args = @(
    "--wid=66086",
    "--input-ipc-server=\\.\pipe\itlives-mpv",
    "--loop=inf",
    "--mute=yes",
    "--volume=0",
    "--pause=no",
    "--no-osc",
    "--no-osd-bar",
    "--no-border",
    "--no-config",
    "--input-default-bindings=no",
    "--input-vo-keyboard=no",
    "--show-in-taskbar=no",
    "--keepaspect=no",
    "--force-window=yes",
    "--geometry=1920x1080+0+0",
    "--ontop=no",
    "--vo=gpu",
    "--hwdec=auto-safe",
    "C:\Users\allro\.itlives\apps\itlives\runtime\wallpapers\redgifs\motionbgs_2967.mp4"
)

$out = "c:\Users\allro\.itlives\apps\itlives\mpv_test_out.log"
$err = "c:\Users\allro\.itlives\apps\itlives\mpv_test_err.log"

Start-Process -FilePath $mpv -ArgumentList $args -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $err -Wait
