# One-step setup for Smile CLI + Sangha History MCP on any Windows PC.
# Usage (after cloning/pulling Smile-Prompt-Language or dragonwilds-speedrun):
#   pwsh .\setup-smile-cli.ps1

$ErrorActionPreference = 'Stop'

$hasD = Test-Path 'D:\'
$tempDir = if ($hasD) { 'D:\claude-temp' } else { Join-Path $env:USERPROFILE '.smile-temp' }
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$env:TEMP = $tempDir
$env:TMP = $tempDir

# 1. Pick projects folder (D:\projects if D: exists, otherwise parent of current repo)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = if ((Split-Path -Leaf $scriptDir) -in @('agents', 'cli')) { Split-Path -Parent (Split-Path -Parent $scriptDir) } else { $scriptDir }
$defaultProjects = if ($hasD) { 'D:\projects' } else { Split-Path -Parent $repoRoot }
$projectsDir = if ($env:SANGHA_PROJECTS_DIR) { $env:SANGHA_PROJECTS_DIR } else { $defaultProjects }
New-Item -ItemType Directory -Force -Path $projectsDir | Out-Null

Write-Host "=== Smile CLI & Sangha History Setup ===" -ForegroundColor Cyan
Write-Host "Projects folder : $projectsDir"
Write-Host "Temp folder     : $tempDir"

# 2. Check Node.js & Babashka (bb)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not on PATH. Install Node.js (e.g. 'winget install OpenJS.NodeJS.LTS') and re-run."
}
$bbCmd = Get-Command bb -ErrorAction SilentlyContinue
if (-not $bbCmd -and (Test-Path 'D:\scoop\shims\bb.exe')) { $bbCmd = Get-Item 'D:\scoop\shims\bb.exe' }
if (-not $bbCmd -and (Test-Path "$env:USERPROFILE\scoop\shims\bb.exe")) { $bbCmd = Get-Item "$env:USERPROFILE\scoop\shims\bb.exe" }
if (-not $bbCmd) {
  Write-Host "Babashka (bb) not found — installing via winget/scoop..." -ForegroundColor Yellow
  if (Get-Command scoop -ErrorAction SilentlyContinue) {
    scoop install babashka
  } elseif (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id borkdude.babashka -e --accept-source-agreements --accept-package-agreements
  } else {
    Write-Warning "Install Babashka ('winget install borkdude.babashka') so 'smile lint' and 'smile mend' can run."
  }
}

# 3. Ensure companion repos exist (or fast-forward pull if already cloned)
$repos = @(
  @{ Name = 'Smile-Prompt-Language'; Url = 'https://github.com/DrThomasAger/Smile-Prompt-Language.git'; AltPaths = @('D:\projects\Smile-Prompt-Language', 'D:\labyrinth\Github\Smile-Prompt-Language') },
  @{ Name = 'dragonwilds-speedrun';  Url = 'https://github.com/DrThomasAger/dragonwilds-speedrun.git';  AltPaths = @('D:\labyrinth\Github\JaGeX\dragonwilds-speedrun', 'D:\projects\JaGeX\dragonwilds-speedrun', 'D:\projects\dragonwilds-speedrun') },
  @{ Name = 'sangha-vault';          Url = 'https://github.com/DrThomasAger/sangha-vault.git';          AltPaths = @('D:\projects\sangha-vault') }
)

$resolved = @{}
foreach ($r in $repos) {
  $found = $null
  foreach ($cand in (@((Join-Path $projectsDir $r.Name)) + $r.AltPaths)) {
    if ($cand -and (Test-Path (Join-Path $cand '.git'))) { $found = $cand; break }
  }
  if ($found) {
    Write-Host "Updating $($r.Name) at $found ..."
    git -C $found pull --ff-only 2>$null | Out-Null
    $resolved[$r.Name] = $found
  } else {
    $target = Join-Path $projectsDir $r.Name
    Write-Host "Cloning $($r.Name) -> $target ..."
    git clone --filter=blob:none $r.Url $target
    if (Test-Path (Join-Path $target '.git')) {
      $resolved[$r.Name] = $target
    } else {
      Write-Warning "Could not clone $($r.Name) (check GitHub sign-in if private)."
    }
  }
}

# 4. Create `smile.cmd` and `smile` (Git Bash) shim on PATH
$binDir = if ($hasD) { 'D:\bin' } else { Join-Path $env:USERPROFILE '.local\bin' }
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$cliScript = $null
foreach ($c in @(
  (if ($resolved['dragonwilds-speedrun']) { Join-Path $resolved['dragonwilds-speedrun'] 'scripts\agents\smile-cli.mjs' }),
  (if ($resolved['Smile-Prompt-Language']) { Join-Path $resolved['Smile-Prompt-Language'] 'cli\smile.mjs' }),
  (Join-Path $scriptDir 'smile-cli.mjs'),
  (Join-Path $scriptDir 'cli\smile.mjs')
)) {
  if ($c -and (Test-Path $c)) { $cliScript = $c; break }
}
if (-not $cliScript) { throw "Could not locate smile-cli.mjs" }

$cmdContent = @"
@echo off
set "TEMP=$tempDir"
set "TMP=$tempDir"
set "SANGHA_PROJECTS_DIR=$projectsDir"
node "$cliScript" %*
"@
Set-Content -Path (Join-Path $binDir 'smile.cmd') -Value $cmdContent -Encoding ASCII

$shCli = $cliScript -replace '\\', '/'
$shTemp = $tempDir -replace '\\', '/'
$shProj = $projectsDir -replace '\\', '/'
$shContent = "#!/bin/sh`nexport TEMP=`"$shTemp`" TMP=`"$shTemp`" SANGHA_PROJECTS_DIR=`"$shProj`"`nexec node `"$shCli`" `"`$@`"`n"
[System.IO.File]::WriteAllText((Join-Path $binDir 'smile'), $shContent, (New-Object System.Text.UTF8Encoding($false)))

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (($userPath -split ';') | Where-Object { $_.TrimEnd('\') -ieq $binDir.TrimEnd('\') })) {
  $newPath = if ($userPath) { "$binDir;$userPath" } else { $binDir }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Host "Added $binDir to User PATH." -ForegroundColor Green
}
if (-not (($env:PATH -split ';') | Where-Object { $_.TrimEnd('\') -ieq $binDir.TrimEnd('\') })) {
  $env:PATH = "$binDir;$env:PATH"
}

# 5. Configure sangha-history MCP server + skill for Gemini CLI, Antigravity IDE, and Claude Code
if ($resolved['dragonwilds-speedrun']) {
  $mcpScript = Join-Path $resolved['dragonwilds-speedrun'] 'scripts\agents\mcp-server.mjs'
  if (Test-Path $mcpScript) {
    # Gemini CLI ~/.gemini/settings.json
    $geminiSettingsPath = Join-Path $env:USERPROFILE '.gemini\settings.json'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $geminiSettingsPath) | Out-Null
    $cfg = if (Test-Path $geminiSettingsPath) { Get-Content $geminiSettingsPath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
    if (-not $cfg.ContainsKey('mcpServers')) { $cfg['mcpServers'] = @{} }
    $cfg['mcpServers']['sangha-history'] = @{
      command = 'node'
      args    = @($mcpScript)
      env     = @{ TEMP = $tempDir; TMP = $tempDir; SANGHA_PROJECTS_DIR = $projectsDir }
      trust   = $true
    }
    $cfg | ConvertTo-Json -Depth 10 | Set-Content -Path $geminiSettingsPath -Encoding UTF8

    # Antigravity IDE ~/.gemini/config/mcp_config.json
    $agyMcpPath = Join-Path $env:USERPROFILE '.gemini\config\mcp_config.json'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $agyMcpPath) | Out-Null
    $agyCfg = if (Test-Path $agyMcpPath) { Get-Content $agyMcpPath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
    if (-not $agyCfg.ContainsKey('mcpServers')) { $agyCfg['mcpServers'] = @{} }
    $agyCfg['mcpServers']['sangha-history'] = @{
      command = 'node'
      args    = @($mcpScript)
      env     = @{ TEMP = $tempDir; TMP = $tempDir; SANGHA_PROJECTS_DIR = $projectsDir }
    }
    $agyCfg | ConvertTo-Json -Depth 10 | Set-Content -Path $agyMcpPath -Encoding UTF8

    # sangha-history SKILL.md
    $skillDir = Join-Path $env:USERPROFILE '.gemini\config\skills\sangha-history'
    New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
    $skillMd = @"
---
name: sangha-history
description: Search and retrieve all personal AI conversations (Claude Code, Subagents, 449 Instance Harvest dialogues & reports, ChatGPT exports, Antigravity, Gemini CLI, Smile Chat), standing agent memory, local GitHub repositories, and Smile Prompt Language lint/mend tools. Activate whenever past conversations, decisions, Claude history, Smile prompts, or local GitHub repos are needed.
---

# Sangha Conversation History, Repos & Smile Integration

Use either the ``sangha-history`` MCP server tools or the ``smile`` CLI on ``PATH``:
- ``smile stats``
- ``smile search "<query>" [--source=claude] [--project=osrs]``
- ``smile chat <id>``
- ``smile memory "<query>"``
- ``smile repos [filter]``
- ``smile lint <file>`` / ``smile mend <file>`` / ``smile footer "<header>"`` / ``smile clip``
- ``smile sync``
"@
    Set-Content -Path (Join-Path $skillDir 'SKILL.md') -Value $skillMd -Encoding UTF8
    Write-Host "Configured sangha-history MCP & skill for Gemini CLI + Antigravity." -ForegroundColor Green
  }
}

Write-Host "`n=== Testing Smile CLI ===" -ForegroundColor Cyan
& (Join-Path $binDir 'smile.cmd') footer "Agent of Reciprocity [:"
& (Join-Path $binDir 'smile.cmd') stats
Write-Host "`nDone! Open any terminal and run: smile help" -ForegroundColor Green
