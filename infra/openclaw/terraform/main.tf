terraform {
  required_version = ">= 1.0"

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
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      Project   = "openclaw"
      ManagedBy = "terraform"
    }
  }
}

# --- AMI: Ubuntu 24.04 LTS x86_64 (change arch to arm64 + instance to t4g.* for ~15% savings) ---
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# --- IAM: Secrets Manager + Bedrock + SSM access ---
# Bedrock: allows OpenClaw to call Claude models directly via IAM (no API key needed).
# Switch to OpenRouter later by adding OPENROUTER_API_KEY to Secrets Manager — no IAM changes needed.
resource "aws_iam_role" "openclaw" {
  name = "openclaw-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "openclaw_secrets" {
  name = "openclaw-secrets-policy"
  role = aws_iam_role.openclaw.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:openclaw/*"
    }]
  })
}

# Bedrock: invoke Claude models without API keys
resource "aws_iam_role_policy" "openclaw_bedrock" {
  name = "openclaw-bedrock-policy"
  role = aws_iam_role.openclaw.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ]
      # Scope to Claude models only — remove the condition to allow all Bedrock models
      Resource = [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    }]
  })
}

# SSM Session Manager — shell access without opening port 22
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.openclaw.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "openclaw" {
  name = "openclaw-instance-profile"
  role = aws_iam_role.openclaw.name
}

# --- EC2 Instance ---
resource "aws_instance" "openclaw" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  key_name                    = var.ssh_key_name
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.openclaw.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.openclaw.name

  root_block_device {
    volume_size           = 30   # GB — OS (5) + Docker images (10) + logs/data (15)
    volume_type           = "gp3"
    throughput            = 125  # MB/s (free baseline for gp3)
    iops                  = 3000 # free baseline for gp3
    delete_on_termination = false
    encrypted             = true
  }

  user_data = templatefile("${path.module}/scripts/user-data.sh", {
    litellm_master_key = var.litellm_master_key
    aws_region         = var.aws_region
  })

  metadata_options {
    http_tokens   = "required" # IMDSv2 only — prevents SSRF attacks
    http_endpoint = "enabled"
  }

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
