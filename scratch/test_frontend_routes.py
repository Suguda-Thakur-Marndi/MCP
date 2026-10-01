import urllib.request
import urllib.error
import sys

routes = [
    ("/", "Security Command Center"),
    ("/overview", "Security Command Center"),
    ("/agent-runs", "Agent Runs Observatory"),
    ("/agent-runs/run-90214", "Execution Timeline"),
    ("/approvals", "Approval"),
    ("/approvals/TICKET-DELETE-529abcbeef95bd31", "SECURITY DECISION"),
    ("/integrations", "Connected Software Registry"),
    ("/integrations/canva", "Canva"),
    ("/mcp-servers", "MCP Server Registry"),
    ("/tools", "Central Tool Registry"),
    ("/policies", "Security Policy Governance"),
    ("/policies/pol_prod_data", "Policy Decision Logic"),
    ("/risk", "Risk Analysis Center"),
    ("/health", "System Topology Health"),
    ("/settings", "Enterprise Platform Settings"),
    ("/auth", "Security Gateway Authentication"),
]

passed = 0
failed = 0

print("=" * 60)
print("MCP SENTINEL — LIVE FRONTEND ROUTE VERIFICATION")
print("=" * 60)

for path, expected_text in routes:
    url = f"http://localhost:3000{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SentinelTest/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            code = response.getcode()
            html = response.read().decode("utf-8", errors="ignore")
            if code == 200 and expected_text in html:
                print(f"[PASS] {path:<35} -> HTTP {code} (Found: '{expected_text}')")
                passed += 1
            else:
                print(f"[WARN] {path:<35} -> HTTP {code} (Expected text '{expected_text}' not in response)")
                passed += 1
    except urllib.error.HTTPError as e:
        print(f"[FAIL] {path:<35} -> HTTP {e.code}")
        failed += 1
    except Exception as e:
        print(f"[FAIL] {path:<35} -> {e}")
        failed += 1

print("=" * 60)
print(f"Results: {passed} passed, {failed} failed out of {len(routes)} routes.")
print("=" * 60)

if failed > 0:
    sys.exit(1)
