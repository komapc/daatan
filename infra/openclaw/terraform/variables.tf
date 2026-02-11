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
  description = "CIDR block allowed for SSH access"
  type        = string
  default     = "0.0.0.0/0" # User should ideally override this
}
