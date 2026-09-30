$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$outputDir = "C:\Users\sugud\.gemini\antigravity-ide\brain\407a5f9b-8c58-4839-9ba4-3c0d521f6f46"
$routes = @(
    @{ name = "auth_page"; url = "http://localhost:3000/auth" },
    @{ name = "dashboard_architectural"; url = "http://localhost:3000/" },
    @{ name = "not_found_page"; url = "http://localhost:3000/some-nonexistent-path" },
    @{ name = "overview_rewrite"; url = "http://localhost:3000/overview" }
)

foreach ($r in $routes) {
    $targetPath = Join-Path $outputDir "$($r.name).png"
    Write-Host "Capturing $($r.name) from $($r.url)..."
    & $chromePath --headless=new --disable-gpu --window-size=1536,960 --virtual-time-budget=4000 --screenshot="$targetPath" $r.url
    Write-Host "Saved to $targetPath"
}
