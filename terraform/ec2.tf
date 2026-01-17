# Get latest Ubuntu 24.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance
resource "aws_instance" "backend" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  key_name                    = var.ssh_key_name
  subnet_id                   = aws_subnet.public_a.id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
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

    # Install AWS CLI
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip

    # Add ubuntu user to docker group
    usermod -aG docker ubuntu

    # Enable Docker service
    systemctl enable docker
    systemctl start docker

    # Create app directory
    mkdir -p /home/ubuntu/app
    mkdir -p /home/ubuntu/backups
    chown -R ubuntu:ubuntu /home/ubuntu/app /home/ubuntu/backups

    # Write S3 bucket name to config file (Terraform interpolation)
    echo "${aws_s3_bucket.backups.bucket}" > /home/ubuntu/.s3_bucket

    # Create backup script
    cat > /home/ubuntu/backup-db.sh << 'BACKUP'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/home/ubuntu/backups/daatan_$TIMESTAMP.sql.gz"
S3_BUCKET=$(cat /home/ubuntu/.s3_bucket)

# Dump database
docker exec daatan-postgres pg_dump -U daatan daatan | gzip > "$BACKUP_FILE"

# Upload to S3
aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/daily/"

# Keep only last 3 local backups
ls -t /home/ubuntu/backups/*.sql.gz | tail -n +4 | xargs -r rm

echo "Backup completed: $BACKUP_FILE"
BACKUP

    chmod +x /home/ubuntu/backup-db.sh
    chown ubuntu:ubuntu /home/ubuntu/backup-db.sh

    # Setup daily backup cron (3 AM)
    echo "0 3 * * * ubuntu /home/ubuntu/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1" > /etc/cron.d/daatan-backup
    chmod 644 /etc/cron.d/daatan-backup

    echo "Setup complete!" > /home/ubuntu/setup-complete.txt
  EOF

  user_data_replace_on_change = false

  tags = {
    Name = "daatan-backend"
  }

  lifecycle {
    ignore_changes = [ami, user_data, instance_type]
  }
}

# Elastic IP for consistent public address
resource "aws_eip" "backend" {
  instance = aws_instance.backend.id
  domain   = "vpc"

  tags = {
    Name = "daatan-backend-eip"
  }
}
