terraform {
  required_version = ">= 1.0"

  # Using local backend for separation from main project state
  # To use S3, change this to a different key in the same bucket or a new bucket
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

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Update system
    apt-get update
    apt-get upgrade -y

    # Install Docker
    apt-get install -y ca-certificates curl gnupg unzip
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add ubuntu user to docker group
    usermod -aG docker ubuntu

    # Install Ollama
    curl -fsSL https://ollama.com/install.sh | sh

    # Configure Ollama to listen on all interfaces (for Docker access)
    mkdir -p /etc/systemd/system/ollama.service.d
    echo '[Service]
Environment="OLLAMA_HOST=0.0.0.0"' > /etc/systemd/system/ollama.service.d/override.conf

    systemctl daemon-reload
    systemctl restart ollama

    # Pull Qwen 1.5B model (with timeout so boot continues if network slow)
    timeout 300 sudo -u ubuntu ollama pull qwen:1.5b || true

    # Create workspace structure
    mkdir -p /home/ubuntu/openclaw/daatan
    mkdir -p /home/ubuntu/openclaw/calendar
    mkdir -p /home/ubuntu/openclaw/config
    chown -R ubuntu:ubuntu /home/ubuntu/openclaw

    # Generate SSH key for GitHub access
    sudo -u ubuntu ssh-keygen -t ed25519 -N "" -f /home/ubuntu/.ssh/id_github

    echo "Provisioning complete!" > /home/ubuntu/setup-complete.txt
  EOF

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
