# Secrets for Environment Variables (.env)
resource "aws_secretsmanager_secret" "env_vars" {
  name        = "daatan-env-${var.environment}"
  description = "Environment variables for DAATAN ${var.environment} environment"
  
  # Allow deletion without recovery window for easier cleanup in dev/staging
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name = "daatan-env-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "env_vars" {
  secret_id     = aws_secretsmanager_secret.env_vars.id
  secret_string = "Please update this manually in AWS Console with real .env content"
  
  lifecycle {
    ignore_changes = [secret_string] # Prevent Terraform from overwriting manual updates
  }
}

# Secret for GitHub Deploy Key (SSH Private Key)
resource "aws_secretsmanager_secret" "deploy_key" {
  name        = "daatan-deploy-key-${var.environment}"
  description = "SSH Private Key for cloning GitHub repository in ${var.environment}"

  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name = "daatan-deploy-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "deploy_key" {
  secret_id     = aws_secretsmanager_secret.deploy_key.id
  secret_string = "Please update this manually in AWS Console with real PRIVATE KEY"

  lifecycle {
    ignore_changes = [secret_string] # Prevent Terraform from overwriting manual updates
  }
}
