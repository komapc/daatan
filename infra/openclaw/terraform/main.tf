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
data "aws_availability_zones" "available" { state = "available" }
data "aws_subnet" "default" {
  availability_zone = data.aws_availability_zones.available.names[0]
  default_for_az    = true
}

resource "aws_default_vpc" "default" {}

resource "aws_security_group" "openclaw" {
  name        = "openclaw-sg"
  description = "Security group for OpenClaw EC2"
  vpc_id      = aws_default_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
    description = "SSH access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
}

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

resource "aws_instance" "openclaw" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  key_name                    = var.ssh_key_name
  subnet_id                   = data.aws_subnet.default.id
  vpc_security_group_ids      = [aws_security_group.openclaw.id]
  associate_public_ip_address = true

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
