#!/bin/bash
# EC2 user_data: install Docker, Ollama, provision ~/projects layout.
# Run by cloud-init at first boot.

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
printf '%s\n%s\n' '[Service]' 'Environment="OLLAMA_HOST=0.0.0.0"' > /etc/systemd/system/ollama.service.d/override.conf

systemctl daemon-reload
systemctl restart ollama

# Pull Qwen 1.5B model (with timeout so boot continues if network slow)
timeout 300 sudo -u ubuntu ollama pull qwen:1.5b || true

# Create ~/projects base (daatan and year-shape created by setup-on-ec2.sh via git clone)
mkdir -p /home/ubuntu/projects
chown ubuntu:ubuntu /home/ubuntu/projects

# Generate SSH key for GitHub access
sudo -u ubuntu ssh-keygen -t ed25519 -N "" -f /home/ubuntu/.ssh/id_github

echo "Provisioning complete!" > /home/ubuntu/setup-complete.txt
