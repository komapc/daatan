variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "openclaw"
}

variable "ec2_instance_type" {
  description = <<-EOT
    EC2 instance type for OpenClaw + LiteLLM. Choose based on usage:

    Instance     | vCPU | RAM  | Cost/mo | Use case
    -------------|------|------|---------|----------------------------------------------
    t3.small     |  2   | 2 GB | ~$15    | Gateway-only, single user, Bedrock backend
    t3.medium    |  2   | 4 GB | ~$30    | 1-2 concurrent agents, light workloads ← budget pick
    t3.large     |  2   | 8 GB | ~$60    | 3-5 concurrent agents + LiteLLM ← recommended
    t3.xlarge    |  4   |16 GB | ~$120   | Heavy use, self-hosted small LLM (Ollama 7B)
    t4g.medium   |  2   | 4 GB | ~$22    | ARM equivalent of t3.medium (change AMI to arm64)
    t4g.large    |  2   | 8 GB | ~$37    | ARM equivalent of t3.large — cheapest for 8 GB

    Note: t3.small is too small when running LiteLLM alongside OpenClaw.
    Use t3.medium (no LiteLLM, call OpenRouter directly) or t3.large (with LiteLLM).
  EOT
  type        = string
  default     = "t3.large"
}

variable "ssh_key_name" {
  description = "Name of the SSH key pair in AWS"
  type        = string
  default     = "daatan-key"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH access (e.g. 1.2.3.4/32). Get your IP: curl -s ifconfig.me"
  type        = string

  validation {
    condition     = var.allowed_ssh_cidr != "" && var.allowed_ssh_cidr != "0.0.0.0/0" && !startswith(var.allowed_ssh_cidr, "YOUR_IP")
    error_message = "allowed_ssh_cidr must be set to your IP/32 in terraform.tfvars. Refusing 0.0.0.0/0 and placeholder."
  }
}

variable "aws_account_id" {
  description = "AWS account ID for Secrets Manager ARN"
  type        = string
  default     = "272007598366"
}

variable "litellm_master_key" {
  description = "LiteLLM proxy auth key (OpenClaw uses this to talk to LiteLLM). Change from default."
  type        = string
  default     = "sk-openclaw-local"
  sensitive   = true
}
