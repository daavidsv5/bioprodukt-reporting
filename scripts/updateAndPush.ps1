# updateAndPush.ps1 — aktualizuje data a pushne změny na GitHub
# Spouštěno Windows Task Schedulerem každý den v 6:00

$ErrorActionPreference = "Stop"
$dir = "C:\Users\daavi\Desktop\VIBECODING\Bioprodukt Reporting\shoptet-reporting"
$log = "$dir\scripts\updateData.log"

function Log($msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding UTF8
}

Set-Location $dir

Log "=== Spoustim aktualizaci dat ==="

# 1. Stáhni a vygeneruj data
& node scripts\updateData.js
if ($LASTEXITCODE -ne 0) {
  Log "CHYBA: updateData.js selhal (exit $LASTEXITCODE)"
  exit 1
}
Log "updateData.js OK"

# 2. Zkontroluj, zda jsou nějaké změny v data/
git add data/
$hasChanges = (git diff --cached --quiet; $LASTEXITCODE -ne 0)

if ($hasChanges) {
  $date = Get-Date -Format 'yyyy-MM-dd'
  git commit -m "chore: lokalni aktualizace dat $date"
  # Pullni remote změny (GitHub Actions může mít novější commit) a pak pushni
  git pull --rebase origin main
  if ($LASTEXITCODE -ne 0) {
    Log "CHYBA: git pull --rebase selhal"
    git rebase --abort
    exit 1
  }
  git push origin main
  if ($LASTEXITCODE -ne 0) {
    Log "CHYBA: git push selhal (exit $LASTEXITCODE)"
    exit 1
  }
  Log "Data commitnuta a pushnuta na GitHub."
} else {
  Log "Zadne zmeny v datech — push preskocen."
}

Log "=== Hotovo ==="
