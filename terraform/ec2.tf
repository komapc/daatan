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
    delete_on_termination = false
    encrypted             = true
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e
    exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

    # Update system
    apt-get update
    apt-get upgrade -y
    apt-get install -y ca-certificates curl gnupg unzip jq git

    # Install Docker
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

    # --- Zero Touch Setup ---
    
    # 1. Setup App Directory
    mkdir -p /home/ubuntu/app
    chown ubuntu:ubuntu /home/ubuntu/app
    
    # 2. Retrieve Secrets (SSH Key first for cloning)
    REGION="${var.aws_region}"
    SECRET_ENV_Name="${aws_secretsmanager_secret.env_vars.name}"
    SECRET_KEY_NAME="${aws_secretsmanager_secret.deploy_key.name}"

    # Get SSH Key
    mkdir -p /home/ubuntu/.ssh
    if aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_KEY_NAME" --query SecretString --output text > /home/ubuntu/.ssh/id_rsa; then
        chown ubuntu:ubuntu /home/ubuntu/.ssh/id_rsa
        chmod 600 /home/ubuntu/.ssh/id_rsa
    else
        echo "Failed to retrieve SSH Key"
        exit 1
    fi

    # Add GitHub to known hosts
    ssh-keyscan github.com >> /home/ubuntu/.ssh/known_hosts
    chown ubuntu:ubuntu /home/ubuntu/.ssh/known_hosts

    # 3. Clone Repository
    # Remove directory if it exists and is empty, or if it only contains .env from a failed previous run (though we moved .env retrieval to later/temp)
    # Actually, to be safe, we will write .env AFTER cloning.
    
    # Use || true to prevent failure if repo is already there
    if [ ! -d "/home/ubuntu/app/.git" ]; then
        sudo -u ubuntu git clone git@github.com:komapc/daatan.git /home/ubuntu/app || echo "Repo clone failed"
    else
        echo "Repo already exists"
    fi

    # 4. Retrieve .env (NOW, after clone)
    if aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ENV_Name" --query SecretString --output text > /home/ubuntu/app/.env; then
        chown ubuntu:ubuntu /home/ubuntu/app/.env
        chmod 600 /home/ubuntu/app/.env
    else
        echo "Failed to retrieve .env — aborting setup"
        exit 1
    fi

    # 5. Start Application
    cd /home/ubuntu/app
    # Only start if docker-compose.prod.yml exists (meaning clone was successful)
    if [ -f "docker-compose.prod.yml" ]; then
      docker compose -f docker-compose.prod.yml up -d
      
      # Wait for containers to be ready
      sleep 20
      
      # Run migrations
      if docker ps | grep -q daatan-app-staging; then
        echo "Running staging migrations..."
        docker exec daatan-app-staging node node_modules/prisma/build/index.js migrate deploy || echo "Staging migration failed"
      fi
      
      if docker ps | grep -q daatan-app; then
        echo "Running production migrations..."
        docker exec daatan-app node node_modules/prisma/build/index.js migrate deploy || echo "Production migration failed"
      fi
      
      echo "Application started and migrations applied!"
    else
      echo "docker-compose.prod.yml not found. Is the repo cloned? check /var/log/user-data.log"
    fi

    # 5. Setup Database Backups
    # Write S3 bucket name to config file
    echo "${aws_s3_bucket.backups.bucket}" > /home/ubuntu/.s3_bucket

    # Create backup script
    cat > /home/ubuntu/backup-db.sh << 'BACKUP'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/home/ubuntu/backups/daatan_$TIMESTAMP.sql.gz"
S3_BUCKET=$(cat /home/ubuntu/.s3_bucket)

# Dump database
# Only run if container is running
if docker ps | grep -q daatan-postgres; then
  docker exec daatan-postgres pg_dump -U daatan daatan | gzip > "$BACKUP_FILE"
  
  # Upload to S3
  aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/daily/"
  
  # Keep only last 3 local backups
  ls -t /home/ubuntu/backups/*.sql.gz | tail -n +4 | xargs -r rm
  
  echo "Backup completed: $BACKUP_FILE"
else
  echo "Postgres container not running. Skipping backup."
fi
BACKUP

    chmod +x /home/ubuntu/backup-db.sh
    chown ubuntu:ubuntu /home/ubuntu/backup-db.sh
    mkdir -p /home/ubuntu/backups
    chown ubuntu:ubuntu /home/ubuntu/backups

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
    ignore_changes = [ami, user_data]
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
