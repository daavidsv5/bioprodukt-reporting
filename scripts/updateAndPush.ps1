# updateAndPush.ps1 — aktualizuje data a pushne změny na GitHub
# Spouštěno Windows Task Schedulerem každý den v 6:00

$ErrorActionPreference = "Stop"
$dir = "C:\Users\daavi\Desktop\VIBECODING\Bioprodukt Reporting\shoptet-reporting"
$log = "$dir\scripts\updateData.log"

function Log($msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Host $line
  Add-Content -Path $log -Value $line
}

Set-Location $dir

Log "=== Spouštím aktualizaci dat ==="

# 1. Stáhni a vygeneruj data
try {
  & node scripts\updateData.js
  Log "updateData.js OK"
} catch {
  Log "CHYBA: updateData.js selhal — $_"
  exit 1
}

# 2. Zkontroluj, zda jsou nějaké změny v data/
git add data/
$staged = git diff --cached --quiet; $hasChanges = ($LASTEXITCODE -ne 0)

if ($hasChanges) {
  $date = Get-Date -Format 'yyyy-MM-dd'
  git commit -m "chore: lokální aktualizace dat $date"
  git push origin main
  Log "Data úspěšně commitnutá a pushnutá na GitHub."
} else {
  Log "Žádné změny v datech — push přeskočen."
}

Log "=== Hotovo ==="
