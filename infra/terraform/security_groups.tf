# ============================================================
# AWS Security Group for SentinelCore EC2 Host
# ============================================================
# Security Policy:
# 1. Inbound 80 (HTTP) & 443 (HTTPS) permitted from public internet (or ALB).
# 2. Inbound 22 (SSH) is EXCLUDED. Zero SSH ports are open.
#    All administrative access operates through AWS Systems Manager (SSM).
# 3. Inbound 5432 (Postgres) is EXCLUDED. Supabase is external.
# 4. Inbound 8000 (API) & 3000 (Web) are EXCLUDED from public internet.
#    They are bound to 127.0.0.1 and routed internally via Caddy reverse proxy.
# 5. Outbound allows all egress traffic for TLS, ECR, SSM, and external Supabase DB.
# ============================================================

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "sentinel_sg" {
  name        = "${var.project_name}-host-sg"
  description = "Hardened security group for SentinelCore EC2 host"
  vpc_id      = data.aws_vpc.default.id

  # Inbound HTTP (Port 80) -> Caddy ACME challenge & HTTPS redirection
  ingress {
    description      = "HTTP for ACME TLS validation and redirect"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  # Inbound HTTPS (Port 443) -> TLS terminated at Caddy reverse proxy
  ingress {
    description      = "HTTPS secure traffic to Caddy reverse proxy"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  # Outbound egress: TLS (443), Supabase Postgres (5432), DNS (53), NTP (123)
  egress {
    description      = "Permit all outbound egress traffic"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "${var.project_name}-host-sg"
  }
}
