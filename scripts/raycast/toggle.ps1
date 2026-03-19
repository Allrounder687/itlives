#!/usr/bin/env pwsh

# @raycast.schemaVersion 1
# @raycast.title OpenClaw: Toggle Pause/Play
# @raycast.mode silent
# @raycast.packageName OpenClaw
# @raycast.icon ⏯️

Invoke-RestMethod -Uri "http://127.0.0.1:3030/toggle"
