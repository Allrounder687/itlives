# 🔗 Deep Integration: Rainmeter & Raycast

I have implemented a **two-tier integration system** to allow both lightweight static reading and dynamic control triggers from external desktop tools like **Rainmeter** and **Raycast**.

---

## 🏗️ 1. Static State File (`.inc`) for Rainmeter
To prevent polling overhead, the application now automatically generates a static `.inc` file containing variables describing its current state upon any change.

**📍 File Location:**
`[WorkspaceRoot]\runtime\rainmeter_state.inc`

### Variable Output Example:
```ini
[Variables]
itLives_IsPlaying=1
itLives_Paused=0
itLives_Volume=50
itLives_VideoTitle=Sunset_Waves
itLives_VideoPath=C:\Users\...\runtime\wallpapers\Sunset_Waves.mp4
```

### 🛠️ Rainmeter Skin Setup (Inclusion):
You can include this file directly into your Rainmeter skin to access variables with zero overhead:

```ini
[Variables]
@include="#CURRENTPATH#\path\to\itLives\runtime\rainmeter_state.inc"

[MeterTitle]
Meter=String
Text="Now Playing: #itLives_VideoTitle#"
```

---

## ⚡ 2. Local REST API (`127.0.0.1:3030`)
To trigger actions from widgets or search bars effortlessly, a lightweight HTTP server handles local triggers instantly.

### 🌐 Endpoints:

| Endpoint | Method | Action |
| :--- | :--- | :--- |
| `/status` | `GET` | Returns full JSON structure of current active state |
| `/pause` | `GET` | Pauses playback |
| `/play` | `GET` | Unpauses playback |
| `/toggle` | `GET` | Toggles pause status |
| `/next` | `GET` | Forces rotation to advance trigger |
| `/stop` | `GET` | Clears active video completely |

---

## 🔧 3. Tool Specific Setup Guides

### 🌧️ Rainmeter Trigger Button:
To map hardware triggers to skins, append triggers referencing curling the port endpoint:
```ini
[MeterPauseButton]
Meter=Image
SolidColor=255,0,0
W=30
H=30
LeftMouseUpAction=["curl" "http://127.0.0.1:3030/toggle"]
```

### 🛰️ Raycast Integration:
Create a quick **Raycast Script Command** to fetch background endpoints without full nodes:

```bash
#!/bin/bash

# @raycast.title Pause Wallpaper
# @raycast.mode silent
# @raycast.packageName itLives

curl -s "http://127.0.0.1:3030/pause"
```
You can also use the Raycast Extension API node packages setup querying `http://127.0.0.1:3030/status` to show currently active items in dashboard rows natively.
