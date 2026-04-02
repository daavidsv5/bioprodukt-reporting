$action  = New-ScheduledTaskAction `
    -Execute  'C:\Program Files\nodejs\node.exe' `
    -Argument '"C:\Users\daavi\Desktop\VIBECODING\Bioprodukt Reporting\shoptet-reporting\scripts\updateData.js"' `
    -WorkingDirectory 'C:\Users\daavi\Desktop\VIBECODING\Bioprodukt Reporting\shoptet-reporting'

$trigger = New-ScheduledTaskTrigger -Daily -At '06:00'

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
    -TaskName 'Bioprodukt Reporting - aktualizace dat' `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -Force

Write-Host "Task uspesne vytvoreny."
