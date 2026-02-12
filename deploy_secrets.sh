#!/bin/bash
set -e

# --- Configuration ---
# Path to your SSH private key
SSH_KEY_PATH="/home/mark/.ssh/daatan-key.pem"
# Hostnames or IP addresses for your staging and release environments
STAGING_HOST="staging.daatan.com"
RELEASE_HOST="daatan.com" # Assuming 'daatan.com' is your release environment hostname

# --- Function to update environment variable and restart Docker containers ---
update_env_and_restart() {
  local host="$1"
  local env_var_name="$2"
  local env_var_value="$3"

  echo "🚀 Starting deployment for environment variable '${env_var_name}' on host: ${host}..."

  # Check if the SSH key file exists
  if [[ ! -f "$SSH_KEY_PATH" ]]; then
    echo "Error: SSH key not found at '$SSH_KEY_PATH'."
    echo "Please ensure the key exists and has correct permissions (chmod 400 '$SSH_KEY_PATH')."
    exit 1
  fi

  # Execute the remote command via SSH using a here-document (heredoc)
  # This is more robust for multi-line commands and simplifies quoting.
  ssh -i "$SSH_KEY_PATH" ubuntu@"$host" << EOF
    set -e
    
    echo "--- Deployment Steps on ${host} ---"
    echo "Current working directory on remote:"
    pwd
    
    # Ensure app directory exists and navigate into it
    mkdir -p ~/app
    chown -R ubuntu:ubuntu ~/app
    cd ~/app
    
    echo "--- Syncing Application Code ---"
    if [[ -d ".git" ]]; then
      echo "Git repository found. Pulling latest code..."
      git fetch origin main
      git reset --hard origin/main
      git clean -fdx -e .env -e certbot -e node_modules # Preserve .env, certbot, node_modules
    else
      echo "No Git repository found. Cleaning directory and cloning daatan project..."
      # Aggressively clean all contents (including hidden files/dirs except . and ..) before cloning
      sudo rm -rf * .[!.]* ..?* || true # Use true to prevent exit on error if nothing to remove

      # Assuming your repository is private and SSH key access is configured on GitHub for the EC2 user
      # IMPORTANT: Replace git@github.com:your-repo-org/daatan.git with your actual SSH repository URL!
      git clone git@github.com:komapc/daatan.git . 
    fi
    echo "Application code synced."
    echo "------------------------------------"

    echo "Updating '${env_var_name}' in .env file..."
    
    # Check if .env file exists, create if not
    if [[ ! -f .env ]]; then
      echo "Creating new .env file."
      touch .env
      chown ubuntu:ubuntu .env
    fi

    # Use sed to find the line starting with ENV_VAR_NAME and replace its entire content.
    # The value is enclosed in double quotes.
    if grep -q "^${env_var_name}=" .env; then
      sed -i "/^${env_var_name}=/c\${env_var_name}=\"${env_var_value}\"" .env
    else
      echo "${env_var_name}=\"${env_var_value}\"" >> .env
    fi
    
    echo "Restarting Docker containers..."
    # Stop and remove existing containers
    /usr/bin/docker compose -f docker-compose.prod.yml down
    # Start new containers in detached mode, picking up the updated .env
    /usr/bin/docker compose -f docker-compose.prod.yml up -d
    
    echo "--- Post-Deployment Diagnostics ---"
    echo "Docker containers status:"
    /usr/bin/docker ps -a || echo "Failed to list docker containers."
    echo "Nginx service status:"
    sudo systemctl status nginx || echo "Failed to get Nginx service status."
    echo "Nginx configuration test:"
    sudo nginx -t || echo "Failed to test Nginx configuration."
    echo "------------------------------------"

    echo "✅ Deployment to '${host}' completed successfully."
EOF
}

# --- Main script logic ---

# Check if GOOGLE_CLIENT_SECRET is set as a local environment variable
if [[ -z "$GOOGLE_CLIENT_SECRET" ]]; then
  echo "Error: The GOOGLE_CLIENT_SECRET environment variable is not set locally."
  echo "Usage: GOOGLE_CLIENT_SECRET="YOUR_ACTUAL_SECRET" ./deploy_secrets.sh <staging|release>"
  exit 1
fi

# Check if an environment (staging or release) is provided as an argument
if [[ -z "$1" ]]; then
  echo "Error: Please specify the deployment environment ('staging' or 'release')."
  echo "Usage: GOOGLE_CLIENT_SECRET="YOUR_ACTUAL_SECRET" ./deploy_secrets.sh <staging|release>"
  exit 1
fi

ENVIRONMENT="$1"
CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"

# Execute the update function based on the specified environment
if [[ "$ENVIRONMENT" == "staging" ]]; then
  update_env_and_restart "$STAGING_HOST" "GOOGLE_CLIENT_SECRET" "$CLIENT_SECRET"
elif [[ "$ENVIRONMENT" == "release" ]]; then
  update_env_and_restart "$RELEASE_HOST" "GOOGLE_CLIENT_SECRET" "$CLIENT_SECRET"
else
  echo "Error: Invalid environment specified. Please use 'staging' or 'release'."
  echo "Usage: GOOGLE_CLIENT_SECRET="YOUR_ACTUAL_SECRET" ./deploy_secrets.sh <staging|release>"
  exit 1
fi
