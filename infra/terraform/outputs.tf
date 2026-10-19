# ============================================================
# Terraform Outputs for MCP-Sentinel AWS Deployment
# ============================================================

output "ec2_instance_id" {
  description = "Target EC2 instance ID (Provide to GitHub Secret: EC2_INSTANCE_ID)"
  value       = aws_instance.sentinel_host.id
}

output "ec2_public_ip" {
  description = "Elastic IP of the MCP-Sentinel EC2 instance (Point DNS A-record to this address)"
  value       = aws_eip.sentinel_eip.public_ip
}

output "github_deploy_role_arn" {
  description = "IAM Role ARN assumed by GitHub Actions via OIDC (Provide to GitHub Secret: AWS_ROLE_ARN)"
  value       = aws_iam_role.github_deploy_role.arn
}

output "ecr_api_repository_url" {
  description = "ECR Repository URL for Backend API images"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "ECR Repository URL for Frontend Web images"
  value       = aws_ecr_repository.web.repository_url
}

output "aws_region" {
  description = "AWS region of deployment"
  value       = var.aws_region
}

output "ssm_connect_command" {
  description = "AWS CLI command to open an interactive session without SSH"
  value       = "aws ssm start-session --target ${aws_instance.sentinel_host.id} --region ${var.aws_region}"
}
