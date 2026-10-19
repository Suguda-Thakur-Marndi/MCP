variable "aws_region" {
  description = "Target AWS Region for deployment"
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project identifier prefix"
  type        = string
  default     = "mcp-sentinel"
}

variable "instance_type" {
  description = "EC2 instance size (t3.small recommended minimum: 2 vCPU, 2GB RAM + 2GB swap; t3.medium for heavy workloads)"
  type        = string
  default     = "t3.small"
}

variable "ebs_volume_size" {
  description = "Root GP3 EBS storage size in GB"
  type        = number
  default     = 30
}

variable "github_repository" {
  description = "GitHub repository formatted as owner/repo for OIDC trust scoping"
  type        = string
  default     = "Suguda-Thakur-Marndi/MCP"
}

variable "allowed_branches" {
  description = "List of git branch patterns permitted to assume the deploy role via GitHub OIDC"
  type        = list(string)
  default     = ["main", "master", "release-candidate"]
}

variable "domain_name" {
  description = "Production fully qualified domain name (FQDN) for TLS certificate and Caddy reverse proxy"
  type        = string
  default     = "sentinel.yourdomain.com"
}
