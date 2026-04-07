# createTask.ps1 — registruje Windows Task Scheduler úlohu
# Spustit jako administrátor:  .\scripts\createTask.ps1

$dir    = 'C:\Users\daavi\Desktop\VIBECODING\Bioprodukt Reporting\shoptet-reporting'
$script = "$dir\scripts\updateAndPush.ps1"

$action = New-ScheduledTaskAction `
    -Execute  'powershell.exe' `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$script`"" `
    -WorkingDirectory $dir

$trigger = New-ScheduledTaskTrigger -Daily -At '06:00'

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask `
    -TaskName 'Bioprodukt Reporting - aktualizace dat' `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -Force

Write-Host "Task úspěšně vytvořen — spouští updateAndPush.ps1 každý den v 6:00."
