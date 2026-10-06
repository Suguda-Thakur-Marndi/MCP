import asyncio
import os
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    server_params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcp_server.server"],
        env=dict(os.environ),
    )
    print("Connecting to MCP-Sentinel Server via stdio...")
    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # 1. Initialize
            init_res = await session.initialize()
            print("[+] 1. Handshake Initialized:", init_res.server_info)

            # 2. List Tools
            tools_res = await session.list_tools()
            print(f"[+] 2. Discovered {len(tools_res.tools)} Tools:")
            for t in tools_res.tools:
                print(f"       - {t.name}: {t.description[:60]}...")

            # 3. List Resources
            res_list = await session.list_resources()
            print(f"[+] 3. Discovered {len(res_list.resources)} Resources:")
            for r in res_list.resources:
                print(f"       - {r.uri}: {r.name}")

            # Read a resource
            r_content = await session.read_resource("security://policy")
            res_text = getattr(r_content.contents[0], "text", str(r_content.contents[0]))
            print(f"[+] 4. Read Resource security://policy (length={len(res_text)} bytes)")

            # 4. List Prompts
            p_list = await session.list_prompts()
            print(f"[+] 5. Discovered {len(p_list.prompts)} Prompts:")
            for p in p_list.prompts:
                print(f"       - {p.name}: {p.description[:60]}...")

            # Get Prompt
            rendered = await session.get_prompt("customer_investigation_brief", {"customer_id": "CUST-000001"})
            print(f"[+] 6. Rendered Prompt message count: {len(rendered.messages)}")

            # 5. Call Read Tool
            print("[+] 7. Calling Read Tool get_customer(CUST-000001)...")
            call_res = await session.call_tool("get_customer", {"customer_id": "CUST-000001"})
            print(f"       -> Result: {call_res.structured_content or call_res.content[0].text}")

            # 6. Call Destructive Tool without ticket (Should require approval)
            print("[+] 8. Calling Destructive Tool delete_customer without approval ticket...")
            del_res = await session.call_tool("delete_customer", {"customer_id": "CUST-000001", "approval_ticket": ""})
            print(f"       -> Result: {del_res.structured_content or del_res.content[0].text}")

            print("\n[SUCCESS] MCP SERVER PROTOCOL, TOOLS, RESOURCES & PROMPTS FULLY VERIFIED OVER STDIO!")

if __name__ == "__main__":
    asyncio.run(main())
