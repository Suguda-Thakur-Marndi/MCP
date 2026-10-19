"""
Deterministic Enterprise Synthetic Data Generator for MCP-Sentinel Phase 2.
Generates 500+ customers, 1000+ orders, and 100+ audit notes using only synthetic data.
Zero real PII; uses 'example.test' domains.
Usage:
    python scripts/seed_database.py [--seed 42] [--customers 500] [--orders 1000] [--notes 100]
"""

import argparse
import asyncio
import datetime
import decimal
import pathlib
import random
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import asyncpg

from mcp_sentinel.config.settings import get_settings

FIRST_NAMES = [
    "Aarav",
    "Aditi",
    "Alexander",
    "Amara",
    "Carlos",
    "Chloe",
    "David",
    "Elena",
    "Fatima",
    "Gabriel",
    "Hanna",
    "Ibrahim",
    "Jasmine",
    "Kenji",
    "Lina",
    "Lucas",
    "Maya",
    "Mei",
    "Noah",
    "Olivia",
    "Priya",
    "Rafael",
    "Sanjay",
    "Sara",
    "Tariq",
    "Vikram",
    "Yuki",
    "Zara",
    "Liam",
    "Emma",
    "Matteo",
    "Sophia",
]

LAST_NAMES = [
    "Sharma",
    "Patel",
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Perez",
    "Thompson",
    "White",
    "Harris",
    "Sanchez",
    "Clark",
    "Ramirez",
    "Lewis",
    "Robinson",
]

COUNTRIES = ["US", "IN", "DE", "UK", "JP", "FR", "CA", "AU", "SG", "BR"]
TIERS = ["standard", "premium", "enterprise"]
CUSTOMER_STATUSES = ["active", "active", "active", "inactive", "suspended"]
ORDER_STATUSES = ["pending", "processing", "completed", "completed", "cancelled", "refunded"]
CURRENCIES = ["USD", "EUR", "GBP", "INR"]


async def seed_data(
    seed: int = 42, customer_count: int = 500, order_count: int = 1000, note_count: int = 100
) -> None:
    random.seed(seed)
    settings = get_settings()
    print(f"[*] Seeding enterprise dataset (seed={seed})...")
    print(
        f"[*] Target metrics: {customer_count} customers, {order_count} orders, {note_count} audit notes."
    )

    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        # 1. Clean existing records for deterministic reset
        print("[*] Resetting existing database tables...")
        await conn.execute(
            "TRUNCATE customer_audit_notes, orders, audit_events, gating_approval_tickets, approval_requests, customers RESTART IDENTITY CASCADE;"
        )

        # 2. Insert synthetic customers
        print(f"[*] Generating {customer_count} synthetic customers...")
        now = datetime.datetime.now(datetime.timezone.utc)
        customer_records = []
        for i in range(1, customer_count + 1):
            fname = random.choice(FIRST_NAMES)
            lname = random.choice(LAST_NAMES)
            name = f"{fname} {lname}"
            email = f"{fname.lower()}.{lname.lower()}.{i}@example.test"
            tier = random.choice(TIERS)
            status = random.choice(CUSTOMER_STATUSES)
            country = random.choice(COUNTRIES)
            customer_code = f"CUST-{i:06d}"
            created_at = now - datetime.timedelta(days=random.randint(10, 700))
            updated_at = created_at + datetime.timedelta(days=random.randint(0, 10))
            customer_records.append(
                (i, customer_code, name, email, tier, status, country, created_at, updated_at)
            )

        await conn.copy_records_to_table(
            "customers",
            records=customer_records,
            columns=[
                "id",
                "customer_code",
                "name",
                "email",
                "tier",
                "status",
                "country",
                "created_at",
                "updated_at",
            ],
        )
        await conn.execute("SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));")
        print(f"[+] Successfully inserted {customer_count} customers.")

        # 3. Insert synthetic orders
        print(f"[*] Generating {order_count} synthetic orders...")
        order_records = []
        for j in range(1, order_count + 1):
            order_number = f"ORD-{j:06d}"
            cust_id = random.randint(1, customer_count)
            status = random.choice(ORDER_STATUSES)
            amount = decimal.Decimal(str(round(random.uniform(15.0, 4500.0), 2)))
            currency = random.choice(CURRENCIES)
            created_at = now - datetime.timedelta(days=random.randint(1, 365))
            order_records.append((order_number, cust_id, status, amount, currency, created_at))

        await conn.copy_records_to_table(
            "orders",
            records=order_records,
            columns=[
                "order_number",
                "customer_id",
                "status",
                "total_amount",
                "currency",
                "created_at",
            ],
        )
        print(f"[+] Successfully inserted {order_count} orders.")

        # 4. Insert synthetic audit notes
        print(f"[*] Generating {note_count} synthetic audit notes...")
        note_records = []
        for k in range(1, note_count + 1):
            cust_id = random.randint(1, customer_count)
            author = f"auditor_{random.randint(1, 10):02d}"
            note_text = f"Routine synthetic compliance verification #{k} for account."
            created_at = now - datetime.timedelta(days=random.randint(1, 180))
            note_records.append((cust_id, author, note_text, created_at))

        await conn.copy_records_to_table(
            "customer_audit_notes",
            records=note_records,
            columns=["customer_id", "author_id", "note_text", "created_at"],
        )
        print(f"[+] Successfully inserted {note_count} audit notes.")

        # 5. Pre-stage approval tickets for testing
        print("[*] Pre-staging test approval tickets...")
        tickets = [
            (
                "TICKET-VALID-PURGE-003",
                "3",
                "PURGE",
                True,
                False,
                now,
                now + datetime.timedelta(hours=2),
                None,
            ),
            (
                "TICKET-VALID-PURGE-004",
                "4",
                "PURGE",
                True,
                False,
                now,
                now + datetime.timedelta(hours=2),
                None,
            ),
            (
                "TICKET-VALID-DEL-005",
                "5",
                "DELETE_CUSTOMER",
                True,
                False,
                now,
                now + datetime.timedelta(hours=2),
                None,
            ),
            (
                "TICKET-VALID-DEL-006",
                "6",
                "DELETE_CUSTOMER",
                True,
                False,
                now,
                now + datetime.timedelta(hours=2),
                None,
            ),
            (
                "TICKET-UNAPPROVED-005",
                "5",
                "PURGE",
                False,
                False,
                now,
                now + datetime.timedelta(hours=2),
                None,
            ),
            (
                "TICKET-CONSUMED-001",
                "1",
                "PURGE",
                True,
                True,
                now - datetime.timedelta(days=1),
                now + datetime.timedelta(hours=1),
                now - datetime.timedelta(hours=1),
            ),
            (
                "TICKET-EXPIRED-007",
                "7",
                "PURGE",
                True,
                False,
                now - datetime.timedelta(hours=2),
                now - datetime.timedelta(hours=1),
                None,
            ),
            (
                "TICKET-WRONG-ACTION-003",
                "3",
                "EXPORT",
                True,
                False,
                now,
                now + datetime.timedelta(hours=2),
                None,
            ),
        ]
        await conn.copy_records_to_table(
            "gating_approval_tickets",
            records=tickets,
            columns=[
                "ticket_id",
                "target_id",
                "action",
                "approved",
                "consumed",
                "created_at",
                "expires_at",
                "consumed_at",
            ],
        )
        print("[+] Test approval tickets staged.")

        # 6. Verification counts
        c_cnt = await conn.fetchval("SELECT COUNT(*) FROM customers")
        o_cnt = await conn.fetchval("SELECT COUNT(*) FROM orders")
        n_cnt = await conn.fetchval("SELECT COUNT(*) FROM customer_audit_notes")
        t_cnt = await conn.fetchval("SELECT COUNT(*) FROM gating_approval_tickets")

        print("=" * 60)
        print(
            f"[OK] Seeding Complete! Customers: {c_cnt}, Orders: {o_cnt}, Notes: {n_cnt}, Tickets: {t_cnt}"
        )
        print("=" * 60)

    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Deterministic synthetic enterprise data generator"
    )
    parser.add_argument("--seed", type=int, default=42, help="PRNG seed for deterministic output")
    parser.add_argument("--customers", type=int, default=500, help="Number of customers to seed")
    parser.add_argument("--orders", type=int, default=1000, help="Number of orders to seed")
    parser.add_argument("--notes", type=int, default=100, help="Number of audit notes to seed")
    args = parser.parse_args()

    asyncio.run(
        seed_data(
            seed=args.seed,
            customer_count=args.customers,
            order_count=args.orders,
            note_count=args.notes,
        )
    )


if __name__ == "__main__":
    main()
