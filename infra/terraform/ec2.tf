# ============================================================
# EC2 Instance & Elastic IP Configuration for SentinelCore
# ============================================================

# Fetch latest official Ubuntu 24.04 LTS AMI for ap-southeast-2
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "sentinel_host" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  vpc_security_group_ids = [aws_security_group.sentinel_sg.id]

  # Root EBS Volume: GP3 encrypted at rest
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.ebs_volume_size
    encrypted             = true
    delete_on_termination = true
    tags = {
      Name = "${var.project_name}-root-volume"
    }
  }

  # Enforce IMDSv2 to prevent SSRF credential interception
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 mandatory
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "${var.project_name}-host"
    Role = "SecurityPlatformHost"
  }

  lifecycle {
    ignore_changes = [user_data]
  }
}

# Elastic IP allocation for persistent public addressing
resource "aws_eip" "sentinel_eip" {
  instance = aws_instance.sentinel_host.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }

  depends_on = [aws_instance.sentinel_host]
}
