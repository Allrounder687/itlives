#!/usr/bin/env pwsh

# @raycast.schemaVersion 1
# @raycast.title itLives: Next Wallpaper
# @raycast.mode silent
# @raycast.packageName itLives
# @raycast.icon ⏭️

Invoke-RestMethod -Uri "http://127.0.0.1:3030/next"
