# Live Wallpaper Setup Notes

## Goal

Make the live wallpaper picker play video as part of the Windows desktop background instead of opening a separate visible window.

## What Was Going Wrong

The earlier setup used a manual Win32 embedding flow:

1. Find `Progman` / `WorkerW`.
2. Start `mpv` as a normal top-level window.
3. Change the `mpv` window style to `WS_CHILD`.
4. Reparent that window into `WorkerW`.

That approach is fragile on modern Windows.

Problems we hit:

- `mpv` sometimes stayed a normal top-level window instead of behaving like a wallpaper surface.
- the chosen `WorkerW` host was not always the right shell surface
- resizing/reparenting shell windows left behind large blank white windows
- broken shell host windows had no taskbar icon, so they looked like ghost windows

In practice, this meant the picker appeared to "set wallpaper" but actually created another desktop-sized window.

## Research Result

The more reliable approach is to stop manually parenting `mpv` into `WorkerW` for the active playback path.

Two references guided the fix:

- `mpv` manual: Windows supports `--wid` and `--show-in-taskbar=no`
- common WorkerW examples: they use the `Progman` / `SHELLDLL_DefView` / `WorkerW` pattern, but that path is still only a shell hack

The key change was using:

```powershell
mpv --wid=0 --show-in-taskbar=no
```

On Windows, this lets `mpv` draw on the desktop layer without the app creating and managing its own fake wallpaper host window.

## Final Active Design

### Active launcher

The active live wallpaper launcher is:

- `scripts/set_wallpaper_cli_v2.ps1`

This script now:

1. Stops existing `mpv` processes.
2. Reads the primary screen size.
3. Starts `mpv` with desktop-layer options instead of Win32 reparenting.

Current important flags:

```powershell
--wid=0
--show-in-taskbar=no
--no-border
--keepaspect=no
--force-window=yes
--input-default-bindings=no
--input-vo-keyboard=no
--terminal=no
```

Why these matter:

- `--wid=0`: puts playback on the desktop layer instead of a normal app window
- `--show-in-taskbar=no`: prevents taskbar / Alt+Tab pollution
- `--no-border`: no standard window chrome
- `--keepaspect=no`: stretch to screen bounds
- `--force-window=yes`: ensure a render surface exists
- `--input-*`: prevent wallpaper playback from acting like an interactive foreground app
- `--terminal=no`: quieter runtime behavior

### Legacy launcher protection

There was still an older script:

- `scripts/set_wallpaper_cli.ps1`

That older version still used the broken `SetParent` / `WorkerW` embedding logic.

To prevent accidental regressions, it was replaced with a simple delegate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\allro\.itlives\apps\itlives\scripts\set_wallpaper_cli_v2.ps1" -VideoPath $VideoPath
```

So even old entry points now route into the corrected path.

## Role Of `win32_helper.cs`

File:

- `scripts/win32_helper.cs`

This helper was originally used to locate the desktop shell host:

- `Progman`
- `SHELLDLL_DefView`
- `WorkerW`

It was improved during debugging so that if the old path is ever referenced again, it prefers the `WorkerW` sibling behind desktop icons instead of using a weaker heuristic.

Important detail:

This helper is no longer the primary mechanism for the active wallpaper path. The active path now prefers `mpv --wid=0`.

That is intentional. The helper remains useful for investigation and fallback work, but the live path should avoid shell-window surgery whenever possible.

## Why The White Ghost Windows Appeared

The blank white windows were almost certainly orphaned shell host surfaces.

What caused them:

- sending the `Progman` message to force wallpaper host creation
- picking or resizing the wrong `WorkerW`
- forcing parent/child relationships on a shell-owned surface
- leaving a shell window visible after the player failed

Symptoms:

- no taskbar icon
- desktop-sized blank white surface
- often a colored strip or partially drawn content at the top
- survived after the media window itself was closed

## How Cleanup Was Done

### Basic cleanup

For stray playback windows:

```powershell
Get-Process mpv -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Shell rebuild

For orphaned shell windows:

```powershell
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 2
Start-Process explorer.exe
```

This rebuilds the Windows desktop shell and often clears bad `WorkerW` / `Progman` states.

### Forced shell surface reset

When restart alone did not fully clear the window, visible `WorkerW` and `Progman` windows were pushed to bottom and hidden selectively.

That was used as a repair step only, not as part of the normal wallpaper flow.

## Validation Performed

### Script validation

PowerShell parse checks passed for:

- `scripts/set_wallpaper_cli_v2.ps1`
- `scripts/set_wallpaper_cli.ps1`

### `mpv` capability validation

Direct testing showed the installed `mpv` build accepted:

- `--wid=0`
- `--show-in-taskbar=no`

This confirmed the desktop-layer approach is supported by the local player build.

### Media-file caveat

One local `.mp4` test file failed because it was not a valid/recognizable video file for `mpv`.

That was not a windowing failure.

A different local `.mp4` stayed alive under the new launch path, which confirmed the approach itself works when the media is valid.

## Final Operational Model

The stable setup is:

1. picker chooses a video
2. launcher calls `set_wallpaper_cli_v2.ps1`
3. script kills previous `mpv`
4. script launches `mpv` with `--wid=0`
5. `mpv` renders on the desktop layer without manual `WorkerW` parenting

## Practical Rules Going Forward

- Do not make `WorkerW` reparenting the default path again unless there is a hard blocker with `mpv --wid=0`.
- Keep `set_wallpaper_cli.ps1` as a delegate, not a separate implementation.
- If a stray white shell window appears, treat it as a shell-host corruption issue, not as a normal app window.
- If wallpaper playback fails immediately, check whether the video file is actually valid before blaming the desktop embedding logic.

## Files Touched

- `C:\Users\allro\.itlives\apps\itlives\scripts\set_wallpaper_cli_v2.ps1`
- `C:\Users\allro\.itlives\scripts\set_wallpaper_cli.ps1`
- `C:\Users\allro\.itlives\scripts\win32_helper.cs`

## References

- mpv manual: https://mpv.io/manual/stable/
- WorkerW example gist: https://gist.github.com/KiRist-code/e9b8f097763d52fa237ff77cd0a2981d
