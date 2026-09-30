$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}
$outDir = "C:\Users\sugud\.gemini\antigravity-ide\brain\d7f38af1-908c-4c59-bb90-d72a25cc8da5\BEFORE"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$routes = @(
    @{ name = "01-dashboard-before"; url = "http://localhost:3000/" },
    @{ name = "02-agent-before"; url = "http://localhost:3000/agent" },
    @{ name = "03-tools-before"; url = "http://localhost:3000/tools" },
    @{ name = "04-approvals-before"; url = "http://localhost:3000/approvals" },
    @{ name = "05-audit-before"; url = "http://localhost:3000/audit" },
    @{ name = "06-evaluation-before"; url = "http://localhost:3000/evaluation" },
    @{ name = "07-policies-before"; url = "http://localhost:3000/policies" },
    @{ name = "08-settings-before"; url = "http://localhost:3000/settings" },
    @{ name = "09-auth-before"; url = "http://localhost:3000/auth" }
)

foreach ($item in $routes) {
    $targetPath = Join-Path $outDir ($item.name + ".png")
    Write-Host "Capturing $($item.name) from $($item.url)..."
    & $chromePath --headless=new --disable-gpu --window-size=1536,960 --virtual-time-budget=3000 --screenshot="$targetPath" $item.url
}
Write-Host "Done capturing BEFORE screenshots."
