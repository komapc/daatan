data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "availability-zone"
    values = ["${var.aws_region}a"]
  }
}

resource "aws_security_group" "openclaw" {
  name        = "openclaw-sg"
  description = "Security group for OpenClaw EC2"
  vpc_id      = data.aws_vpc.default.id

  # SSH — restricted to your IP only
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
    description = "SSH (restricted to admin IP)"
  }

  # HTTP/HTTPS for OpenClaw web UI + nginx
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # OpenClaw gateway port (internal — not exposed publicly, nginx proxies it)
  # Port 18789 is kept internal; access via nginx only.

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "openclaw-sg"
  }
}
