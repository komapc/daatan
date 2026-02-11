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
  description = "EC2 instance type for OpenClaw"
  type        = string
  default     = "t4g.medium"
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
