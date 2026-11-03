# Creates (or updates in place) the scheduled tasks for scripts/jobs. Current user, no admin.
# Never deletes anything: Register-ScheduledTask -Force only overwrites a task of the same name.
#   powershell -ExecutionPolicy Bypass -File scripts\jobs\register-tasks.ps1
$J = 'D:\labyrinth\Github\JaGeX\dragonwilds-speedrun\scripts\jobs'
$user = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$today = (Get-Date).Date

function Reg($name, $script, $triggers, $limit, $desc) {
  $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$J\hidden.vbs`" `"$J\$script`"" -WorkingDirectory 'D:\labyrinth\Github\JaGeX\dragonwilds-speedrun'
  # Priority 6 = normal. The Task Scheduler default (7, below normal) never gets its console
  # started while the PC is at 100% CPU (games, Whisper, Defender), so jobs hung forever.
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit $limit -Priority 6
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description $desc -Force | Out-Null
  "registered $name"
}
function Every($start, $interval) {
  $t = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval $interval
  $t.Repetition.Duration = ''   # repeat indefinitely
  $t
}

Reg 'RaidLab Hourly' 'hourly.mjs' (Every $today.AddMinutes(28) (New-TimeSpan -Hours 1)) (New-TimeSpan -Hours 2) 'Patch notes, sources, ingest, reviews, analysis, KB, publish (scripts\jobs\hourly.mjs). Log D:\claude-temp\logs\jobs-<date>.log'
Reg 'RaidLab Transcripts' 'transcripts.mjs' (Every $today.AddMinutes(15) (New-TimeSpan -Hours 2)) (New-TimeSpan -Minutes 115) 'YouTube transcript ingest (scripts\jobs\transcripts.mjs). Log D:\claude-temp\logs\transcripts-<date>.log'
Reg 'RaidLab Daily Review' 'daily-review.mjs' (New-ScheduledTaskTrigger -Daily -At $today.AddHours(4.5)) (New-TimeSpan -Hours 12) 'Full review backlog, analysis, KB, Playwright, publish (scripts\jobs\daily-review.mjs). Log D:\claude-temp\logs\daily-review-<date>.log'
Reg 'SMILE Arena Build' 'smile-arena-build.mjs' (Every $today.AddMinutes(35) (New-TimeSpan -Hours 1)) (New-TimeSpan -Minutes 50) 'smile-arena: pull, npm run build:site, commit + push (scripts\jobs\smile-arena-build.mjs). Log D:\claude-temp\logs\smile-arena-build-<date>.log'
Reg 'Sangha Bridge Watchdog' 'watchdog.mjs' (Every $today (New-TimeSpan -Minutes 10)) (New-TimeSpan -Minutes 5) 'Restart bb lab (5180) and osrs gui server.py (5555) if down (scripts\jobs\watchdog.mjs). Log D:\claude-temp\logs\watchdog-<date>.log'
Reg 'Sangha Health' 'health.mjs' (Every $today.AddMinutes(5) (New-TimeSpan -Minutes 30)) (New-TimeSpan -Minutes 5) 'Disk space, task results, ports -> D:\claude-temp\logs\health.log + health.json (scripts\jobs\health.mjs)'
Reg 'OSRS Hiscores' 'osrs-hiscores.mjs' @((New-ScheduledTaskTrigger -AtLogOn -User $user), (New-ScheduledTaskTrigger -Daily -At $today.AddHours(6).AddMinutes(10))) (New-TimeSpan -Minutes 30) 'osrs-accounts: pull, scripts\refresh-hiscores.mjs (account.json, ACCOUNT.md, README), commit + push (scripts\jobs\osrs-hiscores.mjs). Log D:\claude-temp\logs\osrs-hiscores-<date>.log'
Reg 'RuneLite Capture' 'runelite-capture.mjs' @((New-ScheduledTaskTrigger -AtLogOn -User $user), (Every $today.AddMinutes(50) (New-TimeSpan -Hours 1))) (New-TimeSpan -Minutes 5) 'PrintWindow capture of RuneLite to D:\claude-temp\demo\runelite-latest.png (scripts\jobs\runelite-capture.mjs). Log D:\claude-temp\logs\runelite-capture-<date>.log'
