terraform {
  required_version = ">= 1.0"

  # Local backend: state in terraform/terraform.tfstate
  # Drawback: if you lose this file, you cannot terraform destroy or manage the stack.
  # Mitigation: back up terraform.tfstate; or switch to S3 backend if running from multiple machines.
  backend "local" {
    path = "terraform.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = ["272007598366"]

  default_tags {
    tags = {
      Project     = "openclaw"
      ManagedBy   = "terraform"
      Application = "Clawborators"
    }
  }
}

# --- Networking ---
# Security group defined in vpc.tf

# --- EC2 Instance ---
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# IAM role for Secrets Manager access
resource "aws_iam_role" "openclaw_secrets" {
  name = "openclaw-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "openclaw_secrets" {
  name = "openclaw-secrets-policy"
  role = aws_iam_role.openclaw_secrets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:openclaw/*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "openclaw_secrets" {
  name = "openclaw-secrets-profile"
  role = aws_iam_role.openclaw_secrets.name
}

resource "aws_instance" "openclaw" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  key_name                    = var.ssh_key_name
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.openclaw.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.openclaw_secrets.name

  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    delete_on_termination = false
    encrypted             = true
  }

  user_data = file("${path.module}/scripts/user-data.sh")

  tags = {
    Name = "openclaw-worker"
  }
}

resource "aws_eip" "openclaw" {
  instance = aws_instance.openclaw.id
  domain   = "vpc"

  tags = {
    Name = "openclaw-eip"
  }
}
