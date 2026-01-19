# EC2 Security Group
resource "aws_security_group" "ec2" {
  name        = "daatan-ec2-sg"
  description = "Security group for DAATAN EC2 instance"
  vpc_id      = aws_vpc.main.id

  # SSH - Restricted to allowed_ssh_cidr for security
  ingress {
    description = "SSH (restricted access)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # ICMP (Ping) - For debugging connectivity issues
  ingress {
    description = "ICMP from anywhere"
    from_port   = -1
    to_port     = -1
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP
  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Node.js API - Internal only (accessed via nginx reverse proxy)
  # Port 3000 is NOT exposed publicly - use port 80/443 instead

  # Allow all outbound traffic
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "daatan-ec2-sg"
  }
}
