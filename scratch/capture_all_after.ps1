$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$outDirs = @(
    "c:\Users\sugud\OneDrive\Documents\MCP\scratch\AFTER",
    "C:\Users\sugud\.gemini\antigravity-ide\brain\d7f38af1-908c-4c59-bb90-d72a25cc8da5\AFTER"
)

foreach ($dir in $outDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$routes = @(
    @{ name = "01-dashboard-after"; url = "http://localhost:3002/" },
    @{ name = "02-agent-after"; url = "http://localhost:3002/agent" },
    @{ name = "03-tools-after"; url = "http://localhost:3002/tools" },
    @{ name = "04-approvals-after"; url = "http://localhost:3002/approvals" },
    @{ name = "05-audit-after"; url = "http://localhost:3002/audit" },
    @{ name = "06-evaluation-after"; url = "http://localhost:3002/evaluation" },
    @{ name = "07-policies-after"; url = "http://localhost:3002/policies" },
    @{ name = "08-settings-after"; url = "http://localhost:3002/settings" },
    @{ name = "09-auth-after"; url = "http://localhost:3002/auth" }
)

foreach ($r in $routes) {
    $p1 = Join-Path $outDirs[0] ($r.name + ".png")
    Write-Host "Capturing $($r.name) from $($r.url)..."
    Start-Process $chromePath -ArgumentList "--headless", "--disable-gpu", "--window-size=1536,960", "--virtual-time-budget=4000", "--screenshot=$p1", $r.url -Wait
    $p2 = Join-Path $outDirs[1] ($r.name + ".png")
    Copy-Item $p1 $p2 -Force
    Write-Host "Saved $($r.name) ($((Get-Item $p1).Length) bytes)"
}

Write-Host "All AFTER screenshots captured successfully."
