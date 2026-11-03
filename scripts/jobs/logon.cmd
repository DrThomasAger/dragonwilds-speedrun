@echo off
rem Logon job (Task Scheduler: "RaidLab Logon"): bridge + live Twitch chat monitor, everything on D:.
set TEMP=D:\claude-temp\tmp
set TMP=D:\claude-temp\tmp
set npm_config_cache=D:\claude-temp\npm-cache
set PIP_CACHE_DIR=D:\claude-temp\pip-cache
cd /d D:\labyrinth\Github\JaGeX\dragonwilds-speedrun
start "RaidLab bridge" /min cmd /c "bb lab >> D:\claude-temp\logs\bridge.log 2>&1"
start "RaidLab twitch" /min cmd /c "node scripts\ingest\twitch-live.mjs >> D:\claude-temp\logs\twitch-live.log 2>&1"
